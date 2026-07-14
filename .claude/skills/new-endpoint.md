---
description: Scaffold a new FastAPI endpoint for TRAIVEL following the project's patterns — Pydantic models, async httpx, Supabase caching, matching Zod schema on the frontend.
---

Scaffold a new FastAPI endpoint for TRAIVEL. Follow this exact pattern:

## Steps

1. **Define Pydantic models** in `backend/app/schemas/<domain>.py`:
   - Request model (if POST)
   - Response model with all fields typed
   - Use `str | None` not `Optional[str]`

2. **Create the route** in `backend/app/routers/<domain>.py`:
   ```python
   from fastapi import APIRouter
   import httpx
   from ..schemas.<domain> import <Request>, <Response>
   from ..db import supabase

   router = APIRouter(prefix="/api/<domain>", tags=["<domain>"])

   @router.post("/", response_model=<Response>)
   async def <endpoint_name>(<body>: <Request>) -> <Response>:
       # 1. Check cache in Supabase first
       # 2. Call external API with httpx async
       # 3. Write result to cache table
       # 4. Return typed response
   ```

3. **Register the router** in `backend/app/main.py`:
   ```python
   from .routers.<domain> import router as <domain>_router
   app.include_router(<domain>_router)
   ```

4. **Add matching Zod schema** in `frontend/src/lib/schemas/<domain>.ts`:
   ```ts
   import { z } from "zod"
   export const <Response>Schema = z.object({ ... })
   export type <Response> = z.infer<typeof <Response>Schema>
   ```

5. **Add to `.claude/rules/api-and-data-schemas.md`** — update the endpoints table.

## Constraints

- Always async (`async def`, `await httpx.AsyncClient`)
- Never use `requests` library — always `httpx`
- Cache external API responses to the matching Supabase `*_cache` table
- Model for Claude calls: `claude-opus-4-8` (generation) or `claude-haiku-4-5-20251001` (light)
