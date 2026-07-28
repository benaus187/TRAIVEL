from typing import Any

import stripe

from ..config import settings

stripe.api_key = settings.stripe_secret_key


def create_checkout_session(user_id: str, email: str, price_id: str, customer_id: str | None = None) -> str:
    """Returns the Stripe Checkout Session URL. Uses client_reference_id (not
    metadata) to carry user_id through to the webhook — the standard Stripe
    pattern for tying a session back to an existing user without a
    pre-existing Customer. Reuses customer_id when the user already has a
    Stripe Customer (e.g. a past cancellation) instead of passing
    customer_email, which would otherwise mint a second Customer object and
    fragment their billing history."""
    params: dict[str, Any] = {
        "mode": "subscription",
        "line_items": [{"price": price_id, "quantity": 1}],
        "client_reference_id": user_id,
        "success_url": f"{settings.frontend_url}/plan?checkout=success",
        "cancel_url": f"{settings.frontend_url}/pricing?checkout=cancel",
        "subscription_data": {"metadata": {"user_id": user_id}},
        # Managed Payments (Stripe's merchant-of-record tax handling) is on by
        # default for new accounts and requires a tax_code per line item,
        # which isn't settable when referencing an existing `price` id
        # (only via inline `price_data`). This app doesn't use Stripe Tax —
        # opt out rather than restructure the price reference.
        "managed_payments": {"enabled": False},
    }
    if customer_id:
        params["customer"] = customer_id
    else:
        params["customer_email"] = email
    # Stripe discards idempotency keys after 24h, so a key scoped to
    # (user, price) collapses double-click/two-tab duplicate submits into one
    # session within that window without blocking a legitimate resubscribe
    # later (the old key will have expired by then).
    session = stripe.checkout.Session.create(
        **params, idempotency_key=f"checkout:{user_id}:{price_id}"
    )
    assert session.url is not None
    return session.url


def get_subscription_status(subscription_id: str) -> str:
    return stripe.Subscription.retrieve(subscription_id).status


def create_portal_session(customer_id: str) -> str:
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{settings.frontend_url}/pricing",
    )
    return session.url


def construct_webhook_event(payload: bytes, sig_header: str) -> stripe.Event:
    return stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
