from pydantic import BaseModel
from enum import Enum


class ReasonCode(str, Enum):
    social_momentum = "social momentum"
    transport_fit = "transport fit"
    food_fit = "food fit"
    budget_fit = "budget fit"
    weather_alternate_ready = "weather alternate ready"


class Stop(BaseModel):
    time: str
    name: str
    description: str
    reason_codes: list[ReasonCode]
    place_id: str | None = None
    verified: bool = False
    weather_alternate: str | None = None
    transit_note: str | None = None


class Itinerary(BaseModel):
    destination: str
    days: int
    stops: list[Stop]
