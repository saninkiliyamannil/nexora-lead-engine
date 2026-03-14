const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile';

function missingEnv(res, key) {
  return res.status(400).json({ error: `${key} not set in environment` });
}

// ── HEALTH CHECK ──
app.get('/', (req, res) => {
  res.json({ status: 'Nexora Lead Engine running', version: '1.0.0' });
});

// ── ROUTE 1: Find Instagram followers by niche username ──
// Used to find real accounts in a niche by scraping followers of a seed account
app.post('/api/instagram/followers', async (req, res) => {
  const { username, count = 20 } = req.body;
  if (!username) return res.status(400).json({ error: 'username required' });
  if (!RAPIDAPI_KEY) return missingEnv(res, 'RAPIDAPI_KEY');

  try {
    const response = await axios.post(
      'https://instagram-scraper-stable-api.p.rapidapi.com/get_ig_user_followers_v2.php',
      new URLSearchParams({ username, count: String(count) }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-rapidapi-host': 'instagram-scraper-stable-api.p.rapidapi.com',
          'x-rapidapi-key': RAPIDAPI_KEY,
        },
      }
    );
    res.json({ success: true, data: response.data });
  } catch (err) {
    res.status(500).json({ error: err.message, details: err.response?.data });
  }
});

// ── ROUTE 2: Get email from Instagram profile ──
app.post('/api/instagram/email', async (req, res) => {
  const { instagram_url } = req.body;
  if (!instagram_url) return res.status(400).json({ error: 'instagram_url required' });
  if (!RAPIDAPI_KEY) return missingEnv(res, 'RAPIDAPI_KEY');

  try {
    const response = await axios.post(
      'https://instagram-email-contact-finder.p.rapidapi.com/instagram/email',
      { url: instagram_url },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-host': 'instagram-email-contact-finder.p.rapidapi.com',
          'x-rapidapi-key': RAPIDAPI_KEY,
        },
      }
    );
    res.json({ success: true, data: response.data });
  } catch (err) {
    res.status(500).json({ error: err.message, details: err.response?.data });
  }
});

// ── ROUTE 3: Get LinkedIn company data ──
app.get('/api/linkedin/company', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });
  if (!RAPIDAPI_KEY) return missingEnv(res, 'RAPIDAPI_KEY');

  try {
    const response = await axios.get(
      'https://proxycurl.p.rapidapi.com/api/linkedin/company',
      {
        params: {
          url,
          extra: 'include',
          funding_data: 'include',
          acquisitions: 'include',
          use_cache: 'if-present',
          exit_data: 'include',
          categories: 'include',
        },
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-host': 'proxycurl.p.rapidapi.com',
          'x-rapidapi-key': RAPIDAPI_KEY,
        },
      }
    );
    res.json({ success: true, data: response.data });
  } catch (err) {
    res.status(500).json({ error: err.message, details: err.response?.data });
  }
});

// ── ROUTE 4: MASTER — Find + enrich + qualify leads (full pipeline) ──
app.post('/api/leads/generate', async (req, res) => {
  const { niche, location, count = 10, tone = 'Friendly and casual', seed_account } = req.body;

  if (!niche) return res.status(400).json({ error: 'niche required' });
  if (!GROQ_API_KEY) return missingEnv(res, 'GROQ_API_KEY');

  const results = [];
  const logs = [];

  try {
    // STEP 1: Get real Instagram followers from seed account
    logs.push(`Scanning Instagram followers of seed account: ${seed_account || getNicheSeed(niche)}`);
    const seedAccount = seed_account || getNicheSeed(niche);

    let igProfiles = [];
    try {
      const igRes = await axios.post(
        'https://instagram-scraper-stable-api.p.rapidapi.com/get_ig_user_followers_v2.php',
        new URLSearchParams({ username: seedAccount, count: String(Math.min(count * 3, 50)) }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'x-rapidapi-host': 'instagram-scraper-stable-api.p.rapidapi.com',
            'x-rapidapi-key': RAPIDAPI_KEY,
          },
        }
      );
      igProfiles = igRes.data?.followers || igRes.data?.data || [];
      logs.push(`Found ${igProfiles.length} raw Instagram profiles`);
    } catch (e) {
      logs.push(`Instagram scrape failed: ${e.message} — continuing with Claude-only mode`);
    }

    // STEP 2: For each profile, try to get email
    const enriched = [];
    for (const profile of igProfiles.slice(0, count)) {
      const handle = profile.username || profile.handle;
      if (!handle) continue;

      let email = null;
      try {
        const emailRes = await axios.post(
          'https://instagram-email-contact-finder.p.rapidapi.com/instagram/email',
          { url: `https://www.instagram.com/${handle}` },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-rapidapi-host': 'instagram-email-contact-finder.p.rapidapi.com',
              'x-rapidapi-key': RAPIDAPI_KEY,
            },
          }
        );
        email = emailRes.data?.email || emailRes.data?.emails?.[0] || null;
        logs.push(`Email found for @${handle}: ${email || 'none'}`);
      } catch (e) {
        logs.push(`Email lookup failed for @${handle}: ${e.message}`);
      }

      enriched.push({
        handle: `@${handle}`,
        full_name: profile.full_name || profile.name || '',
        bio: profile.biography || profile.bio || '',
        followers: profile.follower_count || profile.followers || 0,
        email,
      });

      // small delay to avoid rate limiting
      await sleep(300);
    }

    logs.push(`Enriched ${enriched.length} profiles with contact data`);

    // STEP 3: Send to Groq (Llama 3.3) for qualification + intro generation
    logs.push('Sending to Groq AI (Llama 3.3) for qualification and intro generation...');

    const groqPrompt = enriched.length > 0
      ? `You are a lead qualification expert for Nexora agency (buildwithnexora.netlify.app).
Nexora services: Logo Design, Content Writing, Programming, Ethical Hacking, Music Production, Video Production, Photo Editing, Graphic Design, Firewall Development, Web Development, Full Stack Development, Forex Trading.

Here are ${enriched.length} real Instagram profiles scraped for the niche "${niche}" in "${location}":
${JSON.stringify(enriched, null, 2)}

For each profile, create a qualified lead object. Return a JSON array only (no markdown, no explanation). Each object:
{
  "name": "inferred or from full_name",
  "title": "inferred job title",
  "company": "company name from bio or handle",
  "location": "${location}",
  "contact": "instagram handle",
  "contactType": "instagram",
  "email": "email if found or null",
  "painPoint": "25-35 word specific pain point Nexora solves",
  "matchedServices": ["2-4 relevant Nexora services"],
  "fitScore": 65-98,
  "intro": "90-120 word personalised outreach in ${tone} tone. Mention their handle/company, pain point, 2-3 services. Soft CTA. Sign off: — Nexora Team | buildwithnexora.netlify.app"
}`
      : `Generate ${count} realistic verified-style leads for niche "${niche}" in "${location}".
Nexora services: Logo Design, Content Writing, Programming, Ethical Hacking, Music Production, Video Production, Photo Editing, Graphic Design, Firewall Development, Web Development, Full Stack Development, Forex Trading.
Tone: ${tone}.
Return ONLY a JSON array (no markdown, no explanation). Each object: name, title, company, location, contact (instagram handle), contactType, email (null if unknown), painPoint (25-35 words), matchedServices (array), fitScore (65-98), intro (90-120 words, sign off: — Nexora Team | buildwithnexora.netlify.app)`;

    const groqRes = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: GROQ_MODEL,
        max_tokens: 4096,
        temperature: 0.7,
        messages: [
          { role: 'system', content: 'You are a lead generation expert. Always return valid JSON arrays only. No markdown, no explanation, no code blocks.' },
          { role: 'user', content: groqPrompt }
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
      }
    );

    const raw = groqRes.data.choices[0].message.content;
    const jsonStart = raw.indexOf('[');
    const jsonEnd = raw.lastIndexOf(']');
    const leads = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));

    logs.push(`Groq AI qualified and generated intros for ${leads.length} leads`);

    res.json({ success: true, leads, logs, total: leads.length });

  } catch (err) {
    res.status(500).json({ error: err.message, logs, stack: err.stack });
  }
});

// ── ROUTE 5: Generate personalised intro for a single lead ──
app.post('/api/leads/intro', async (req, res) => {
  const { name, company, niche, location, painPoint, matchedServices, tone } = req.body;
  if (!GROQ_API_KEY) return missingEnv(res, 'GROQ_API_KEY');

  try {
    const groqRes = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: GROQ_MODEL,
        max_tokens: 400,
        temperature: 0.7,
        messages: [
          { role: 'system', content: 'You write personalised outreach messages. Reply with just the message text, nothing else.' },
          { role: 'user', content: `Write a personalised outreach intro for ${name} at ${company} (${niche}, ${location}). Pain point: ${painPoint}. Nexora services to highlight: ${(matchedServices || []).join(', ')}. Tone: ${tone || 'Friendly and casual'}. 90-120 words. Genuine, no fluff. Soft CTA. Sign off: — Nexora Team | buildwithnexora.netlify.app` }
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
      }
    );

    const text = groqRes.data.choices[0].message.content.trim();
    res.json({ success: true, intro: text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── HELPERS ──
function getNicheSeed(niche) {
  const seeds = {
    'music': 'musicproductionindia',
    'video': 'videoproductionhouseindia',
    'forex': 'forextradingindian',
    'cyber': 'cybersecurityindia',
    'restaurant': 'restaurantownerindia',
    'ecommerce': 'ecommerceindia',
    'real estate': 'realestateindia',
    'fitness': 'fitnessbrandindia',
    'startup': 'startupindia',
    'tech': 'techindia',
  };
  const key = Object.keys(seeds).find(k => niche.toLowerCase().includes(k));
  return seeds[key] || 'businessindia';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Nexora Lead Engine running on port ${PORT}`));

