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
| **Social trend signal layer** | Google Places discovery + YouTube Data API v3 trending videos surface what's actually popular right now, streamed alongside the itinerary |

Premium subscribers ($9.99/mo or $79/yr, via Stripe) also get unlimited daily generations and a chat interface to iteratively edit a saved itinerary instead of regenerating from scratch.

---

## Architecture

```
Browser
  │
  ▼
┌─────────────────────────────────┐
│  Next.js 16 — Vercel (free)     │
│                                 │
│  /             Landing page     │
│  /plan         Trip brief form  │
│  /pricing      Premium upgrade  │
│  /trips        My Trips         │
│  /trips/:slug  Public share URL │
└──────────────┬──────────────────┘
               │ SSE stream (itinerary + trend signals)
               │ JSON REST (chat edits, billing, weather)
               │ Supabase client direct (auth, trips CRUD)
               ▼
┌─────────────────────────────────┐
│  FastAPI — Railway (~$5/mo)     │
│                                 │
│  POST /api/itinerary/generate       │◄─── Claude Opus 5, Google Places, YouTube Data API v3
│  POST /api/itinerary/{id}/chat      │◄─── Claude Opus 5 (Premium-only edit chat)
│  GET  /api/weather/{dest}/{date}    │◄─── Open-Meteo (free)
│  GET/POST /api/billing/{me,checkout,portal,webhook} │◄─── Stripe subscriptions
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Supabase — PostgreSQL + Auth   │
│                                 │
│  users · trips · itineraries    │
│  stops · place_cache            │
│  weather_cache · trend_cache    │
│  generation_usage               │
└─────────────────────────────────┘

Client-side only:
  Mapbox GL JS — map view, route polyline, numbered markers
```

### Why FastAPI is separate from Next.js

Railway supports persistent connections required for long-running SSE streams. Vercel serverless functions have a hard execution limit — Claude itinerary generation can exceed it. FastAPI also gives access to the Python AI/data ecosystem (Anthropic Python SDK, httpx for external API calls).

### Itinerary generation flow

```
User submits brief
      │
      ├─► Fetch popular places (Google Places Text Search)
      ├─► Fetch trending YouTube videos for the destination
      ├─► Fetch weather forecast (Open-Meteo geocode → forecast)
      │
      ▼
Claude Opus 5 — tool_use with forced JSON schema
  • Receives: destination, dates, interests, budget, pace, avoid list,
              popular places, trend signals, day-by-day weather forecast
  • Returns: structured stops with time, name, description, reason_codes
      │
      ├─► Per stop: Google Places search → verify existence + coordinates
      │
      ▼
SSE stream → Next.js EventSource → stops + trend panel render as they arrive
      │
      ▼
Save trip + itinerary + stops to Supabase
```

### Usage quota & Premium billing

`/api/itinerary/generate` enforces a daily quota, reserved atomically before the Claude call:

| Tier | Identified by | Limit |
|------|----------------|-------|
| Manager | email in `MANAGER_EMAILS` env var | unlimited |
| Premium | `users.plan = 'premium'` (Stripe-backed) | unlimited |
| Signed-in free | Supabase JWT | 5/day |
| Anonymous | IP + client-generated ID | 1/day |

Premium is a Stripe Checkout subscription ($9.99/mo or $79/yr) managed via the Stripe-hosted Billing Portal (no custom cancel/upgrade UI). Blocked requests return HTTP 429 with a structured `quota_exceeded` error the frontend renders inline.

---

## Tech stack

### Frontend
- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS v4** — Version A design tokens: Sora + Newsreader italic + IBM Plex Mono, coral `#e85d3d`
- **shadcn/ui** — button, badge, card, separator
- **TanStack Query v5** — server state + SSE stream management
- **Zustand v5** — client UI state
- **react-map-gl v8** + **Mapbox GL JS v3** — map view
- **Zod v3** — runtime validation of all API responses
- **@supabase/supabase-js v2** + **@supabase/ssr** — auth client
- **Vitest + React Testing Library** — hook unit tests (`use-auth`, `use-plan`)

### Backend
- **Python FastAPI** + uvicorn
- **anthropic** (official Python SDK)
- **Pydantic v2** — request/response schemas
- **httpx** — async HTTP client for external APIs
- **supabase-py** — DB client
- **stripe** (pinned `>=15,<16`) — Checkout Sessions, Billing Portal, webhook handling
- **pytest** — webhook + quota tier unit tests (fake Supabase client)

### AI models
- `claude-opus-5` — itinerary generation and chat-based edits (tool_use structured output)
- `claude-haiku-4-5-20251001` — lightweight tasks (reason code labelling, summaries)

### External services

| Service | Purpose | Cost |
|---------|---------|------|
| Supabase Free | PostgreSQL + Auth (Google OAuth + magic link) | $0 |
| Vercel Hobby | Frontend hosting | $0 |
| Mapbox | Maps (50K loads/mo free) | $0 |
| Google Places API (New) | Place verification + trend discovery | pay-as-you-go, low volume |
| YouTube Data API v3 | Trending-video trend signal | $0 (free quota) |
| Open-Meteo | Weather forecast (no API key needed) | $0 |
| Railway | FastAPI hosting | ~$5/mo |
| Stripe | Premium subscription billing | ~2.9% + $0.30/transaction |
| Claude API | AI generation | ~$15–20/mo |

---

## Project structure

```
traivel/
├── frontend/               # Next.js 16 — deployed to Vercel
│   └── src/
│       ├── app/
│       │   ├── page.tsx              # Landing page
│       │   ├── plan/page.tsx         # Trip brief form + itinerary view
│       │   ├── pricing/page.tsx      # Premium upgrade / manage subscription
│       │   ├── login/page.tsx        # Google OAuth + magic link
│       │   ├── trips/page.tsx        # My Trips dashboard
│       │   └── trips/[slug]/page.tsx # Public share URL
│       ├── components/
│       │   ├── stop-card.tsx         # Stop card with price, distance, buttons
│       │   ├── map-view.tsx          # Mapbox route + markers
│       │   ├── trend-panel.tsx       # YouTube + Places trend signals
│       │   ├── reason-code-chip.tsx
│       │   ├── chat-panel.tsx        # Premium itinerary edit chat
│       │   ├── nav.tsx
│       │   └── currency-selector.tsx
│       ├── hooks/
│       │   ├── use-itinerary-stream.ts   # SSE consumer
│       │   ├── use-itinerary-chat.ts     # Chat edit mutation
│       │   ├── use-plan.ts               # Premium plan/quota status
│       │   ├── use-plan.test.tsx
│       │   ├── use-auth.ts
│       │   └── use-auth.test.tsx
│       └── lib/schemas/
│           ├── itinerary.ts
│           ├── billing.ts
│           └── chat.ts
│
└── backend/                # FastAPI — deployed to Railway
    └── app/
        ├── main.py
        ├── config.py
        ├── db.py
        ├── routers/
        │   ├── itinerary.py   # POST /api/itinerary/generate (SSE)
        │   ├── chat.py        # POST /api/itinerary/{id}/chat
        │   ├── billing.py     # /api/billing/{me,checkout,portal,webhook}
        │   └── weather.py     # GET  /api/weather/{dest}/{date}
        ├── services/
        │   ├── places.py          # Google Places API (verify + discover)
        │   ├── youtube.py         # YouTube Data API v3 trending videos
        │   ├── weather.py         # Open-Meteo
        │   ├── quota.py           # Tiered daily generation quota
        │   ├── stripe_service.py  # Checkout/portal session creation
        │   └── itinerary_ops.py
        ├── schemas/stop.py    # Pydantic Stop + ReasonCode
        └── tests/              # pytest — webhook branches + quota tiers
```

---

## Data schema

### Stop (core unit of every itinerary)

```python
# Pydantic (backend/app/schemas/stop.py)
class Stop(BaseModel):
    time: str                          # "09:00"
    name: str
    description: str
    reason_codes: list[ReasonCode]
    place_id: str | None
    verified: bool
    weather_alternate: str | None
    transit_note: str | None
```

```typescript
// Zod (frontend/src/lib/schemas/itinerary.ts)
const StopSchema = z.object({
  time: z.string(),
  name: z.string(),
  description: z.string(),
  reason_codes: z.array(ReasonCodeSchema),
  place_id: z.string().nullable(),
  verified: z.boolean(),
  weather_alternate: z.string().nullable(),
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
users             -- Auth profiles; plan (free/premium), stripe_customer_id,
                   -- stripe_subscription_id, subscription_status
trips             -- destination, dates, brief, share_slug
itineraries       -- generated output linked to a trip
stops             -- individual stops with all fields above (+ day, lat/lon)
place_cache       -- Google Places responses keyed by place_id
weather_cache     -- Open-Meteo responses keyed by dest+date
trend_cache       -- YouTube/Places trend scores keyed by destination
generation_usage  -- daily per-identity generation counts (quota enforcement)
```

All tables use Row Level Security (RLS). Users can only read/write their own rows. Public share URLs are served via a `SECURITY DEFINER` function that bypasses RLS only for the share slug lookup. The `users.plan` column is writable only by the service role — a trigger reverts any client-side self-upgrade attempt.

---

## Local development

### Prerequisites
- Node.js 20+
- Python 3.12+
- A Supabase project (free tier)
- Anthropic API key
- Google Places API key (enable "Places API (New)" in Google Cloud Console)
- YouTube Data API v3 key
- Mapbox public token
- Stripe account (test mode) — Product + monthly/annual Price, webhook secret

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

### Testing

```bash
# Backend — pytest against a fake Supabase client
cd backend && pip install -r requirements-dev.txt && pytest

# Frontend — Vitest + React Testing Library
cd frontend && npm test
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
YOUTUBE_API_KEY=
ALLOWED_ORIGINS=http://localhost:3000
MANAGER_EMAILS=
FRONTEND_URL=http://localhost:3000
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_MONTHLY=
STRIPE_PRICE_ID_ANNUAL=
```

---

## Build phases

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Monorepo scaffold, Supabase schema, deploy shell | ✅ Done |
| 1 | Trip brief form, Claude SSE streaming, reason code chips | ✅ Done |
| 2 | Google Places verification, weather-structured days | ✅ Done |
| 3 | Trend signals (Google Places discovery + YouTube Data API v3) | ✅ Done |
| 4 | Mapbox map view, route polyline, day tabs | ✅ Done |
| 5 | Supabase Auth (Google OAuth + magic link), My Trips, public share URL | ✅ Done |
| 6 | Version A design system, landing page, stop card polish | ✅ Done |

All 6 phases are complete and merged to `main`. Post-launch work: Claude Opus 5 model upgrade + tiered generation quota, Stripe Premium subscription billing, chat-based itinerary editing for Premium users, and the first automated test suite (pytest + Vitest).
