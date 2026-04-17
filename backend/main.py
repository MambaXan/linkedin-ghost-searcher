import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from groq import Groq
from dotenv import load_dotenv

import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Groq(api_key=os.getenv("GROQ_API_KEY"))


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

    url = f"https://www.google.com/search?q={dork.replace(' ', '+')}"
    return {"raw_query": dork, "google_url": url}


@app.post("/ai-generate-query")
async def ai_generate_query(data: AiRequest):
    system_prompt = "You are a LinkedIn search expert. Return ONLY a Google Dork query."

    try:
        base_path = os.path.dirname(os.path.abspath(__file__))
        prompt_path = os.path.join(base_path, "agents", "strategist.md")

        if os.path.exists(prompt_path):
            with open(prompt_path, "r", encoding="utf-8") as f:
                system_prompt = f.read()
    except Exception as e:
        print(f"File read error: {e}")

    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": data.user_input}
        ]
    )

    dork = completion.choices[0].message.content.strip()
    dork = dork.replace('"', '').replace('`', '')

    url = f"https://www.google.com/search?q={dork.replace(' ', '+')}"
    return {"raw_query": dork, "google_url": url}
