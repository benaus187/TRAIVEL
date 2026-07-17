from datetime import date, timedelta
import httpx

_GEO_URL = "https://geocoding-api.open-meteo.com/v1/search"
_WEATHER_URL = "https://api.open-meteo.com/v1/forecast"

_WMO_CONDITION: dict[int, str] = {
    0: "sunny", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
    45: "foggy", 48: "foggy",
    51: "light drizzle", 53: "drizzle", 55: "heavy drizzle",
    61: "light rain", 63: "rain", 65: "heavy rain",
    71: "light snow", 73: "snow", 75: "heavy snow",
    80: "rain showers", 81: "rain showers", 82: "heavy showers",
    95: "thunderstorm", 96: "thunderstorm", 99: "thunderstorm",
}

BAD_WEATHER_CODES = {45, 48, 51, 53, 55, 61, 63, 65, 71, 73, 75, 80, 81, 82, 95, 96, 99}


def _condition(code: int) -> str:
    return _WMO_CONDITION.get(code, "variable")


async def _geocode(query: str, country_hint: str | None = None) -> tuple[float, float, str] | None:
    """Returns (lat, lon, location_label). country_hint is a string to match against result country names."""
    try:
        async with httpx.AsyncClient(timeout=6) as client:
            r = await client.get(_GEO_URL, params={"name": query, "count": 10, "language": "en"})
            r.raise_for_status()
            results = r.json().get("results", [])
    except Exception:
        return None
    if not results:
        return None

    hint = (country_hint or query).lower()

    # Prefer a result whose country or country_code appears in the hint string
    for res in results:
        country = res.get("country", "").lower()
        country_code = res.get("country_code", "").lower()
        if country and country in hint:
            label = f"{res['name']}, {res.get('admin1', '')}, {res['country']}".replace(", ,", ",").strip(", ")
            return res["latitude"], res["longitude"], label
        if country_code and country_code in hint:
            label = f"{res['name']}, {res.get('admin1', '')}, {res['country']}".replace(", ,", ",").strip(", ")
            return res["latitude"], res["longitude"], label

    # No country hint matched — use first result (population sort only helps when no hint)
    res = results[0]
    label = f"{res['name']}, {res.get('admin1', '')}, {res['country']}".replace(", ,", ",").strip(", ")
    return res["latitude"], res["longitude"], label


async def get_trip_weather(
    destination: str,
    start_date: str,
    days: int,
    lat: float | None = None,
    lon: float | None = None,
) -> list[dict] | None:
    """Return daily weather forecast for each day of the trip.
    If lat/lon not provided, falls back to geocoding the destination name."""
    location_label: str | None = None
    if lat is None or lon is None:
        # Pass full destination as country hint — so city-only fallback still filters by country
        city_name = destination.split(",")[0].strip()
        coords = await _geocode(destination, destination) or await _geocode(city_name, destination)
        if not coords:
            return None
        lat, lon, location_label = coords

    end = (date.fromisoformat(start_date) + timedelta(days=days - 1)).isoformat()

    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "weathercode,temperature_2m_max,precipitation_sum",
        "timezone": "auto",
        "start_date": start_date,
        "end_date": end,
    }

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(_WEATHER_URL, params=params)
            r.raise_for_status()
            daily = r.json().get("daily", {})
    except Exception:
        return None

    dates = daily.get("time", [])
    if not dates:
        return None

    codes = daily.get("weathercode", [])
    temps = daily.get("temperature_2m_max", [])
    precip = daily.get("precipitation_sum", [])

    return [
        {
            "date": dates[i],
            "condition": _condition(codes[i]) if i < len(codes) else "unknown",
            "temp_max": temps[i] if i < len(temps) else None,
            "precipitation": precip[i] if i < len(precip) else None,
            "bad_weather": (codes[i] in BAD_WEATHER_CODES) if i < len(codes) else False,
            "location": location_label,
        }
        for i in range(len(dates))
    ]
