import asyncio
from datetime import date, datetime, timezone, timedelta
from fastapi import Request
from pydantic import BaseModel

from ..config import settings
from ..db import get_db

FREE_SIGNED_IN_LIMIT = 5
ANONYMOUS_LIMIT = 1
CHAT_DAILY_LIMIT = 40


class QuotaExceededError(BaseModel):
    error: str = "quota_exceeded"
    tier: str  # "anonymous" | "free"
    limit: int
    used: int
    reset_at: str  # ISO-8601 UTC, next midnight
    message: str


class ChatQuotaExceededError(BaseModel):
    error: str = "chat_quota_exceeded"
    limit: int
    used: int
    reset_at: str
    message: str


def _manager_emails() -> set[str]:
    return {e.strip().lower() for e in settings.manager_emails.split(",") if e.strip()}


def _client_ip(request: Request) -> str:
    # Railway's proxy appends the real client IP as the rightmost entry in
    # X-Forwarded-For; the leftmost entry is client-controlled and trivially
    # spoofable, so it must not be trusted for rate limiting.
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


async def _increment(identity_key: str) -> int:
    """Atomically reserve a slot for identity_key/today and return the new count.
    Fails soft (returns 0 = "not over limit") on DB errors — a Supabase outage
    must not block itinerary generation, it just means quota is temporarily
    unenforced (matches the fail-soft convention already used for trend_cache)."""
    try:
        db = get_db()
        today = date.today().isoformat()
        query = db.rpc(
            "increment_generation_usage",
            {"p_identity_key": identity_key, "p_usage_date": today},
        )
        result = await asyncio.to_thread(query.execute)
        return int(result.data) if isinstance(result.data, (int, float)) else 0
    except Exception:
        return 0


async def _resolve_tier(user_id: str | None, email: str | None) -> str:
    """Returns 'manager' | 'premium' | 'free' | 'anonymous'."""
    if email and email.lower() in _manager_emails():
        return "manager"
    if not user_id:
        return "anonymous"
    try:
        db = get_db()
        query = db.table("users").select("plan").eq("id", user_id).limit(1)
        row = await asyncio.to_thread(query.execute)
        if row.data and row.data[0].get("plan") == "premium":
            return "premium"
    except Exception:
        pass
    return "free"


def _reset_at_iso() -> str:
    tomorrow = date.today() + timedelta(days=1)
    return datetime(tomorrow.year, tomorrow.month, tomorrow.day, tzinfo=timezone.utc).isoformat()


def _quota_message(tier: str) -> str:
    if tier == "anonymous":
        return "You've used today's free generation. Sign in for 5 generations/day."
    return "You've used all 5 free generations today. Upgrade to Premium for unlimited generations."


async def check_and_reserve_quota(
    user_id: str | None,
    email: str | None,
    request: Request,
    anon_id: str | None,
) -> QuotaExceededError | None:
    """Returns None if the request is allowed (and reserves the slot as a side
    effect for free/anonymous tiers). Returns a QuotaExceededError if blocked."""
    tier = await _resolve_tier(user_id, email)

    if tier in ("manager", "premium"):
        return None

    if tier == "free":
        used = await _increment(f"user:{user_id}")
        if used > FREE_SIGNED_IN_LIMIT:
            return QuotaExceededError(
                tier="free", limit=FREE_SIGNED_IN_LIMIT, used=used,
                reset_at=_reset_at_iso(), message=_quota_message("free"),
            )
        return None

    # anonymous — check/reserve both signals independently
    ip_used = await _increment(f"ip:{_client_ip(request)}")
    anon_used = await _increment(f"anon:{anon_id}") if anon_id else 0
    used = max(ip_used, anon_used)
    if ip_used > ANONYMOUS_LIMIT or anon_used > ANONYMOUS_LIMIT:
        return QuotaExceededError(
            tier="anonymous", limit=ANONYMOUS_LIMIT, used=used,
            reset_at=_reset_at_iso(), message=_quota_message("anonymous"),
        )
    return None


def _increment_chat(identity_key: str) -> int:
    """Same fail-soft convention as `_increment` — a Supabase outage must not
    block chat, it just means the daily cap is temporarily unenforced."""
    try:
        db = get_db()
        today = date.today().isoformat()
        result = db.rpc(
            "increment_chat_usage",
            {"p_identity_key": identity_key, "p_usage_date": today},
        ).execute()
        return int(result.data) if isinstance(result.data, (int, float)) else 0
    except Exception:
        return 0


def check_and_reserve_chat_quota(user_id: str, email: str | None) -> ChatQuotaExceededError | None:
    """Callers only reach this after confirming premium/manager tier — this is
    pure cost-runaway protection on an already-paying user, not a monetization
    lever, so a flat daily cap (no tiering) is enough."""
    if email and email.lower() in _manager_emails():
        return None
    used = _increment_chat(f"user:{user_id}")
    if used > CHAT_DAILY_LIMIT:
        return ChatQuotaExceededError(
            limit=CHAT_DAILY_LIMIT, used=used, reset_at=_reset_at_iso(),
            message=f"You've used all {CHAT_DAILY_LIMIT} chat messages today. More tomorrow!",
        )
    return None
