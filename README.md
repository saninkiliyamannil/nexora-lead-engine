# Nexora Lead Engine - Backend

Real-time lead generation backend for Nexora agency.

## APIs Used
- Instagram Scraper (RapidAPI) - finds real business accounts by niche
- Instagram Email Finder (RapidAPI) - extracts emails from profiles
- ProxyCurl (RapidAPI) - LinkedIn company enrichment
- Groq AI - qualifies leads and generates personalised intros

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Add your API keys
```bash
cp .env.example .env
# Edit .env and add your Groq and RapidAPI keys
```
Get your Groq API key from: https://console.groq.com/keys

### 3. Run locally
```bash
npm start
# Server runs on http://localhost:3000
```

---

## Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fsaninkiliyamannil%2Fnexora-lead-engine)

1. Open the deploy button above
2. Sign in to Render
3. Create the web service from this GitHub repo
4. Set `GROQ_API_KEY` and `RAPIDAPI_KEY` during setup
5. Deploy - Render will build from GitHub and auto-deploy future pushes

---

## API Endpoints

### GET /
Health check - returns server status.

### POST /api/leads/generate
**Main endpoint - full pipeline.**
Scrapes Instagram -> finds emails -> qualifies with Groq -> returns leads.

```json
{
  "niche": "Video production house",
  "location": "India",
  "count": 10,
  "tone": "Friendly and casual",
  "seed_account": "videoproductionindia"
}
```

### POST /api/instagram/followers
Get real followers of any Instagram account.
```json
{ "username": "videoproductionindia", "count": 20 }
```

### POST /api/instagram/email
Get email from an Instagram profile URL.
```json
{ "instagram_url": "https://www.instagram.com/someaccount" }
```

### GET /api/linkedin/company
Get LinkedIn company data.
```
/api/linkedin/company?url=https://www.linkedin.com/company/apple/
```

### POST /api/leads/intro
Regenerate a personalised intro for one lead.
```json
{
  "name": "Arjun Mehta",
  "company": "FrameCraft Productions",
  "niche": "Video production",
  "location": "Mumbai, India",
  "painPoint": "No strong web presence...",
  "matchedServices": ["Web Dev", "Logo Design"],
  "tone": "Friendly and casual"
}
```

---

## Frontend
Point the Nexora Lead Finder app to your deployed backend URL.
Replace `BACKEND_URL` in the frontend with your Render URL.
