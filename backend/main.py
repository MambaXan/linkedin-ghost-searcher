from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

app = FastAPI()

# БЕЗ ЭТОГО БУДЕТ NETWORK ERROR
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], # Адрес твоего фронта
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SearchQuery(BaseModel):
    job_title: str
    company: Optional[str] = ""
    location: Optional[str] = ""

@app.get("/templates")
async def get_templates():
    return [
        {"id": 1, "title": "Connect", "text": "Hi [Name], saw your profile at [Company]. Would love to connect!"},
        {"id": 2, "title": "Coffee Chat", "text": "Hi [Name], I'm a student at UniME. Can I ask 2 questions?"}
    ]

@app.post("/generate-query")
async def generate_query(data: SearchQuery):
    dork = f'site:linkedin.com/in/ "{data.job_title}"'
    if data.company: dork += f' "{data.company}"'
    if data.location: dork += f' "{data.location}"'
    dork += ' -intitle:"profiles" -inurl:"dir/"'
    
    url = f"https://www.google.com/search?q={dork.replace(' ', '+')}"
    return {"raw_query": dork, "google_url": url}