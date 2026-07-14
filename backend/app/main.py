from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import itinerary, places, weather, trends

app = FastAPI(title="TRAIVEL API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(itinerary.router)
app.include_router(places.router)
app.include_router(weather.router)
app.include_router(trends.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
