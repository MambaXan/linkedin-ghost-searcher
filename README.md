# GhostIn 👻 — AI-Powered LinkedIn OSINT & Sourcing Tool

Stop hitting LinkedIn's strict Commercial Use Limits or paying $150+/month for Premium/Recruiter Lite subscriptions. 

**GhostIn** is an open-source alternative that leverages an AI Strategist to automatically build complex Google X-Ray (Dorking) queries. It uncovers live, Google-indexed candidate profiles hidden behind LinkedIn paywalls.

### 🔗 Try it Live (No Registration Required):
👉 **[https://ghostin.org](https://ghostin.org?utm_source=github)** *(Get 5 free AI-powered searches daily directly on the homepage, completely anonymously).*

---

## 🚀 Key Features
* **AI Strategist Mode:** Describe your ideal candidate in natural language (e.g., *"Senior React dev in Italy who worked at Stripe"*), and the AI will auto-craft perfect X-Ray dorks.
* **Classic Dorking Mode:** Quick structured search by Job Title, Target Company, and Location.
* **100% Safety:** Zero risk to your personal LinkedIn account since it uses public Google data.
* **Zero Friction:** 5 daily searches with no login, no credit card, and no setup required.

## 💡 Why This Project Exists
LinkedIn aggressively limits how many profiles you can view for free each month, forcing solo founders, bootstrappers, and technical recruiters into expensive tiers. This tool bypasses those limitations by automating Google X-Ray search string generation, delivering highly targeted candidate profiles without the friction.

## 🛠️ Tech Stack
* **Frontend:** React, TypeScript, Tailwind CSS, Vite
* **Backend:** Python, FastAPI, OpenAI API
* **Deployment:** Vercel

---
*Built by an independent developer for recruiters and indie hackers. If you like this project, please drop a ⭐ to support it!*

---

## What is this?

LinkedIn restricts how many profiles free-tier users can view. Ghost Searcher works around this by generating advanced Google Dork queries that surface LinkedIn profiles directly through Google — meaning no profile view notifications, no paywalls, no restrictions.

---

## Main page
![Main page](./images/search-page.png)

## AI Search
![AI Agent](./images/ai-strategist.png)

## Features

- **Dynamic query generation** — builds complex Google Dorking strings from Job Title, Company, and Location
- **Anti-noise filtering** — operators like `-intitle:"profiles"` and `-inurl:"dir/"` strip directory pages and junk results
- **Outreach templates** — built-in message templates for cold networking and coffee chats
- **Type-safe end-to-end** — TypeScript interfaces on the frontend, Pydantic models on the backend
- **Responsive UI** — dark-themed SCSS interface

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, SCSS |
| Backend | FastAPI, Python 3.11+, Uvicorn |
| Communication | REST API with CORS middleware |

---

## Quick Start

**Backend**
```bash
pip install fastapi uvicorn
uvicorn main:app --reload
```

**Frontend**
```bash
npm install
npm start
```

The frontend runs on `http://localhost:3000`, backend on `http://localhost:8000`.

---

## How it works

1. User enters a Job Title, Company, and optional Location
2. The FastAPI backend constructs a Google Dork string, e.g.:
   ```
   site:linkedin.com/in "Software Engineer" "Google" "Berlin" -intitle:"profiles" -inurl:"dir/"
   ```
3. The frontend receives the raw query + a ready-to-open Google URL
4. User clicks through to anonymous search results

---

## Project Structure

```
├── backend/
│   └── main.py          
└── frontend/
    ├── src/
    │   ├── App.tsx       
    │   └── App.scss      
    └── package.json
```

---

## For Developers

- **State management** — React Hooks (`useState`, `useEffect`)
- **Async communication** — clean `async/await` fetch calls
- **Validation** — TypeScript interfaces + Pydantic schemas enforce strict types across the stack
- **Architecture** — query generation logic is fully decoupled from the UI layer

---

## Disclaimer

This tool is intended for educational purposes and legitimate OSINT research only. Always respect LinkedIn's Terms of Service and applicable privacy laws in your jurisdiction.

---

<p align="center">Made with 👻 and Google Dorking</p>
