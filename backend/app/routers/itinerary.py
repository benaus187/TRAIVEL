import asyncio
import json
import urllib.parse
from datetime import date, timedelta
import anthropic
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..config import settings
from ..db import get_db
from ..services.places import search_place, discover_popular_places
from ..services.weather import get_trip_weather

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
                        "description": {"type": "string", "description": "1-2 sentence description of what to do and why, always ending with an estimated cost in USD (e.g. '~$15/person', 'Free', '~$80–120 for the activity')"},
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


def _build_prompt(
    brief: TripBrief,
    popular_places: list[dict] | None = None,
    weather_forecast: list[dict] | None = None,
) -> str:
    avoid_str = f"\nAvoid: {', '.join(brief.avoid)}" if brief.avoid else ""
    interests_str = ", ".join(brief.interests) if brief.interests else "general sightseeing"

    places_str = ""
    if popular_places:
        lines = []
        for p in popular_places[:6]:
            rating = f"★{p['rating']}" if p.get("rating") else ""
            reviews = f"· {p['review_count']:,} reviews" if p.get("review_count") else ""
            summary = f" — {p['summary']}" if p.get("summary") else ""
            lines.append(f"- {p['name']} {rating}{reviews}{summary}")
        places_str = f"""

Currently popular places people love in {brief.destination} (from Google Places, ranked by popularity):
{chr(10).join(lines)}

Prioritise including these places where they fit the traveller's interests. Assign "social momentum" reason code to stops from this list."""

    weather_str = ""
    if weather_forecast:
        start_date = brief.start_date or (date.today() + timedelta(days=7)).isoformat()
        lines = []
        for i, day in enumerate(weather_forecast[:brief.days]):
            d = date.fromisoformat(start_date) + timedelta(days=i)
            indoor_hint = " → plan indoor stops for this day" if day.get("bad_weather") else " → good for outdoor activities"
            temp = f"{round(day['temp_max'])}°C" if day.get("temp_max") is not None else ""
            lines.append(f"- Day {i+1} ({d.strftime('%a %b %d')}): {day['condition'].title()}{', ' + temp if temp else ''}{indoor_hint}")
        weather_str = f"""

Day-by-day weather forecast — structure each day's stops accordingly:
{chr(10).join(lines)}
On rainy/bad-weather days: prioritise indoor venues (museums, cafes, galleries, restaurants). On clear days: prioritise outdoor experiences."""

    return f"""Plan a {brief.days}-day trip to {brief.destination}.

Traveller profile:
- Interests: {interests_str}
- Daily budget: ${brief.budget_usd_per_day} USD
- Pace: {brief.pace}{avoid_str}{places_str}{weather_str}

Create a realistic, time-blocked itinerary. For each stop assign at least one reason code that genuinely applies:
- "social momentum" — trending or highly talked-about right now
- "transport fit" — easy to reach from previous stop
- "food fit" — a meal or drink stop that matches the interests/budget
- "budget fit" — free or low-cost, good for the stated budget
- "weather alternate ready" — has a nearby indoor fallback

Include 4–6 stops per day. Be specific: use real place names, not generic descriptions.
For every stop description, always include an estimated cost at the end (e.g. "~$25/person", "Free entry", "~$120 for the tour"). This helps the traveller budget their day."""


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
            start_date = brief.start_date or (date.today() + timedelta(days=7)).isoformat()

            # 1. Fetch popular places + weather BEFORE Claude — use both in prompt
            popular_places, weather_forecast = await asyncio.gather(
                discover_popular_places(brief.destination),
                get_trip_weather(brief.destination, start_date, brief.days),
            )

            if popular_places:
                yield f"data: {json.dumps({'type': 'trends', 'trends': popular_places})}\n\n"

            # 2. Generate itinerary with Claude — prompt includes places + weather
            message = client.messages.create(
                model="claude-opus-4-8",
                max_tokens=4096,
                tools=[ITINERARY_TOOL],
                tool_choice={"type": "tool", "name": "create_itinerary"},
                messages=[{"role": "user", "content": _build_prompt(brief, popular_places, weather_forecast)}],
            )

            collected_stops: list[dict] = []
            for block in message.content:
                if block.type == "tool_use":
                    collected_stops = block.input.get("stops", [])
                    for stop in collected_stops:
                        yield f"data: {json.dumps({'type': 'stop', 'stop': stop})}\n\n"
                        await asyncio.sleep(0.08)

            trip_id, itinerary_id = _save_to_supabase(brief, collected_stops)

            # 3. Verification phase — Google Places per stop + build booking URLs
            dest_lat: float | None = None
            dest_lon: float | None = None
            if collected_stops:
                yield f"data: {json.dumps({'type': 'verifying', 'total': len(collected_stops)})}\n\n"
                db = get_db()
                for i, stop in enumerate(collected_stops):
                    try:
                        place = await search_place(stop["name"], brief.destination)
                        maps_q = urllib.parse.quote_plus(f"{stop['name']}, {brief.destination}")
                        booking_url = f"https://www.google.com/maps/search/?q={maps_q}"
                        update: dict = {"booking_url": booking_url}
                        verified = False
                        place_id = None
                        stop_lat: float | None = None
                        stop_lon: float | None = None
                        if place and place.get("place_id"):
                            place_id = place["place_id"]
                            verified = True
                            stop_lat = place.get("lat")
                            stop_lon = place.get("lon")
                            update["place_id"] = place_id
                            update["verified"] = True
                            if stop_lat is not None:
                                update["lat"] = stop_lat
                            if stop_lon is not None:
                                update["lon"] = stop_lon
                            if dest_lat is None and stop_lat and stop_lon:
                                dest_lat, dest_lon = stop_lat, stop_lon
                        db.table("stops").update(update).eq("itinerary_id", itinerary_id).eq("position", i).execute()
                        yield f"data: {json.dumps({'type': 'verify', 'index': i, 'verified': verified, 'place_id': place_id, 'booking_url': booking_url, 'lat': stop_lat, 'lon': stop_lon})}\n\n"
                    except Exception:
                        pass
                    await asyncio.sleep(0.1)

            # 4. Emit weather (already fetched — re-geocode with verified coords if available)
            if weather_forecast is None and (dest_lat is not None):
                weather_forecast = await get_trip_weather(brief.destination, start_date, brief.days, dest_lat, dest_lon)
            if weather_forecast:
                yield f"data: {json.dumps({'type': 'weather', 'forecasts': weather_forecast})}\n\n"

            yield f"data: {json.dumps({'type': 'done', 'trip_id': trip_id, 'itinerary_id': itinerary_id})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
