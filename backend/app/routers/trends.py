from fastapi import APIRouter

router = APIRouter(prefix="/api/trends", tags=["trends"])


@router.get("/{destination}")
async def get_trends(destination: str) -> dict:
    # Phase 3: X API hashtag scoring + sponsored content filter
    return {"status": "Phase 3 not yet implemented"}
