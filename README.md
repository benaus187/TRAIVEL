# TRAIVEL

AI-powered travel planning that shows its work.

Unlike itineraries from ChatGPT or hallucinated information, TRAIVEL verifies each stop with real data and tells you **why** each place was chosen.

---

## What makes it different

Most AI travel tools generate a list of places and hope for the best. TRAIVEL does three things no single competitor currently does together:

| Feature | How it works |
|---------|-------------|
| **Reason codes per stop** | Every stop is tagged with structured chips: `social momentum` · `transport fit` · `food fit` · `budget fit` · `weather alternate ready` |
| **Verification baked into generation** | Google Places and Open-Meteo are called *during* Claude's tool_use pass — not as a post-processing step |
| **Weather-structured days** | Forecast is fetched before Claude runs. Rainy days get indoor stops; sunny days get outdoor activities |

---

## Architecture

```
Browser
  │
  ▼
┌─────────────────────────────────┐
│  Next.js 15 — Vercel (free)     │
│                                 │
│  /           Landing page       │
│  /plan       Trip brief form    │
│  /trips      My Trips dashboard │
│  /trips/:slug  Public share URL │
└──────────────┬──────────────────┘
               │ SSE stream (itinerary)
               │ JSON REST (auth, trips)
               ▼
┌─────────────────────────────────┐
│  FastAPI — Railway (~$5/mo)     │
│                                 │
│  POST /api/itinerary/generate   │◄─── Claude Opus 4.8
│  POST /api/places/verify        │◄─── Google Places API
│  GET  /api/weather/{dest}/{dt}  │◄─── Open-Meteo (free)
│  GET  /api/trends/{destination} │◄─── Wikipedia pageviews
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Supabase — PostgreSQL          │
│                                 │
│  users · trips · itineraries    │
│  stops · place_cache            │
│  weather_cache · trend_cache    │
└─────────────────────────────────┘

Client-side only:
  Mapbox GL JS — map view, route polyline, numbered markers
```

### Why FastAPI is separate from Next.js

Railway supports persistent connections required for long-running SSE streams. Vercel serverless functions have a hard execution limit — Claude itinerary generation can exceed it. FastAPI also gives access to the Python AI/data ecosystem (Anthropic Python SDK, pandas for trend scoring).

### Itinerary generation flow

```
User submits brief
      │
      ├─► Fetch popular places (Google Places Text Search)
      ├─► Fetch weather forecast (Open-Meteo geocode → forecast)
      │
      ▼
Claude Opus 4.8 — tool_use with forced JSON schema
  • Receives: destination, dates, interests, budget, pace, avoid list,
              popular places, day-by-day weather forecast
  • Returns: structured stops with time, name, description, reason_codes
      │
      ├─► Per stop: Google Places search → verify existence + coordinates
      │
      ▼
SSE stream → Next.js EventSource → stops render as they arrive
      │
      ▼
Save trip + itinerary + stops to Supabase
```

---

## Tech stack

### Frontend
- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS v4** — Version A design tokens: Sora + Newsreader italic + IBM Plex Mono, coral `#e85d3d`
- **shadcn/ui** — button, badge, card, separator
- **TanStack Query v5** — server state + SSE stream management
- **Zustand v5** — client UI state
- **react-map-gl v8** + **Mapbox GL JS v3** — map view
- **Zod v3** — runtime validation of all API responses
- **@supabase/supabase-js v2** + **@supabase/ssr** — auth client

### Backend
- **Python FastAPI** + uvicorn
- **anthropic** (official Python SDK)
- **Pydantic v2** — request/response schemas
- **httpx** — async HTTP client for external APIs
- **supabase-py** — DB client

### AI models
- `claude-opus-4-8` — itinerary generation (tool_use structured output)
- `claude-haiku-4-5-20251001` — lightweight tasks (reason code labelling, summaries)

### External services

| Service | Purpose | Cost |
|---------|---------|------|
| Supabase Free | PostgreSQL + Google OAuth | $0 |
| Vercel Hobby | Frontend hosting | $0 |
| Mapbox | Maps (50K loads/mo free) | $0 |
| Google Places API | Place verification + popular attractions | $0 (5K calls/mo free) |
| Open-Meteo | Weather forecast (no API key needed) | $0 |
| Railway | FastAPI hosting | ~$5/mo |
| Claude API | AI generation | ~$15–20/mo |

**Total: ~$20–25/month**

---

## Project structure

```
traivel/
├── frontend/               # Next.js 15 — deployed to Vercel
│   └── src/
│       ├── app/
│       │   ├── page.tsx            # Landing page
│       │   ├── plan/page.tsx       # Trip brief form + itinerary view
│       │   ├── trips/page.tsx      # My Trips dashboard
│       │   └── trips/[slug]/page.tsx  # Public share URL
│       ├── components/
│       │   ├── stop-card.tsx       # Stop card with price, distance, buttons
│       │   ├── map-view.tsx        # Mapbox route + markers
│       │   ├── trend-panel.tsx     # Popular places panel
│       │   └── reason-code-chip.tsx
│       ├── hooks/
│       │   ├── use-itinerary-stream.ts   # SSE consumer
│       │   └── use-auth.ts
│       └── lib/schemas/itinerary.ts      # Zod schemas
│
└── backend/                # FastAPI — deployed to Railway
    └── app/
        ├── main.py
        ├── config.py
        ├── db.py
        ├── routers/
        │   ├── itinerary.py   # POST /api/itinerary/generate (SSE)
        │   ├── places.py      # POST /api/places/verify
        │   ├── weather.py     # GET  /api/weather/{dest}/{date}
        │   └── trends.py      # GET  /api/trends/{destination}
        ├── services/
        │   ├── places.py      # Google Places API
        │   └── weather.py     # Open-Meteo
        └── schemas/stop.py    # Pydantic Stop + ReasonCode
```

---

## Data schema

### Stop (core unit of every itinerary)

```typescript
// Zod (frontend)
const StopSchema = z.object({
  day:              z.number(),
  time:             z.string(),           // "09:00"
  name:             z.string(),
  description:      z.string(),
  reason_codes:     z.array(ReasonCodeSchema),
  place_id:         z.string().nullable(),
  verified:         z.boolean(),
  weather_alternate: z.string().nullable(),
  lat:              z.number().nullable(),
  lon:              z.number().nullable(),
})
```

### Reason codes

| Code | Meaning |
|------|---------|
| `social momentum` | Trending or highly rated locally |
| `transport fit` | Easy to reach from previous stop |
| `food fit` | Matches dietary or food preferences |
| `budget fit` | Within the stated daily budget |
| `weather alternate ready` | Indoor option for a rainy-day swap |

---

## Supabase schema

```sql
users         -- Auth profiles (managed by Supabase Auth)
trips         -- destination, dates, brief, share_slug
itineraries   -- generated output linked to a trip
stops         -- individual stops with all fields above
place_cache   -- Google Places responses keyed by place_id
weather_cache -- Open-Meteo responses keyed by dest+date
trend_cache   -- Trend scores keyed by destination
```

All tables use Row Level Security (RLS). Users can only read/write their own rows. Public share URLs are served via a `SECURITY DEFINER` function that bypasses RLS only for the share slug lookup.

---

## Local development

### Prerequisites
- Node.js 20+
- Python 3.12+
- A Supabase project (free tier)
- Anthropic API key
- Google Places API key (enable "Places API (New)" in Google Cloud Console)
- Mapbox public token

### Frontend

```bash
cd frontend
cp .env.local.example .env.local   # fill in NEXT_PUBLIC_* values
npm install
npm run dev                         # http://localhost:3000
```

### Backend

```bash
cd backend
cp .env.example .env               # fill in API keys
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Environment variables

**`frontend/.env.local`**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_MAPBOX_TOKEN=
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**`backend/.env`**
```
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
GOOGLE_PLACES_API_KEY=
```

---

## Build phases

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Monorepo scaffold, Supabase schema, deploy shell | ✅ Done |
| 1 | Trip brief form, Claude SSE streaming, reason code chips | ✅ Done |
| 2 | Google Places verification, weather-structured days | ✅ Done |
| 3 | Trend signals (popular places via Google Places) | ✅ Done |
| 4 | Mapbox map view, route polyline, day tabs | ✅ Done |
| 5 | Supabase Auth (Google OAuth), My Trips, public share URL | ✅ Done |
| 6 | Version A design system, landing page, stop card polish | ✅ Done |
