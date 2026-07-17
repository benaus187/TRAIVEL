import asyncio
import json
from datetime import date, timedelta
import anthropic
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..config import settings
from ..db import get_db
from ..services.places import search_place
from ..services.weather import get_trip_weather
from ..services.trends import fetch_trends

router = APIRouter(prefix="/api/itinerary", tags=["itinerary"])

_client: anthropic.Anthropic | None = None


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return _client


ITINERARY_TOOL: anthropic.types.ToolParam = {
    "name": "create_itinerary",
    "description": "Create a structured travel itinerary with time-blocked stops and reason codes for each stop.",
    "input_schema": {
        "type": "object",
        "properties": {
            "stops": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "time": {"type": "string", "description": "Time in HH:MM format, e.g. 09:00"},
                        "name": {"type": "string", "description": "Name of the place or activity"},
                        "description": {"type": "string", "description": "1-2 sentence description of what to do and why"},
                        "reason_codes": {
                            "type": "array",
                            "items": {
                                "type": "string",
                                "enum": [
                                    "social momentum",
                                    "transport fit",
                                    "food fit",
                                    "budget fit",
                                    "weather alternate ready",
                                ],
                            },
                            "minItems": 1,
                        },
                        "place_id": {"type": "string", "description": "Foursquare place ID if known, otherwise null"},
                        "verified": {"type": "boolean", "description": "Always false at generation time — set by verification layer"},
                        "weather_alternate": {"type": "string", "description": "Indoor alternative if weather is bad, or null"},
                    },
                    "required": ["time", "name", "description", "reason_codes", "verified"],
                },
            }
        },
        "required": ["stops"],
    },
}


class TripBrief(BaseModel):
    destination: str
    days: int
    start_date: str | None = None  # ISO date, e.g. "2026-07-24"
    interests: list[str]
    budget_usd_per_day: int = 100
    pace: str
    avoid: list[str] = []


def _build_prompt(brief: TripBrief, trends: list[dict] | None = None) -> str:
    avoid_str = f"\nAvoid: {', '.join(brief.avoid)}" if brief.avoid else ""
    interests_str = ", ".join(brief.interests) if brief.interests else "general sightseeing"

    trend_str = ""
    if trends:
        snippets = [f'- "{t["text"][:120]}" (score: {t["score"]})' for t in trends[:5]]
        trend_str = f"""

Current social trend signals for {brief.destination} (filtered, scored by recency × engagement):
{chr(10).join(snippets)}

Prioritise places that appear in trend signals with reason code "social momentum"."""

    return f"""Plan a {brief.days}-day trip to {brief.destination}.

Traveller profile:
- Interests: {interests_str}
- Daily budget: ${brief.budget_usd_per_day} USD
- Pace: {brief.pace}{avoid_str}{trend_str}

Create a realistic, time-blocked itinerary. For each stop assign at least one reason code that genuinely applies:
- "social momentum" — trending or highly talked-about right now
- "transport fit" — easy to reach from previous stop
- "food fit" — a meal or drink stop that matches the interests/budget
- "budget fit" — free or low-cost, good for the stated budget
- "weather alternate ready" — has a nearby indoor fallback

Include 4–6 stops per day. Be specific: use real place names, not generic descriptions."""


def _save_to_supabase(brief: TripBrief, stops: list[dict]) -> tuple[str, str]:
    db = get_db()

    trip = (
        db.table("trips")
        .insert({
            "destination": brief.destination,
            "days": brief.days,
            "interests": brief.interests,
            "budget": f"${brief.budget_usd_per_day}/day",
            "pace": brief.pace,
            "avoid": brief.avoid,
        })
        .execute()
    )
    trip_id: str = trip.data[0]["id"]

    itinerary = (
        db.table("itineraries")
        .insert({"trip_id": trip_id, "version": 1})
        .execute()
    )
    itinerary_id: str = itinerary.data[0]["id"]

    rows = [
        {
            "itinerary_id": itinerary_id,
            "position": i,
            "time": s.get("time", ""),
            "name": s.get("name", ""),
            "description": s.get("description", ""),
            "reason_codes": s.get("reason_codes", []),
            "place_id": s.get("place_id"),
            "verified": s.get("verified", False),
            "weather_alternate": s.get("weather_alternate"),
        }
        for i, s in enumerate(stops)
    ]
    db.table("stops").insert(rows).execute()

    return trip_id, itinerary_id


@router.post("/generate")
async def generate_itinerary(brief: TripBrief) -> StreamingResponse:
    async def stream():
        try:
            client = get_client()

            # Fetch trend signals first — inject into prompt, emit to frontend
            trends = await fetch_trends(brief.destination)
            if trends:
                yield f"data: {json.dumps({'type': 'trends', 'trends': trends})}\n\n"

            message = client.messages.create(
                model="claude-opus-4-8",
                max_tokens=4096,
                tools=[ITINERARY_TOOL],
                tool_choice={"type": "tool", "name": "create_itinerary"},
                messages=[{"role": "user", "content": _build_prompt(brief, trends)}],
            )

            collected_stops: list[dict] = []
            for block in message.content:
                if block.type == "tool_use":
                    collected_stops = block.input.get("stops", [])
                    for stop in collected_stops:
                        yield f"data: {json.dumps({'type': 'stop', 'stop': stop})}\n\n"
                        await asyncio.sleep(0.08)

            trip_id, itinerary_id = _save_to_supabase(brief, collected_stops)

            # Verification phase — Foursquare
            dest_lat: float | None = None
            dest_lon: float | None = None
            if collected_stops:
                yield f"data: {json.dumps({'type': 'verifying', 'total': len(collected_stops)})}\n\n"
                db = get_db()
                for i, stop in enumerate(collected_stops):
                    place = await search_place(stop["name"], brief.destination)
                    if place and place.get("place_id"):
                        db.table("stops").update({
                            "place_id": place["place_id"],
                            "verified": True,
                        }).eq("itinerary_id", itinerary_id).eq("position", i).execute()
                        yield f"data: {json.dumps({'type': 'verify', 'index': i, 'place_id': place['place_id'], 'verified': True, 'hours': place.get('hours_display'), 'open_now': place.get('open_now')})}\n\n"
                        # Capture coordinates from first verified stop for accurate weather
                        if dest_lat is None and place.get("lat") and place.get("lon"):
                            dest_lat = place["lat"]
                            dest_lon = place["lon"]
                    await asyncio.sleep(0.05)

            # Weather phase — Open-Meteo (use Google Places coords if available)
            start = brief.start_date or (date.today() + timedelta(days=7)).isoformat()
            forecasts = await get_trip_weather(brief.destination, start, brief.days, dest_lat, dest_lon)
            if forecasts:
                yield f"data: {json.dumps({'type': 'weather', 'forecasts': forecasts})}\n\n"

            yield f"data: {json.dumps({'type': 'done', 'trip_id': trip_id, 'itinerary_id': itinerary_id})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
