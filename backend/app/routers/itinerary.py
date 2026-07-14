from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter(prefix="/api/itinerary", tags=["itinerary"])


class TripBrief(BaseModel):
    destination: str
    days: int
    interests: list[str]
    budget: str
    pace: str
    avoid: list[str] = []


@router.post("/generate")
async def generate_itinerary(brief: TripBrief) -> StreamingResponse:
    # Phase 1: wire Claude Opus 4.8 tool_use + SSE stream
    async def placeholder():
        yield "data: {\"status\": \"Phase 1 not yet implemented\"}\n\n"

    return StreamingResponse(placeholder(), media_type="text/event-stream")
