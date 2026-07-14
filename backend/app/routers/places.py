from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/places", tags=["places"])


class VerifyRequest(BaseModel):
    place_ids: list[str]


@router.post("/verify")
async def verify_places(body: VerifyRequest) -> dict:
    # Phase 2: Foursquare lookup + cache to place_cache
    return {"status": "Phase 2 not yet implemented"}
