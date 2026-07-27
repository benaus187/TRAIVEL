import stripe

from ..config import settings

stripe.api_key = settings.stripe_secret_key


def create_checkout_session(user_id: str, email: str, price_id: str) -> str:
    """Returns the Stripe Checkout Session URL. Uses client_reference_id (not
    metadata) to carry user_id through to the webhook — the standard Stripe
    pattern for tying a session back to an existing user without a
    pre-existing Customer. The Stripe Customer is created lazily by Checkout
    itself; we don't pre-create one at signup."""
    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        customer_email=email,
        client_reference_id=user_id,
        success_url=f"{settings.frontend_url}/plan?checkout=success",
        cancel_url=f"{settings.frontend_url}/pricing?checkout=cancel",
        subscription_data={"metadata": {"user_id": user_id}},
    )
    return session.url


def create_portal_session(customer_id: str) -> str:
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{settings.frontend_url}/pricing",
    )
    return session.url


def construct_webhook_event(payload: bytes, sig_header: str) -> stripe.Event:
    return stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
