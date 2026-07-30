"""Covers backend/app/services/quota.py — the 4-tier daily generation quota
enforced in front of every Claude API call. Business-critical (it's the free/
paid boundary) and awkward to re-verify by hand across all 4 tiers each time.
"""
from app.services import quota

from .conftest import FakeDB


def test_manager_email_bypasses_quota(monkeypatch):
    monkeypatch.setattr(quota.settings, "manager_emails", "boss@traivel.cc, other@x.com")
    assert quota._resolve_tier(None, "Boss@Traivel.cc") == "manager"


def test_premium_user_resolves_to_premium_tier(monkeypatch):
    fake_db = FakeDB(users={"u1": {"id": "user_1", "plan": "premium"}})
    monkeypatch.setattr(quota, "get_db", lambda: fake_db)
    assert quota._resolve_tier("user_1", "someone@x.com") == "premium"


def test_signed_in_free_user_resolves_to_free_tier(monkeypatch):
    fake_db = FakeDB(users={"u1": {"id": "user_1", "plan": "free"}})
    monkeypatch.setattr(quota, "get_db", lambda: fake_db)
    assert quota._resolve_tier("user_1", "someone@x.com") == "free"


def test_no_user_id_resolves_to_anonymous_tier(monkeypatch):
    assert quota._resolve_tier(None, None) == "anonymous"


def test_manager_and_premium_are_never_rate_limited(monkeypatch):
    fake_db = FakeDB(rpc_return=999)  # would be way over any real limit
    monkeypatch.setattr(quota, "get_db", lambda: fake_db)
    monkeypatch.setattr(quota.settings, "manager_emails", "boss@traivel.cc")

    class DummyRequest:
        headers: dict = {}
        client = None

    assert quota.check_and_reserve_quota(None, "boss@traivel.cc", DummyRequest(), None) is None
    fake_db2 = FakeDB(users={"u1": {"id": "user_1", "plan": "premium"}}, rpc_return=999)
    monkeypatch.setattr(quota, "get_db", lambda: fake_db2)
    assert quota.check_and_reserve_quota("user_1", "someone@x.com", DummyRequest(), None) is None
    # premium/manager never even call the rate-limit RPC
    assert fake_db2.rpc_calls == []


def test_free_tier_blocks_after_limit(monkeypatch):
    fake_db = FakeDB(users={"u1": {"id": "user_1", "plan": "free"}}, rpc_return=quota.FREE_SIGNED_IN_LIMIT + 1)
    monkeypatch.setattr(quota, "get_db", lambda: fake_db)

    class DummyRequest:
        headers: dict = {}
        client = None

    result = quota.check_and_reserve_quota("user_1", "someone@x.com", DummyRequest(), None)
    assert result is not None
    assert result.tier == "free"
    assert result.limit == quota.FREE_SIGNED_IN_LIMIT


def test_free_tier_allows_under_limit(monkeypatch):
    fake_db = FakeDB(users={"u1": {"id": "user_1", "plan": "free"}}, rpc_return=quota.FREE_SIGNED_IN_LIMIT)
    monkeypatch.setattr(quota, "get_db", lambda: fake_db)

    class DummyRequest:
        headers: dict = {}
        client = None

    assert quota.check_and_reserve_quota("user_1", "someone@x.com", DummyRequest(), None) is None


def test_anonymous_tier_blocks_after_limit(monkeypatch):
    fake_db = FakeDB(rpc_return=quota.ANONYMOUS_LIMIT + 1)
    monkeypatch.setattr(quota, "get_db", lambda: fake_db)

    class DummyRequest:
        headers: dict = {}
        client = None

    result = quota.check_and_reserve_quota(None, None, DummyRequest(), "anon-1")
    assert result is not None
    assert result.tier == "anonymous"


def test_client_ip_uses_rightmost_x_forwarded_for_entry():
    """The leftmost entry is client-controlled/spoofable — only the rightmost
    (added by Railway's own proxy) is trustworthy for rate limiting."""
    class DummyRequest:
        headers = {"x-forwarded-for": "1.2.3.4, 10.0.0.1"}
        client = None

    assert quota._client_ip(DummyRequest()) == "10.0.0.1"
