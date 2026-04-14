from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
from groq import Groq

app = FastAPI()

client = Groq(
    api_key="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")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SearchQuery(BaseModel):
    job_title: str
    company: Optional[str] = ""
    location: Optional[str] = ""


class AiRequest(BaseModel):
    user_input: str


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
async def ai_generate_query(user_input: str):
    with open("agents/strategist.md", "r", encoding="utf-8") as f:
        system_prompt = f.read()

    completion = client.chat.completions.create(
        model="llama3-8b-8192",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input}
        ]
    )

    dork = completion.choices[0].message.content.strip()
    url = f"https://www.google.com/search?q={dork.replace(' ', '+')}"

    return {"raw_query": dork, "google_url": url}
