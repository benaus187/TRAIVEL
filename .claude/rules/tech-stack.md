---
description: Approved tech stack and dependencies for frontend and backend. Apply when adding libraries, choosing tools, or scaffolding code.
globs: ["frontend/**", "backend/**", "*.json", "*.toml", "requirements*.txt"]
alwaysApply: false
---

# Tech Stack

## Frontend (`frontend/`)

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| UI components | shadcn/ui — add via `npx shadcn@latest add [component]` |
| Server state | TanStack Query v5 |
| Client state | Zustand v5 |
| Maps | react-map-gl v8 + Mapbox GL JS v3 |
| Validation | Zod v3 |
| Auth client | @supabase/supabase-js v2 + @supabase/ssr |

**package.json versions:**
```json
"next": "^15", "react": "^19", "typescript": "^5",
"tailwindcss": "^4", "@tanstack/react-query": "^5",
"zustand": "^5", "react-map-gl": "^8", "mapbox-gl": "^3",
"@supabase/supabase-js": "^2", "@supabase/ssr": "^0", "zod": "^3"
```

## Backend (`backend/`)

| Layer | Choice |
|-------|--------|
| Framework | Python FastAPI + uvicorn |
| AI SDK | anthropic (official Python SDK) |
| Validation | Pydantic v2 |
| HTTP client | httpx (async) |
| DB client | supabase-py |

**requirements.txt:**
```
fastapi
uvicorn
anthropic
pydantic
httpx
pandas
supabase
```

## AI Models

- **Claude Opus 5** (`claude-opus-5`) — all coding and high-performance tasks: itinerary generation, tool_use structured output, trend scoring logic, verification orchestration
- **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) — lightweight tasks only: reason code labelling, short verification summaries, simple text transforms

## External Services

| Service | Purpose | Cost |
|---------|---------|------|
| Supabase Free | PostgreSQL + Google OAuth | $0 |
| Vercel Hobby | Frontend hosting | $0 |
| Mapbox | Maps (50K loads/mo free) | $0 |
| Google Places API (New) | Place verification + discovery (searchText) | pay-as-you-go, low volume |
| Open-Meteo | Weather forecast (no key needed) | $0 |
| Railway | FastAPI hosting | ~$5/mo |
| YouTube Data API v3 | Trend signals (trending videos per destination) | $0 (free quota) |
| Claude API | AI generation | ~$15–20/mo |
