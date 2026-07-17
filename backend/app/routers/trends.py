from datetime import datetime, timezone
from fastapi import APIRouter
from ..db import get_db
from ..services.trends import fetch_trends

router = APIRouter(prefix="/api/trends", tags=["trends"])

_CACHE_TTL_HOURS = 6


@router.get("/{destination}")
async def get_trends(destination: str) -> dict:
    db = get_db()

    cached = db.table("trend_cache").select("data,cached_at").eq("destination", destination).execute()
    if cached.data:
        cached_at = datetime.fromisoformat(cached.data[0]["cached_at"].replace("Z", "+00:00"))
        age_hours = (datetime.now(timezone.utc) - cached_at).total_seconds() / 3600
        if age_hours < _CACHE_TTL_HOURS:
            return {"destination": destination, "trends": cached.data[0]["data"], "cached": True}

    trends = await fetch_trends(destination)

    if trends:
        db.table("trend_cache").upsert({
            "destination": destination,
            "data": trends,
            "cached_at": datetime.now(timezone.utc).isoformat(),
        }).execute()

    return {"destination": destination, "trends": trends, "cached": False}
