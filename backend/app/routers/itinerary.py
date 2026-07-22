import asyncio
import base64
import json
import secrets
import string
import urllib.parse
from datetime import date, timedelta
import anthropic
from fastapi import APIRouter, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..config import settings
from ..db import get_db
from ..services.places import search_place, discover_popular_places
from ..services.weather import get_trip_weather

router = APIRouter(prefix="/api/itinerary", tags=["itinerary"])


def _extract_user_id(authorization: str | None) -> str | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        payload_b64 = authorization[7:].split(".")[1]
        payload_b64 += "=" * (4 - len(payload_b64) % 4)
        payload = json.loads(base64.b64decode(payload_b64))
        return payload.get("sub")
    except Exception:
        return None


def _generate_share_slug() -> str:
    alphabet = string.ascii_lowercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(10))

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
                        "day": {"type": "integer", "description": "Day number starting from 1, e.g. 1 for Day 1, 2 for Day 2"},
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
                        "transit_note": {"type": "string", "description": "How to travel from the previous stop to this one (null for first stop of each day). E.g. 'Take Metro Line 2 from Shinjuku to Harajuku (~5 min, ¥170)' or 'Walk 12 min south along the river'."},
                    },
                    "required": ["day", "time", "name", "description", "reason_codes", "verified"],
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
    budget_usd_total: int = 0
    currency: str = "USD"
    pace: str
    avoid: list[str] = []
    transport_mode: str = "public_transport"  # "public_transport" | "walking" | "any"
    include_accommodation: bool = False
    flight_notes: str | None = None


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

    transport_labels = {
        "public_transport": "public transport (metro, bus, tram)",
        "walking": "walking only",
        "any": "any mode (walking, public transport, or taxi)",
    }
    transport_label = transport_labels.get(brief.transport_mode, "public transport")

    accommodation_str = ""
    if brief.include_accommodation and brief.days > 1:
        accommodation_str = f"""

Accommodation: After the last activity stop of each day except the final day, add one extra stop:
- name: "Overnight — [neighbourhood name]"
- time: ~1 hour after the last activity stop of that day
- description: Suggest a specific neighbourhood to stay in. Include budget range (~X–Y {brief.currency}/night for hostels/budget hotels) and mid-range range (~A–B {brief.currency}/night). Add 1–2 sentences on why the area is convenient for the next day's plan.
- reason_codes: ["budget fit"]
- transit_note: null"""

    flight_str = ""
    if brief.flight_notes:
        flight_str = f"""

Flight information provided by traveller:
{brief.flight_notes}
Use this to constrain the schedule: don't plan activity stops before the arrival (allow 90 min immigration/luggage buffer), and end the last day's itinerary at least 3 hours before departure."""

    per_day = brief.budget_usd_total // max(brief.days, 1)
    currency_str = ""
    if brief.currency != "USD":
        currency_str = f"Generate all prices in {brief.currency}. "

    return f"""Plan a {brief.days}-day trip to {brief.destination}.

Traveller profile:
- Interests: {interests_str}
- Total trip budget: ${brief.budget_usd_total} USD (~${per_day}/day). {currency_str}Plan stops, meals, and transport to stay within this total.
- Pace: {brief.pace}
- Preferred transport: {transport_label}{avoid_str}{flight_str}{places_str}{weather_str}{accommodation_str}

Create a realistic, time-blocked itinerary across exactly {brief.days} day(s). For each stop:
- Set the `day` field to 1 for Day 1, 2 for Day 2, etc. (required)
- Assign at least one reason code that genuinely applies:
  - "social momentum" — trending or highly talked-about right now
  - "transport fit" — easy to reach from previous stop
  - "food fit" — a meal or drink stop that matches the interests/budget
  - "budget fit" — free or low-cost, good for the stated budget
  - "weather alternate ready" — has a nearby indoor fallback
- Fill transit_note for every stop EXCEPT the first stop of each day. Use {transport_label}. Be specific: include line/route name, approx time, and fare if applicable.

Include 4–6 activity stops per day. Be specific: use real place names, not generic descriptions.
For every stop description, always include an estimated cost at the end (e.g. "~25 {brief.currency}/person", "Free entry", "~120 {brief.currency} for the tour"). This helps the traveller budget their day."""


def _save_to_supabase(brief: TripBrief, stops: list[dict], user_id: str | None = None) -> tuple[str, str, str | None]:
    db = get_db()

    trip_row: dict = {
        "destination": brief.destination,
        "days": brief.days,
        "interests": brief.interests,
        "budget": f"${brief.budget_usd_total} total",
        "pace": brief.pace,
        "avoid": brief.avoid,
    }
    effective_user_id = user_id
    if user_id:
        trip_row["user_id"] = user_id

    try:
        trip = db.table("trips").insert(trip_row).execute()
    except Exception:
        # FK violation: public.users row missing for this user — save anonymously
        trip_row.pop("user_id", None)
        effective_user_id = None
        trip = db.table("trips").insert(trip_row).execute()
    trip_id: str = trip.data[0]["id"]

    share_slug: str | None = _generate_share_slug() if effective_user_id else None
    itinerary = (
        db.table("itineraries")
        .insert({"trip_id": trip_id, "version": 1, "share_slug": share_slug})
        .execute()
    )
    itinerary_id: str = itinerary.data[0]["id"]

    rows = [
        {
            "itinerary_id": itinerary_id,
            "position": i,
            "day": s.get("day", 1),
            "time": s.get("time", ""),
            "name": s.get("name", ""),
            "description": s.get("description", ""),
            "reason_codes": s.get("reason_codes", []),
            "place_id": s.get("place_id"),
            "verified": s.get("verified", False),
            "weather_alternate": s.get("weather_alternate"),
            "transit_note": s.get("transit_note"),
        }
        for i, s in enumerate(stops)
    ]
    if rows:
        db.table("stops").insert(rows).execute()

    return trip_id, itinerary_id, share_slug


@router.post("/generate")
async def generate_itinerary(brief: TripBrief, authorization: str | None = Header(default=None)) -> StreamingResponse:
    user_id = _extract_user_id(authorization)

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
                max_tokens=8192,
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

            trip_id, itinerary_id, share_slug = _save_to_supabase(brief, collected_stops, user_id)

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
                    await asyncio.sleep(0.5)

            # 4. Emit weather (already fetched — re-geocode with verified coords if available)
            if weather_forecast is None and (dest_lat is not None):
                weather_forecast = await get_trip_weather(brief.destination, start_date, brief.days, dest_lat, dest_lon)
            if weather_forecast:
                yield f"data: {json.dumps({'type': 'weather', 'forecasts': weather_forecast})}\n\n"

            yield f"data: {json.dumps({'type': 'done', 'trip_id': trip_id, 'itinerary_id': itinerary_id, 'share_slug': share_slug})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
