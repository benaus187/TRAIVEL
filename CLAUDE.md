# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**TRAIVEL** — AI-powered travel planning web app. Monorepo: `frontend/` (Next.js 15, Vercel) + `backend/` (Python FastAPI, Railway).

Detailed rules are split into `.claude/rules/`:

| File | Covers |
|------|--------|
| `project-overview.md` | Product identity, 3 differentiators, CV hook |
| `architecture.md` | Deployment topology, why FastAPI is separate, SSE streaming |
| `tech-stack.md` | All approved libraries and versions (frontend + backend) |
| `api-and-data-schemas.md` | FastAPI endpoints, Stop schema, Supabase tables, Claude tool_use pattern |
| `build-phases.md` | 6-phase roadmap, current phase, Phase 0 checklist |
| `design-directions.md` | Visual directions 1a/1b/1c, shared tokens, UI patterns |
