import os
import re
import logging
import datetime
import csv
import io
import hmac
import hashlib
from typing import Optional, List
from fastapi import FastAPI, Request, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from groq import Groq
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
LEMON_SQUEEZY_SECRET = os.getenv("LEMON_SQUEEZY_SECRET", "")

SITE_OPERATOR = "site:linkedin.com/in/"

PEOPLE_FILTER = (
    " -inurl:jobs -inurl:careers -inurl:job -inurl:hiring"
    " -intitle:jobs -intitle:job -intitle:hiring -intitle:вакансии -intitle:vacancy"
    ' -intitle:"profiles" -inurl:"dir/" -inurl:view'
)

if not all([SUPABASE_URL, SUPABASE_KEY, SUPABASE_JWT_SECRET]):
    raise ValueError("Missing Supabase credentials in .env file!")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="LinkedIn Ghost Searcher API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    logger.error("GROQ_API_KEY is not set!")
groq_client = Groq(api_key=api_key)


# ─── Auth ─────────────────────────────────────────────────────────────────────

def get_current_user(authorization: str = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    try:
        token = authorization.split(" ")[1]
        user_response = supabase.auth.get_user(token)
        if not user_response.user:
            raise Exception("User not found")
        return {"sub": user_response.user.id, "email": user_response.user.email}
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ─── Models ───────────────────────────────────────────────────────────────────

class SearchQuery(BaseModel):
    job_title: str
    company: Optional[str] = ""
    location: Optional[str] = ""


class AiRequest(BaseModel):
    user_input: str


class HistoryItem(BaseModel):
    query: str
    url: str
    date: str


# ─── Global error handler ─────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "detail": str(exc)},
        headers={"Access-Control-Allow-Origin": "*"},
    )


# ─── Helpers ──────────────────────────────────────────────────────────────────

def get_or_create_profile(user_id: str, email: str) -> dict:
    res = supabase.table("profiles").select("*").eq("id", user_id).execute()
    if res.data:
        return res.data[0]
    new_profile = supabase.table("profiles").insert({
        "id": user_id,
        "email": email,
        "search_count": 0,
        "plan_type": "free",
        "is_pro": False,
    }).execute()
    return new_profile.data[0]


def is_pro_user(profile: dict) -> bool:
    return profile.get("is_pro", False) or profile.get("plan_type") == "pro"


def check_free_limit(profile: dict) -> bool:
    if is_pro_user(profile):
        return False
    return profile.get("search_count", 0) >= 5


def increment_search_count(user_id: str, current_count: int) -> None:
    supabase.table("profiles").update({
        "search_count": current_count + 1,
        "last_search_date": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }).eq("id", user_id).execute()


def sanitize_dork(dork: str) -> str:
    """Принудительно гарантирует site:linkedin.com/in/ и фильтры против вакансий."""
    # Убираем любые другие site: операторы (jobs, search и т.д.)
    dork = re.sub(r'site:linkedin\.com/(?!in/)\S*', '', dork).strip()

    # Гарантируем site:linkedin.com/in/ в начале
    if not dork.startswith(SITE_OPERATOR):
        dork = SITE_OPERATOR + " " + dork

    # Добавляем весь блок фильтров, если хоть один отсутствует
    for token in ["-inurl:jobs", "-intitle:jobs", "-inurl:careers"]:
        if token not in dork:
            dork += PEOPLE_FILTER
            break

    return dork.strip()


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/templates")
async def get_templates():
    return [
        {"id": 1, "title": "Connect",
            "text": "Hi [Name], saw your profile at [Company]. Would love to connect!"},
        {"id": 2, "title": "Coffee Chat",
            "text": "Hi [Name], I'm a student at UniME. Can I ask 2 quick questions?"},
    ]


@app.post("/generate-query")
async def generate_query(data: SearchQuery, user: dict = Depends(get_current_user)):
    """Classic dorking — free users (up to 5) + PRO unlimited."""
    user_id = user["sub"]
    profile = get_or_create_profile(user_id, user.get("email", ""))

    if check_free_limit(profile):
        raise HTTPException(status_code=403, detail="Daily limit reached. Upgrade to PRO!")

    dork = f'{SITE_OPERATOR} "{data.job_title}"'
    if data.company:
        dork += f' "{data.company}"'
    if data.location:
        dork += f' "{data.location}"'

    dork = sanitize_dork(dork)

    increment_search_count(user_id, profile.get("search_count", 0))

    return {
        "raw_query": dork,
        "google_url": f"https://www.google.com/search?q={dork.replace(' ', '+')}",
        "current_usage": profile.get("search_count", 0) + 1,
    }


@app.post("/ai-generate-query")
async def ai_generate_query(data: AiRequest, user: dict = Depends(get_current_user)):
    """AI Strategist — PRO only."""
    user_id = user["sub"]

    try:
        profile = get_or_create_profile(user_id, user.get("email", ""))
    except Exception as e:
        logger.error(f"DB error for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Database error")

    if not is_pro_user(profile):
        raise HTTPException(status_code=403, detail="AI Strategist is a PRO feature")

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": open("strategist.md").read()},
                {"role": "user", "content": data.user_input},
            ],
        )
        dork = completion.choices[0].message.content.strip().replace('"', "").replace("`", "")
        dork = sanitize_dork(dork)

        google_url = f"https://www.google.com/search?q={dork.replace(' ', '+')}"
        increment_search_count(user_id, profile.get("search_count", 0))

        return {
            "raw_query": dork,
            "google_url": google_url,
            "status": "success",
            "current_usage": profile.get("search_count", 0) + 1,
        }
    except Exception as e:
        logger.error(f"AI generation error for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="AI generation failed. Please try again.")


@app.post("/export-csv")
async def export_csv(history: List[HistoryItem], user: dict = Depends(get_current_user)):
    """CSV export — PRO only."""
    user_id = user["sub"]
    res = supabase.table("profiles").select("plan_type, is_pro").eq("id", user_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    if not is_pro_user(res.data[0]):
        raise HTTPException(status_code=403, detail="CSV Export is a PRO feature")

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["query", "url", "date"])
    writer.writeheader()
    for item in history:
        writer.writerow(item.dict())
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leads.csv"},
    )


@app.post("/webhook")
async def lemonsqueezy_webhook(request: Request):
    """
    Lemon Squeezy webhook — upgrades user to PRO on purchase.
    Verifies HMAC-SHA256 signature via X-Signature header.
    Set LEMON_SQUEEZY_SECRET in .env — must match the secret in LS dashboard.
    """
    raw_body = await request.body()

    if LEMON_SQUEEZY_SECRET:
        signature = request.headers.get("X-Signature", "")
        expected = hmac.new(
            LEMON_SQUEEZY_SECRET.encode("utf-8"),
            raw_body,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
            logger.warning("Webhook signature mismatch — rejected")
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_name = payload.get("meta", {}).get("event_name", "")
    attributes = payload.get("data", {}).get("attributes", {})
    email = attributes.get("user_email") or attributes.get("customer_email", "")

    logger.info(f"Webhook: event={event_name}, email={email}")

    if event_name in ("subscription_created", "order_created", "subscription_payment_success"):
        if not email:
            logger.warning("Webhook: email missing in payload")
            return {"status": "skipped", "reason": "no email"}
        result = supabase.table("profiles").update({
            "plan_type": "pro",
            "is_pro": True,
        }).eq("email", email).execute()
        if result.data:
            logger.info(f"Upgraded {email} to PRO")
        else:
            logger.warning(f"No profile found for {email}")

    return {"status": "ok"}