import os
import logging
from typing import Optional, List
from fastapi import FastAPI, Request, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from groq import Groq
from dotenv import load_dotenv
import csv
import io
from fastapi.responses import StreamingResponse
from jose import jwt
from supabase import create_client
import datetime

# 1. Сначала загружаем окружение
load_dotenv()

# 2. Теперь вытаскиваем переменные из .env
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# 3. Проверка (если ключи не подтянулись, сервер сразу об этом скажет)
if not all([SUPABASE_URL, SUPABASE_KEY, SUPABASE_JWT_SECRET]):
    raise ValueError("Missing Supabase credentials in .env file!")

# 4. Создаем клиент Supabase
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_current_user(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(
            status_code=401, detail="Authorization header missing")

    try:
        token = authorization.split(" ")[1]

        # Добавляем конкретный алгоритм в список разрешенных
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],  # Убедись, что тут список
            options={
                "verify_aud": False,
                "verify_signature": True  # Включаем проверку подписи явно
            }
        )
        return payload
    except Exception as e:
        # Теперь мы увидим в консоли точную причину, если алгоритм не подошел
        print(f"Auth error detail: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


class HistoryItem(BaseModel):
    query: str
    url: str
    date: str


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
    logger.error("GROQ_API_KEY is not set in environment variables!")
client = Groq(api_key=api_key)


class SearchQuery(BaseModel):
    job_title: str
    company: Optional[str] = ""
    location: Optional[str] = ""


class AiRequest(BaseModel):
    user_input: str


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "detail": str(exc)},
        headers={"Access-Control-Allow-Origin": "*"}
    )


@app.get("/templates")
async def get_templates():
    return [
        {"id": 1, "title": "Connect",
            "text": "Hi [Name], saw your profile at [Company]. Would love to connect!"},
        {"id": 2, "title": "Coffee Chat",
            "text": "Hi [Name], I'm a student at UniME. Can I ask 2 questions?"}
    ]


@app.post("/generate-query")
async def generate_query(data: SearchQuery):
    dork = f'site:linkedin.com/in/ "{data.job_title}"'
    if data.company:
        dork += f' "{data.company}"'
    if data.location:
        dork += f' "{data.location}"'
    dork += ' -intitle:"profiles" -inurl:"dir/"'

    return {
        "raw_query": dork,
        "google_url": f"https://www.google.com/search?q={dork.replace(' ', '+')}"
    }


@app.post("/ai-generate-query")
async def ai_generate_query(
    data: AiRequest,
    user: dict = Depends(get_current_user)
):
    user_id = user.get("sub")
    logger.info(f"--- Processing request for User: {user_id} ---")

    try:
        # Проверяем наличие профиля
        res = supabase.table("profiles").select(
            "*").eq("id", user_id).execute()

        if not res.data:
            logger.warning(
                f"Profile {user_id} not found in DB. Creating one...")
            # Если юзера нет в profiles (бывает при старых акках), создаем его на лету
            new_prof = supabase.table("profiles").insert({
                "id": user_id,
                "email": user.get("email", "unknown")
            }).execute()
            profile = new_prof.data[0]
        else:
            profile = res.data[0]

        logger.info(
            f"User Plan: {profile.get('plan_type')}, Count: {profile.get('search_count')}")

        # Проверка лимитов
        if profile.get("plan_type") == "free" and profile.get("search_count", 0) >= 5:
            logger.info(f"User {user_id} hit the limit.")
            raise HTTPException(
                status_code=403,
                detail="Limit reached (5/5). Upgrade to PRO! 🚀"
            )

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Supabase error: {e}")
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")

    # --- Генерация AI (оставляем твой код) ---
    try:
        # ... твой код генерации dork ...
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "Return ONLY a Google Dork query."},
                {"role": "user", "content": data.user_input}
            ]
        )
        dork = completion.choices[0].message.content.strip().replace(
            '"', '').replace('`', '')
        google_url = f"https://www.google.com/search?q={dork.replace(' ', '+')}"

        # --- Обновление счетчика ---
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        supabase.table("profiles").update({
            "search_count": profile.get("search_count", 0) + 1,
            "last_search_date": now_iso
        }).eq("id", user_id).execute()

        return {
            "raw_query": dork,
            "google_url": google_url,
            "status": "success",
            "current_usage": profile.get("search_count", 0) + 1
        }

    except Exception as e:
        logger.error(f"Generation error: {e}")
        raise HTTPException(status_code=500, detail="AI generation failed")


@app.post("/export-csv")
async def export_csv(history: List[HistoryItem]):
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["query", "url", "date"])
    writer.writeheader()

    for item in history:
        writer.writerow({
            "query": item.query,
            "url": item.url,
            "date": item.date
        })

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=linkedin_leads.csv",
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )
