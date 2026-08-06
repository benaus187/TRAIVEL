import asyncio

import anthropic
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from ..db import get_db
from .itinerary import _extract_claims, get_client
from ..services.itinerary_ops import apply_operations, verify_stop
from ..services.quota import _resolve_tier, check_and_reserve_chat_quota

router = APIRouter(prefix="/api/itinerary", tags=["chat"])

_CHAT_HISTORY_LIMIT = 10


class ChatMessageRequest(BaseModel):
    message: str


UPDATE_ITINERARY_TOOL: anthropic.types.ToolParam = {
    "name": "update_itinerary",
    "description": (
        "Reply conversationally to the traveller AND express any itinerary "
        "changes as operations on individual stops. Only include operations "
        "for stops that actually need to change — never resend unchanged stops."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "reply": {
                "type": "string",
                "description": "Short, conversational reply explaining what changed (or, for a pure constraint with no immediate change, what you'll keep in mind going forward).",
            },
            "operations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "op": {"type": "string", "enum": ["add", "remove", "replace"]},
                        "stop_id": {"type": "string", "description": "Required for remove/replace: id of the existing stop to target, using the exact id shown in the current stops list."},
                        "after_stop_id": {"type": "string", "description": "add only: insert immediately after this stop id. Omit to insert as the first stop of `day`."},
                        "day": {"type": "integer", "description": "Required for add. For replace, include only if moving the stop to a different day."},
                        "time": {"type": "string", "description": "Time in HH:MM format."},
                        "name": {"type": "string"},
                        "description": {"type": "string", "description": "1-2 sentences, ending with an estimated cost."},
                        "reason_codes": {
                            "type": "array",
                            "items": {
                                "type": "string",
                                "enum": [
                                    "social momentum",
                                    "transport fit",
                                    "food fit",
                                    "budget fit",
                                    "weather alternate ready",
                                ],
                            },
                        },
                        "transit_note": {"type": "string"},
                        "weather_alternate": {"type": "string"},
                    },
                    "required": ["op"],
                },
            },
        },
        "required": ["reply", "operations"],
    },
}


def _build_chat_prompt(destination: str, days: int, stops: list[dict], history: list[dict], message: str) -> str:
    stop_lines = []
    for s in stops:
        loc = f" (lat {s['lat']}, lon {s['lon']})" if s.get("lat") is not None and s.get("lon") is not None else ""
        stop_lines.append(f"- id={s['id']} | Day {s.get('day', 1)} {s['time']} — {s['name']}: {s['description']}{loc}")
    stops_str = "\n".join(stop_lines) if stop_lines else "(no stops yet)"

    history_lines = [f"{'User' if h['role'] == 'user' else 'Bot'}: {h['content']}" for h in history]
    history_str = "\n".join(history_lines) if history_lines else "(no previous messages)"

    return f"""You are refining an existing {days}-day travel itinerary for {destination}.

Current stops:
{stops_str}

Recent conversation:
{history_str}

Traveller's new message: {message}

Reply conversationally and express any itinerary changes as operations. Only include operations for stops that actually need to change — never resend unchanged stops. Use the exact stop id shown above when targeting remove/replace."""


@router.post("/{itinerary_id}/chat")
async def chat_with_itinerary(
    itinerary_id: str,
    body: ChatMessageRequest,
    authorization: str | None = Header(default=None),
) -> dict:
    user_id, email = await _extract_claims(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="sign in required")

    db = get_db()
    row = (
        db.table("itineraries")
        .select("id, version, trips(user_id, destination, days)")
        .eq("id", itinerary_id).limit(1).execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="itinerary not found")
    itinerary = row.data[0]
    trip = itinerary.get("trips")
    if not trip or trip["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="not your itinerary")

    tier = await _resolve_tier(user_id, email)
    if tier not in ("premium", "manager"):
        raise HTTPException(
            status_code=403,
            detail={"error": "premium_required", "message": "Chat editing is a Premium feature."},
        )

    quota_error = check_and_reserve_chat_quota(user_id, email)
    if quota_error is not None:
        raise HTTPException(status_code=429, detail=quota_error.model_dump())

    db.table("chat_messages").insert({
        "itinerary_id": itinerary_id, "user_id": user_id, "role": "user", "content": body.message,
    }).execute()

    stops = (
        db.table("stops").select("*").eq("itinerary_id", itinerary_id)
        .order("day").order("position").execute()
    ).data

    history_rows = (
        db.table("chat_messages").select("role,content")
        .eq("itinerary_id", itinerary_id).order("created_at", desc=True).limit(_CHAT_HISTORY_LIMIT).execute()
    ).data
    history = list(reversed(history_rows))

    prompt = _build_chat_prompt(trip["destination"], trip["days"], stops, history, body.message)

    try:
        client = get_client()
        message = await asyncio.to_thread(
            client.messages.create,
            model="claude-opus-5",
            max_tokens=4096,
            tools=[UPDATE_ITINERARY_TOOL],
            tool_choice={"type": "tool", "name": "update_itinerary"},
            messages=[{"role": "user", "content": prompt}],
        )
        tool_input = next((b.input for b in message.content if b.type == "tool_use"), None)
        if tool_input is None:
            raise ValueError("no tool_use block in response")
    except Exception:
        raise HTTPException(status_code=500, detail="Assistant failed to respond — try again.")

    reply: str = tool_input.get("reply", "")
    raw_ops: list[dict] = tool_input.get("operations", [])

    applied = apply_operations(db, itinerary_id, stops, raw_ops)

    for op in applied:
        if op["op"] in ("add", "replace"):
            verify_update = await verify_stop(db, op["stop"]["id"], op["stop"]["name"], trip["destination"])
            op["stop"].update(verify_update)

    if applied:
        db.table("itineraries").update({"version": itinerary["version"] + 1}).eq("id", itinerary_id).execute()

    db.table("chat_messages").insert({
        "itinerary_id": itinerary_id, "user_id": user_id, "role": "assistant",
        "content": reply, "operations": applied,
    }).execute()

    return {"reply": reply, "operations": applied}
