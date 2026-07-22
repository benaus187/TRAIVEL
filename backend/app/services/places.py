import httpx
from ..config import settings

_PLACES_URL = "https://places.googleapis.com/v1/places:searchText"
_FIELD_MASK = "places.id,places.location,places.regularOpeningHours"
_DISCOVER_MASK = "places.id,places.displayName,places.rating,places.userRatingCount,places.editorialSummary"


async def search_place(name: str, destination: str) -> dict | None:
    """Search Google Places for a place by name near a destination.
    Returns place_id, open_now flag, and lat/lon for weather accuracy."""
    if not settings.google_places_api_key:
        return None

    headers = {
        "X-Goog-Api-Key": settings.google_places_api_key,
        "X-Goog-FieldMask": _FIELD_MASK,
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.post(
                _PLACES_URL,
                headers=headers,
                json={"textQuery": f"{name} {destination}"},
            )
            r.raise_for_status()
            data = r.json()
    except Exception:
        return None

    places = data.get("places", [])
    if not places:
        return None

    place = places[0]
    location = place.get("location", {})
    if not isinstance(location, dict):
        location = {}
    hours = place.get("regularOpeningHours", {})
    if not isinstance(hours, dict):
        hours = {}
    weekday = hours.get("weekdayDescriptions", [])

    return {
        "place_id": place.get("id", ""),
        "hours_display": weekday[0] if weekday else None,
        "open_now": hours.get("openNow"),
        "lat": location.get("latitude"),
        "lon": location.get("longitude"),
    }


async def discover_popular_places(destination: str) -> list[dict]:
    """Fetch top tourist attractions for a destination to use as trend context for Claude."""
    if not settings.google_places_api_key:
        return []

    headers = {
        "X-Goog-Api-Key": settings.google_places_api_key,
        "X-Goog-FieldMask": _DISCOVER_MASK,
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                _PLACES_URL,
                headers=headers,
                json={"textQuery": f"top tourist attractions things to do in {destination}", "rankPreference": "POPULARITY"},
            )
            r.raise_for_status()
            data = r.json()
    except Exception:
        return []

    results = []
    for p in data.get("places", [])[:8]:
        display_name = p.get("displayName", {})
        name = display_name.get("text", "") if isinstance(display_name, dict) else str(display_name)
        if not name:
            continue
        editorial = p.get("editorialSummary", {})
        summary = editorial.get("text", "") if isinstance(editorial, dict) else str(editorial)
        results.append({
            "name": name,
            "rating": p.get("rating"),
            "review_count": p.get("userRatingCount"),
            "summary": summary,
        })
    return results
