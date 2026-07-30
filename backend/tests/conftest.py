"""Shared fakes for backend unit tests.

These are intentionally minimal, scoped only to the supabase-py query-builder
calls that billing.py and quota.py actually make (table().select/update/insert
().eq().limit().execute(), and rpc().execute()) — not a general-purpose
Supabase mock.
"""
import pytest
from fastapi.testclient import TestClient


class FakeResult:
    def __init__(self, data):
        self.data = data


class _FakeRpcCall:
    def __init__(self, value):
        self._value = value

    def execute(self):
        return FakeResult(self._value)


class FakeQuery:
    def __init__(self, db, table_name):
        self._db = db
        self._table_name = table_name
        self._op = None
        self._payload = None
        self._filters: dict = {}

    def select(self, *_a, **_k):
        self._op = "select"
        return self

    def update(self, payload):
        self._op = "update"
        self._payload = payload
        return self

    def insert(self, payload):
        self._op = "insert"
        self._payload = payload
        return self

    def eq(self, field, value):
        self._filters[field] = value
        return self

    def limit(self, _n):
        return self

    def execute(self):
        return self._db._execute(self._table_name, self._op, self._payload, self._filters)


class FakeDB:
    """In-memory stand-in for the Supabase client, scoped to the `users` table.

    `users` is a plain dict of row-dicts (any keying you like — lookups match
    by whichever field .eq() was called with, not by the dict key).
    """

    def __init__(self, users: dict | None = None, rpc_return: int = 0):
        self.users = users if users is not None else {}
        self.rpc_return = rpc_return
        self.rpc_calls: list[tuple[str, dict]] = []
        self.update_calls: list[tuple[dict, dict]] = []

    def table(self, name):
        return FakeQuery(self, name)

    def _execute(self, table_name, op, payload, filters):
        if table_name != "users" or not filters:
            return FakeResult([])
        (field, value), = filters.items()
        matches = [row for row in self.users.values() if row.get(field) == value]
        if op == "update":
            self.update_calls.append((dict(filters), dict(payload)))
            for row in matches:
                row.update(payload)
        return FakeResult(matches)

    def rpc(self, name, params):
        self.rpc_calls.append((name, params))
        return _FakeRpcCall(self.rpc_return)


class FakeStripeObject(dict):
    """Stripe's SDK objects expose .to_dict() — plain dicts don't."""

    def to_dict(self):
        return dict(self)


def make_event(event_type: str, obj: dict) -> dict:
    return {"type": event_type, "data": {"object": FakeStripeObject(obj)}}


@pytest.fixture
def client():
    from app.main import app
    return TestClient(app)
