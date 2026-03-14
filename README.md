# Nexora Lead Engine - Backend

Real-time lead generation backend for Nexora agency.

## APIs Used
- Instagram User Info (RapidAPI) - fetches Instagram profile details by username or id
- Instagram Email Finder (RapidAPI) - extracts emails from profiles
- ProxyCurl (RapidAPI) - LinkedIn company enrichment
- Groq AI - qualifies leads and generates personalised intros

## Local Setup

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

## Deploy to Netlify

1. Push this repo to GitHub
2. In Netlify, choose `Add new site` -> `Import an existing project`
3. Select `saninkiliyamannil/nexora-lead-engine`
4. Leave the build command empty
5. Set the publish directory to `.`
6. Add environment variables:
- `GROQ_API_KEY`
- `RAPIDAPI_KEY`
7. Deploy the site

Netlify serves the frontend from the repo root and routes `/api/*` to the serverless function defined in `netlify/functions/api.js` through `netlify.toml`.

## Files for Netlify
- `app.js`: shared Express app used by local dev and Netlify Functions
- `server.js`: local Node entrypoint
- `netlify/functions/api.js`: Netlify function wrapper
- `netlify.toml`: publish/functions/redirect config
- `frontend.html`: frontend UI source
- `index.html`: Netlify default landing page entry

## Frontend
The frontend defaults to the current Netlify site URL. If you need to point it somewhere else, use the `Netlify Setup` tab in the UI.
