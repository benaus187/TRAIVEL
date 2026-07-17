import httpx
from ..config import settings

_FSQ_BASE = "https://api.foursquare.com/v3"


def _hours_display(hours: dict) -> str | None:
    display = hours.get("display")
    if display and isinstance(display, list):
        return display[0] if display else None
    return None


async def search_place(name: str, destination: str) -> dict | None:
    """Search Foursquare for a place by name near a destination.
    Returns place_id, verified flag, and hours display string."""
    if not settings.foursquare_api_key:
        return None

    headers = {"Authorization": settings.foursquare_api_key, "Accept": "application/json"}
    params = {
        "query": name,
        "near": destination,
        "limit": 1,
        "fields": "fsq_id,name,hours,geocodes",
    }

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(f"{_FSQ_BASE}/places/search", headers=headers, params=params)
            r.raise_for_status()
            data = r.json()
    except Exception:
        return None

    results = data.get("results", [])
    if not results:
        return None

    place = results[0]
    hours = place.get("hours") or {}
    geocodes = place.get("geocodes", {}).get("main", {})
    return {
        "fsq_id": place.get("fsq_id"),
        "hours_display": _hours_display(hours),
        "open_now": hours.get("open_now"),
        "lat": geocodes.get("latitude"),
        "lon": geocodes.get("longitude"),
    }
