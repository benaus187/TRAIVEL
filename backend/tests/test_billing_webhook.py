"""Covers backend/app/routers/billing.py's stripe_webhook handler — the most
business-critical path in the app (it's what flips a user between free and
premium) and the hardest to keep re-verifying by hand via `stripe trigger`,
since several of these transitions require a specific prior DB state that the
CLI's canned fixtures don't reliably produce (e.g. invoice.payment_failed for
an invoice that IS tied to a subscription).
"""
from app.services import stripe_service
from app.routers import billing

from .conftest import FakeDB, make_event


def _post_webhook(client, monkeypatch, fake_db, event):
    monkeypatch.setattr(stripe_service, "construct_webhook_event", lambda payload, sig: event)
    monkeypatch.setattr(billing, "get_db", lambda: fake_db)
    return client.post(
        "/api/billing/webhook",
        content=b"{}",
        headers={"Stripe-Signature": "test-sig"},
    )


def test_missing_signature_rejected(client):
    resp = client.post("/api/billing/webhook", content=b"{}")
    assert resp.status_code == 400


def test_invalid_signature_rejected(client, monkeypatch):
    def raise_invalid(payload, sig):
        raise ValueError("bad signature")
    monkeypatch.setattr(stripe_service, "construct_webhook_event", raise_invalid)
    resp = client.post(
        "/api/billing/webhook", content=b"{}", headers={"Stripe-Signature": "bad"}
    )
    assert resp.status_code == 400


def test_checkout_session_completed_flips_to_premium(client, monkeypatch):
    fake_db = FakeDB(users={"u1": {"id": "user_1", "plan": "free", "subscription_status": None}})
    monkeypatch.setattr(stripe_service, "get_subscription_status", lambda sub_id: "active")
    event = make_event("checkout.session.completed", {
        "client_reference_id": "user_1",
        "customer": "cus_1",
        "subscription": "sub_1",
    })
    resp = _post_webhook(client, monkeypatch, fake_db, event)
    assert resp.status_code == 200
    row = fake_db.users["u1"]
    assert row["plan"] == "premium"
    assert row["subscription_status"] == "active"
    assert row["stripe_customer_id"] == "cus_1"
    assert row["stripe_subscription_id"] == "sub_1"


def test_checkout_session_completed_uses_real_trial_status(client, monkeypatch):
    """A trial subscription must land as 'trialing', not be hardcoded to 'active'."""
    fake_db = FakeDB(users={"u1": {"id": "user_1", "plan": "free", "subscription_status": None}})
    monkeypatch.setattr(stripe_service, "get_subscription_status", lambda sub_id: "trialing")
    event = make_event("checkout.session.completed", {
        "client_reference_id": "user_1", "customer": "cus_1", "subscription": "sub_1",
    })
    _post_webhook(client, monkeypatch, fake_db, event)
    assert fake_db.users["u1"]["subscription_status"] == "trialing"


def test_subscription_updated_active_grants_premium(client, monkeypatch):
    fake_db = FakeDB(users={"u1": {"id": "user_1", "plan": "free", "stripe_customer_id": "cus_1"}})
    event = make_event("customer.subscription.updated", {"customer": "cus_1", "status": "active"})
    resp = _post_webhook(client, monkeypatch, fake_db, event)
    assert resp.status_code == 200
    assert fake_db.users["u1"]["plan"] == "premium"
    assert fake_db.users["u1"]["subscription_status"] == "active"


def test_subscription_updated_past_due_revokes_premium(client, monkeypatch):
    fake_db = FakeDB(users={"u1": {"id": "user_1", "plan": "premium", "stripe_customer_id": "cus_1"}})
    event = make_event("customer.subscription.updated", {"customer": "cus_1", "status": "past_due"})
    _post_webhook(client, monkeypatch, fake_db, event)
    assert fake_db.users["u1"]["plan"] == "free"
    assert fake_db.users["u1"]["subscription_status"] == "past_due"


def test_subscription_deleted_revokes_premium_and_marks_canceled(client, monkeypatch):
    fake_db = FakeDB(users={"u1": {"id": "user_1", "plan": "premium", "stripe_customer_id": "cus_1"}})
    event = make_event("customer.subscription.deleted", {"customer": "cus_1"})
    _post_webhook(client, monkeypatch, fake_db, event)
    assert fake_db.users["u1"]["plan"] == "free"
    assert fake_db.users["u1"]["subscription_status"] == "canceled"


def test_subscription_updated_no_matching_user_returns_500_so_stripe_retries(client, monkeypatch):
    fake_db = FakeDB(users={})
    event = make_event("customer.subscription.updated", {"customer": "cus_missing", "status": "active"})
    resp = _post_webhook(client, monkeypatch, fake_db, event)
    assert resp.status_code == 500


def test_invoice_payment_failed_updates_status_via_real_subscription_lookup(client, monkeypatch):
    """The Stripe CLI's `invoice.payment_failed` fixture creates a one-off
    invoice with no `subscription` field, so it can't exercise this branch —
    this test constructs the subscription-linked shape directly instead."""
    fake_db = FakeDB(users={"u1": {"id": "user_1", "plan": "premium", "stripe_customer_id": "cus_1", "subscription_status": "active"}})
    monkeypatch.setattr(stripe_service, "get_subscription_status", lambda sub_id: "past_due")
    event = make_event("invoice.payment_failed", {"customer": "cus_1", "subscription": "sub_1"})
    resp = _post_webhook(client, monkeypatch, fake_db, event)
    assert resp.status_code == 200
    assert fake_db.users["u1"]["subscription_status"] == "past_due"
    # plan is intentionally left untouched here — customer.subscription.updated
    # owns the plan flip once Stripe's retry schedule is exhausted
    assert fake_db.users["u1"]["plan"] == "premium"


def test_invoice_payment_failed_without_subscription_is_a_safe_noop(client, monkeypatch):
    """Matches the real Stripe CLI fixture shape: a one-off invoice, not tied
    to any subscription — must not raise and must not touch any user row."""
    fake_db = FakeDB(users={"u1": {"id": "user_1", "plan": "premium", "stripe_customer_id": "cus_1"}})
    event = make_event("invoice.payment_failed", {"customer": "cus_1", "subscription": None})
    resp = _post_webhook(client, monkeypatch, fake_db, event)
    assert resp.status_code == 200
    assert fake_db.update_calls == []


def test_trial_will_end_is_acked_without_error(client, monkeypatch):
    fake_db = FakeDB(users={})
    event = make_event("customer.subscription.trial_will_end", {"customer": "cus_1"})
    resp = _post_webhook(client, monkeypatch, fake_db, event)
    assert resp.status_code == 200
    assert resp.json() == {"received": True}


def test_unhandled_event_type_is_acked(client, monkeypatch):
    fake_db = FakeDB(users={})
    event = make_event("customer.created", {"id": "cus_1"})
    resp = _post_webhook(client, monkeypatch, fake_db, event)
    assert resp.status_code == 200
