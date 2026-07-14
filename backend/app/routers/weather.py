from fastapi import APIRouter

router = APIRouter(prefix="/api/weather", tags=["weather"])


@router.get("/{destination}/{date}")
async def get_weather(destination: str, date: str) -> dict:
    # Phase 2: Open-Meteo forecast + cache to weather_cache
    return {"status": "Phase 2 not yet implemented"}
