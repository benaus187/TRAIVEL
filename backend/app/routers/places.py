from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/places", tags=["places"])


class VerifyRequest(BaseModel):
    place_ids: list[str]


@router.post("/verify")
async def verify_places(body: VerifyRequest) -> dict:
    # Orphaned stub — real place verification runs inline in /api/itinerary/generate via services/places.py (Google Places)
    return {"status": "not implemented — see /api/itinerary/generate"}
