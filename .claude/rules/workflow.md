---
description: Development workflow — how to approach tasks, branching, code style, and quality bar for TRAIVEL. Apply whenever writing or reviewing code.
alwaysApply: true
---

# Development Workflow

## Branch strategy (solo build)

- `main` — always deployable, mirrors production
- `feature/<phase>-<short-name>` — e.g. `feature/phase1-itinerary-stream`
- Commit directly to main only for Phase 0 scaffold

## Code quality bar (portfolio-grade)

- TypeScript strict mode — no `any`, no `as unknown`
- All API responses validated with Zod (frontend) / Pydantic (backend) at the boundary
- No unused imports or dead code committed
- Commit messages: imperative mood, present tense ("add", "fix", "wire") — not "added", "fixed"

## Task approach

1. Read the relevant rule files before writing code (`architecture.md`, `api-and-data-schemas.md`)
2. Prefer editing existing files over creating new ones
3. Do not add error handling for cases that can't happen — only validate at system boundaries (user input, external API responses)
4. Do not add abstractions beyond what the current phase needs

## Environment variables

- Never hardcode secrets — always read from `.env.local` (frontend) or `.env` (backend)
- Frontend env vars exposed to browser must be prefixed `NEXT_PUBLIC_`
- Backend env vars loaded via `python-dotenv` or Railway environment dashboard

## When adding a new FastAPI endpoint

1. Define the Pydantic request/response models first
2. Add the route to the router file (not directly in `main.py`)
3. Export the matching Zod schema in `frontend/src/lib/schemas/`
4. Add the endpoint to `.claude/rules/api-and-data-schemas.md`

## When adding a new UI component

1. Check shadcn/ui first — `npx shadcn@latest add [component]` before writing from scratch
2. Client components: add `"use client"` directive at top, keep as leaf nodes
3. Reason code chips: always use the canonical type values from `api-and-data-schemas.md`
