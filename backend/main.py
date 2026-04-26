import os
import logging
from typing import Optional, List
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from groq import Groq
from dotenv import load_dotenv
import csv
import io
from fastapi.responses import StreamingResponse


class HistoryItem(BaseModel):
    query: str
    url: str
    date: str


load_dotenv()

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
async def ai_generate_query(data: AiRequest):
    system_prompt = "You are a LinkedIn search expert. Return ONLY a Google Dork query."

    base_dir = os.path.dirname(os.path.abspath(__file__))
    prompt_path = os.path.join(base_dir, "agents", "strategist.md")

    if os.path.exists(prompt_path):
        try:
            with open(prompt_path, "r", encoding="utf-8") as f:
                system_prompt = f.read()
        except Exception as e:
            logger.warning(f"Failed to read strategist.md: {e}")

    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": data.user_input}
            ]
        )

        dork = completion.choices[0].message.content.strip().replace(
            '"', '').replace('`', '')
        return {
            "raw_query": dork,
            "google_url": f"https://www.google.com/search?q={dork.replace(' ', '+')}"
        }
    except Exception as e:
        logger.error(f"Groq API error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
