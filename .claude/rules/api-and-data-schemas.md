---
description: FastAPI endpoint contracts, data schemas (Stop, Supabase tables), and Claude tool_use integration pattern. Apply when writing backend routes, Pydantic models, Zod schemas, or Claude prompts.
globs: ["backend/**", "frontend/src/**/*.ts", "frontend/src/**/*.tsx"]
alwaysApply: false
---

# API Contracts & Data Schemas

## FastAPI Endpoints

| Method | Path | Integration |
|--------|------|-------------|
| POST | `/api/itinerary/generate` | Claude Opus 5 `tool_use` → SSE stream. Google Places verification + YouTube trend signals happen **inline** during this call (see below), not as separate requests |
| GET | `/api/weather/{dest}/{date}` | Open-Meteo → writes to `weather_cache` |
| POST | `/api/places/verify` | Orphaned stub (`backend/app/routers/places.py`) — returns a placeholder, not called by frontend. Real place verification is `services/places.py` (Google Places `searchText`), called inline from `/api/itinerary/generate` |
| GET | `/api/trends/{destination}` | Orphaned (`backend/app/routers/trends.py`, uses HackerNews + Wikipedia) — not called by frontend. Real trend signal is `services/youtube.py` (YouTube Data API v3), called inline from `/api/itinerary/generate` and streamed as an SSE `trends` event |

## Claude Integration Pattern

- **Model for itinerary generation:** `claude-opus-5` (high-performance, structured output)
- **Model for light tasks:** `claude-haiku-4-5-20251001` (reason code labelling, summaries)

Use `tool_use` with `tool_choice: {"type": "tool"}` to force structured JSON — never plain text completion for itinerary output.

Responses stream from FastAPI → Next.js via **SSE**. The frontend uses TanStack Query + an EventSource to consume the stream and progressively render stops.

## Usage Quota

`/api/itinerary/generate` enforces a daily generation quota, checked (and reserved atomically via `increment_generation_usage` RPC) before the Claude API call:

| Tier | Identified by | Limit |
|------|----------------|-------|
| Manager | email in `MANAGER_EMAILS` env var | unlimited |
| Premium | `users.plan = 'premium'` | unlimited |
| Signed-in free | Supabase JWT `sub` | 5/day |
| Anonymous | `X-Forwarded-For` IP + `X-Anon-Id` header | 1/day |

Blocked requests return **HTTP 429** with body `{"detail": {"error": "quota_exceeded", "tier", "limit", "used", "reset_at", "message"}}` (see `QuotaExceededSchema` in `frontend/src/lib/schemas/itinerary.ts`).

## Stop Schema

**Pydantic (backend):**
```python
class Stop(BaseModel):
    time: str                          # "09:00"
    name: str
    description: str
    reason_codes: list[ReasonCode]
    place_id: str | None
    verified: bool
    weather_alternate: str | None
```

**Zod (frontend):**
```ts
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

**Reason code values (enum):**
`social momentum` · `transport fit` · `food fit` · `budget fit` · `weather alternate ready`

## Supabase Tables

| Table | Purpose |
|-------|---------|
| `users` | Auth profiles. `plan` column (`free`/`premium`) gates unlimited quota — writable only by service role / dashboard, protected by a trigger that reverts client-side self-upgrades |
| `trips` | Trip metadata (destination, dates, brief) |
| `itineraries` | Generated itinerary per trip |
| `stops` | Individual stops belonging to an itinerary |
| `place_cache` | Google Places responses keyed by place_id |
| `weather_cache` | Open-Meteo responses keyed by dest+date |
| `trend_cache` | YouTube trending-video scores keyed by `youtube:{destination}` (also holds unused HackerNews/Wikipedia entries from the orphaned `/api/trends` route) |
| `generation_usage` | Daily per-identity generation counter (quota enforcement) |

All tables use Row Level Security (RLS). Users can only read/write their own rows.
