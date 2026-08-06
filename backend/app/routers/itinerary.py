import asyncio
import json
import secrets
import string
from datetime import date, datetime, timezone, timedelta
import anthropic
from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..config import settings
from ..db import get_db
from ..services.itinerary_ops import verify_stop
from ..services.places import discover_popular_places
from ..services.quota import check_and_reserve_quota
from ..services.weather import get_trip_weather
from ..services.youtube import fetch_youtube_trending

router = APIRouter(prefix="/api/itinerary", tags=["itinerary"])

_YOUTUBE_CACHE_TTL_HOURS = 24


async def _get_cached_youtube_trends(destination: str) -> list[dict]:
    """YouTube search.list costs 100 quota units/call (~100 free calls/day) — cache aggressively.
    The cache is supplementary: any Supabase error here must not abort itinerary generation."""
    cache_key = f"youtube:{destination}"

    try:
        db = get_db()
        query = db.table("trend_cache").select("data,cached_at").eq("destination", cache_key)
        cached = await asyncio.to_thread(query.execute)
        if cached.data:
            cached_at = datetime.fromisoformat(cached.data[0]["cached_at"].replace("Z", "+00:00"))
            age_hours = (datetime.now(timezone.utc) - cached_at).total_seconds() / 3600
            if age_hours < _YOUTUBE_CACHE_TTL_HOURS:
                return cached.data[0]["data"] or []
    except Exception:
        pass

    trends = await fetch_youtube_trending(destination)

    if trends:
        try:
            db = get_db()
            query = db.table("trend_cache").upsert({
                "destination": cache_key,
                "data": trends,
                "cached_at": datetime.now(timezone.utc).isoformat(),
            })
            await asyncio.to_thread(query.execute)
        except Exception:
            pass

    return trends


async def _extract_claims(authorization: str | None) -> tuple[str | None, str | None]:
    """Returns (user_id, email) for a Supabase-verified JWT, or (None, None) if
    missing/invalid/expired. Verification is a real call to Supabase Auth
    (auth.get_user) rather than a local decode — quota tier (including the
    manager/premium unlimited bypass) is a security-sensitive decision made
    from this claim, so an unverified payload decode is not acceptable here."""
    if not authorization or not authorization.startswith("Bearer "):
        return None, None
    try:
        response = await asyncio.to_thread(get_db().auth.get_user, authorization[7:])
        user = response.user
        return user.id, user.email
    except Exception:
        return None, None


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
                        "place_id": {"type": "string", "description": "Google Places place ID if known, otherwise null"},
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
    youtube_trends: list[dict] | None = None,
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

    youtube_str = ""
    if youtube_trends:
        lines = [
            f"- \"{v['title']}\" by {v['channel']} ({v['view_count']:,} views)"
            for v in youtube_trends[:5]
        ]
        youtube_str = f"""

Recent popular YouTube travel guides about {brief.destination}:
{chr(10).join(lines)}

If a place these videos feature fits the traveller's interests, consider including it and assign "social momentum" reason code."""

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
- Preferred transport: {transport_label}{avoid_str}{flight_str}{places_str}{youtube_str}{weather_str}{accommodation_str}

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


def _save_to_supabase(brief: TripBrief, stops: list[dict], user_id: str | None = None) -> tuple[str, str, str | None, list[str]]:
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
    stop_ids: list[str] = []
    if rows:
        inserted = db.table("stops").insert(rows).execute()
        pos_to_id = {r["position"]: r["id"] for r in inserted.data}
        stop_ids = [pos_to_id.get(i, "") for i in range(len(stops))]

    return trip_id, itinerary_id, share_slug, stop_ids


@router.post("/generate")
async def generate_itinerary(
    brief: TripBrief,
    request: Request,
    authorization: str | None = Header(default=None),
    x_anon_id: str | None = Header(default=None, alias="X-Anon-Id"),
) -> StreamingResponse:
    user_id, email = await _extract_claims(authorization)

    quota_error = await check_and_reserve_quota(user_id, email, request, x_anon_id)
    if quota_error is not None:
        raise HTTPException(status_code=429, detail=quota_error.model_dump())

    async def stream():
        try:
            client = get_client()
            start_date = brief.start_date or (date.today() + timedelta(days=7)).isoformat()

            # 1. Fetch popular places + YouTube trends + weather BEFORE Claude — use all in prompt
            popular_places, youtube_trends, weather_forecast = await asyncio.gather(
                discover_popular_places(brief.destination),
                _get_cached_youtube_trends(brief.destination),
                get_trip_weather(brief.destination, start_date, brief.days),
            )

            combined_trends = popular_places + youtube_trends
            if combined_trends:
                yield f"data: {json.dumps({'type': 'trends', 'trends': combined_trends})}\n\n"

            # 2. Generate itinerary with Claude — prompt includes places + youtube + weather
            message = await asyncio.to_thread(
                client.messages.create,
                model="claude-opus-5",
                max_tokens=8192,
                tools=[ITINERARY_TOOL],
                tool_choice={"type": "tool", "name": "create_itinerary"},
                messages=[{"role": "user", "content": _build_prompt(brief, popular_places, youtube_trends, weather_forecast)}],
            )

            collected_stops: list[dict] = []
            for block in message.content:
                if block.type == "tool_use":
                    collected_stops = block.input.get("stops", [])
                    for stop in collected_stops:
                        yield f"data: {json.dumps({'type': 'stop', 'stop': stop})}\n\n"
                        await asyncio.sleep(0.08)

            trip_id, itinerary_id, share_slug, stop_ids = await asyncio.to_thread(
                _save_to_supabase, brief, collected_stops, user_id
            )

            # 3. Verification phase — Google Places per stop + build booking URLs
            dest_lat: float | None = None
            dest_lon: float | None = None
            if collected_stops:
                yield f"data: {json.dumps({'type': 'verifying', 'total': len(collected_stops)})}\n\n"
                db = get_db()
                for i, stop in enumerate(collected_stops):
                    try:
                        result = await verify_stop(db, stop_ids[i], stop["name"], brief.destination)
                        if dest_lat is None and result["lat"] and result["lon"]:
                            dest_lat, dest_lon = result["lat"], result["lon"]
                        yield f"data: {json.dumps({'type': 'verify', 'index': i, 'id': stop_ids[i], **result})}\n\n"
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
