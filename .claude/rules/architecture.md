---
description: System architecture, deployment topology, and why FastAPI is a separate service. Apply when making decisions about where code lives or how services communicate.
alwaysApply: true
---

# Architecture

## Deployment topology

```
Browser
  └─▶ Next.js frontend — Vercel Hobby (free)
        └─▶ FastAPI backend — Railway (~$5/mo)
              ├─▶ Supabase PostgreSQL (free tier)
              ├─▶ Claude API (Opus 5 / Haiku)
              ├─▶ Google Places API
              ├─▶ Open-Meteo
              ├─▶ YouTube Data API v3
              └─▶ Mapbox (client-side only)
```

## Monorepo structure

```
C:\Project_Travel\
├── frontend/    # Next.js 16 — deployed independently to Vercel
└── backend/     # Python FastAPI — deployed independently to Railway
```

No shared build tooling between the two. Each has its own dependencies and deploy pipeline.

## Why FastAPI is separate (not Next.js API routes)

Railway supports persistent connections needed for long-running SSE streams. Vercel serverless functions have an 800 s execution limit — Claude itinerary generation + streaming can exceed this. FastAPI on Railway also gives access to the Python AI/data ecosystem (Anthropic Python SDK, httpx for external API calls).

## Frontend ↔ Backend communication

- Next.js calls FastAPI endpoints directly (not through Vercel rewrites)
- Itinerary generation uses **SSE (Server-Sent Events)** so the user sees stops appearing in real time
- All other calls are standard JSON REST
