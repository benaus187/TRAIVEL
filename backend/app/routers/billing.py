from typing import Literal

import stripe
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel

from ..config import settings
from ..db import get_db
from ..services import stripe_service
from .itinerary import _extract_claims

router = APIRouter(prefix="/api/billing", tags=["billing"])


class CheckoutRequest(BaseModel):
    interval: Literal["monthly", "annual"]


@router.get("/me")
async def get_my_plan(authorization: str | None = Header(default=None)) -> dict:
    user_id, _ = _extract_claims(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="sign in required")
    row = get_db().table("users").select("plan,subscription_status").eq("id", user_id).limit(1).execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="user not found")
    return {"plan": row.data[0]["plan"], "subscription_status": row.data[0]["subscription_status"]}


@router.post("/checkout")
async def create_checkout(body: CheckoutRequest, authorization: str | None = Header(default=None)) -> dict:
    user_id, email = _extract_claims(authorization)
    if not user_id or not email:
        raise HTTPException(status_code=401, detail="sign in required")
    row = get_db().table("users").select("plan,subscription_status,stripe_customer_id").eq("id", user_id).limit(1).execute()
    user_row = row.data[0] if row.data else None
    # Block on any non-terminal subscription status, not just plan == "premium" —
    # the webhook flips plan to "free" on past_due/unpaid/incomplete even though
    # the Stripe subscription is still open, so a cached "free" plan alone isn't
    # enough to know it's safe to start a second concurrent subscription.
    if user_row and (
        user_row["plan"] == "premium"
        or user_row["subscription_status"] in ("active", "trialing", "past_due", "unpaid", "incomplete")
    ):
        raise HTTPException(status_code=400, detail="already premium — manage your subscription in the billing portal")
    customer_id = user_row["stripe_customer_id"] if user_row else None
    price_id = (
        settings.stripe_price_id_monthly if body.interval == "monthly" else settings.stripe_price_id_annual
    )
    if not price_id:
        raise HTTPException(status_code=400, detail="invalid interval")
    url = stripe_service.create_checkout_session(user_id, email, price_id, customer_id)
    return {"url": url}


@router.post("/portal")
async def create_portal(authorization: str | None = Header(default=None)) -> dict:
    user_id, _ = _extract_claims(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="sign in required")
    row = get_db().table("users").select("stripe_customer_id").eq("id", user_id).limit(1).execute()
    customer_id = row.data[0]["stripe_customer_id"] if row.data else None
    if not customer_id:
        raise HTTPException(status_code=400, detail="no billing account on file")
    url = stripe_service.create_portal_session(customer_id)
    return {"url": url}


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
) -> dict:
    payload = await request.body()
    if not stripe_signature:
        raise HTTPException(status_code=400, detail="missing Stripe-Signature header")
    try:
        event = stripe_service.construct_webhook_event(payload, stripe_signature)
    except (ValueError, stripe.SignatureVerificationError):
        raise HTTPException(status_code=400, detail="invalid webhook signature")

    # Unlike quota.py's fail-soft convention, DB write failures below must
    # propagate as a non-2xx so Stripe retries automatically — a missed
    # plan flip is a paid-feature correctness bug, not a soft-degradable cache.
    db = get_db()
    event_type = event["type"]
    # stripe-python 15.x's StripeObject no longer subclasses dict (no .get()) —
    # convert once so the .get(...) calls below work as plain dict lookups.
    data = event["data"]["object"].to_dict()

    if event_type == "checkout.session.completed":
        user_id = data.get("client_reference_id")
        if user_id:
            db.table("users").update({
                "plan": "premium",
                "stripe_customer_id": data.get("customer"),
                "stripe_subscription_id": data.get("subscription"),
                "subscription_status": "active",
            }).eq("id", user_id).execute()

    elif event_type in ("customer.subscription.updated", "customer.subscription.deleted"):
        customer_id = data.get("customer")
        status = data.get("status") if event_type == "customer.subscription.updated" else "canceled"
        plan = "premium" if status in ("active", "trialing") else "free"
        result = db.table("users").update({
            "plan": plan,
            "subscription_status": status,
        }).eq("stripe_customer_id", customer_id).execute()
        # An empty result means no user row has this stripe_customer_id yet (e.g. an
        # event-ordering race right after checkout) — a bare update() call doesn't
        # raise on zero matched rows, so without this check the plan/status
        # transition is silently lost instead of triggering a Stripe retry.
        if not result.data:
            raise HTTPException(status_code=500, detail=f"no user found for stripe_customer_id={customer_id}")

    return {"received": True}
