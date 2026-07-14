---
description: Build roadmap — 6 phases with scope and timeline. Apply when deciding what to implement next, scoping a task, or checking if something is in scope for the current phase.
alwaysApply: true
---

# Build Phases

**Current phase: 1 — Phase 0 completed 2026-07-15.**

| Phase | Scope | Timeline |
|-------|-------|----------|
| **0** | Monorepo init (`frontend/` + `backend/`), neutral shell (nav + layout, no color), Supabase schema + RLS, Vercel + Railway deploy, GitHub repo | Week 1–2 |
| **1** | Trip brief form (destination, dates, interests, budget, pace, avoid) · FastAPI `/api/itinerary/generate` · Claude Sonnet streaming · reason code chips · Regenerate button · save to Supabase | Week 3–5 |
| **2** | Verification layer: Foursquare (hours) + Open-Meteo (weather) · pass results to Claude context · `hours verified` / `weather alternate ready` badges | Week 6–7 |
| **3** | Trend signals: X API by hashtag · volume + recency + engagement scoring · sponsored content filter · trend panel UI with bar chart | Week 8–9 |
| **4** | Map view: Mapbox polyline · numbered time-labelled markers · split view (itinerary + map) | Week 10 |
| **5** | Supabase Auth (Google OAuth + magic link) · My Trips dashboard · public share URL (important for CV demo) | Week 11 |
| **6** | Final visual direction (1a/1b/1c) wired into Tailwind config · Unsplash photos · landing page · "Why this plan" Claude summary block · loading skeletons · SEO metadata · README with architecture diagram | Week 12–14 |

## Phase 0 Checklist — COMPLETED 2026-07-15

- [x] Next.js 15 scaffolded in `frontend/` (TypeScript, Tailwind v4, App Router, src/)
- [x] Dependencies: TanStack Query, Zustand, react-map-gl, mapbox-gl, Supabase JS, Zod
- [x] shadcn/ui initialized (button, badge, card, separator)
- [x] FastAPI scaffold in `backend/` — routers, schemas, Dockerfile, requirements.txt
- [x] Supabase schema SQL at `backend/supabase/schema.sql` (7 tables + RLS + trigger)
- [x] Neutral shell live at localhost:3000 — wordmark nav, hero, reason code badges, placeholder cards
- [ ] **TODO (manual):** Push to GitHub, connect Vercel to `frontend/`, connect Railway to `backend/`
- [ ] **TODO (manual):** Run `backend/supabase/schema.sql` in Supabase SQL Editor
- [ ] Choose visual direction 1a / 1b / 1c — defer to after Phase 1 prototype

## Phase 1 Next Steps

- Trip brief form: destination, dates, interests, budget, pace, avoid
- FastAPI `POST /api/itinerary/generate` → Claude Opus 4.8 `tool_use` → SSE stream
- Frontend nhận stream → render stops theo thời gian thực
- Reason code chips có màu theo type
- Regenerate button + lưu vào Supabase
