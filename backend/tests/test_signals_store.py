"""Tests for signals CRUD helpers in backend/db/supabase.py."""

import sys
import types
from pathlib import Path
from unittest.mock import MagicMock, patch, call

# Make `backend/` importable when run from repo root or tests/.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


# ---------------------------------------------------------------------------
# Helpers to build a mock Supabase query chain.
# The real client returns a builder that chains .select().eq().order().limit()
# then ends with .execute() returning an object with a .data attribute.
# ---------------------------------------------------------------------------

def _make_chain(return_data):
    """Return a MagicMock that returns itself for every chained call except
    .execute(), which returns an object with .data = return_data."""
    result = MagicMock()
    result.data = return_data

    chain = MagicMock()
    # Every builder method returns the same chain mock so calls can chain.
    chain.select.return_value = chain
    chain.insert.return_value = chain
    chain.update.return_value = chain
    chain.eq.return_value = chain
    chain.order.return_value = chain
    chain.limit.return_value = chain
    chain.execute.return_value = result
    return chain


def _make_client(return_data):
    """Return a mock supabase_client whose .table() produces a fresh chain."""
    client = MagicMock()
    chain = _make_chain(return_data)
    client.table.return_value = chain
    return client, chain


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

import db.supabase as supa  # noqa: E402  (after sys.path insert)


SAMPLE_SIGNAL = {
    "id": "uuid-1",
    "signal_number": 1,
    "created_at": "2026-06-16T00:00:00+00:00",
    "asset": "ETH",
    "direction": "long",
    "confidence": 4,
    "entry_low": 3000,
    "entry_high": 3100,
    "target": 3500,
    "stop_loss": 2900,
    "explanation": "Whale accumulation",
    "pattern_type": "accumulation",
    "whale_wallets": ["0xAAA"],
    "tx_hashes": ["0xtx1"],
    "status": "pending_review",
    "outcome_return": None,
    "tweet_id": None,
    "approved_at": None,
    "resolved_at": None,
}


class TestInsertSignal:
    def test_insert_returns_created_row(self):
        client, chain = _make_client([SAMPLE_SIGNAL])
        with patch.object(supa, "supabase_client", client):
            row = supa.insert_signal({"asset": "ETH", "direction": "long", "confidence": 4})

        client.table.assert_called_once_with("signals")
        chain.insert.assert_called_once_with({"asset": "ETH", "direction": "long", "confidence": 4})
        chain.select.assert_called_once_with(supa._SIGNAL_COLS)
        assert row["asset"] == "ETH"
        assert row["id"] == "uuid-1"

    def test_insert_raises_when_no_data_returned(self):
        client, chain = _make_client([])
        with patch.object(supa, "supabase_client", client):
            try:
                supa.insert_signal({"asset": "BTC", "direction": "short", "confidence": 3})
                assert False, "expected RuntimeError"
            except RuntimeError as exc:
                assert "insert_signal" in str(exc)


class TestListSignals:
    def test_list_without_filter_orders_newest_first(self):
        client, chain = _make_client([SAMPLE_SIGNAL])
        with patch.object(supa, "supabase_client", client):
            rows = supa.list_signals()

        client.table.assert_called_once_with("signals")
        chain.select.assert_called_once_with(supa._SIGNAL_COLS)
        chain.order.assert_called_once_with("created_at", desc=True)
        chain.limit.assert_called_once_with(50)
        # eq() must NOT have been called (no status filter)
        chain.eq.assert_not_called()
        assert rows == [SAMPLE_SIGNAL]

    def test_list_with_status_filter_applies_eq(self):
        client, chain = _make_client([SAMPLE_SIGNAL])
        with patch.object(supa, "supabase_client", client):
            rows = supa.list_signals(status="active", limit=10)

        chain.eq.assert_called_once_with("status", "active")
        chain.limit.assert_called_once_with(10)
        assert rows == [SAMPLE_SIGNAL]

    def test_list_returns_empty_list_when_no_data(self):
        client, chain = _make_client(None)
        with patch.object(supa, "supabase_client", client):
            rows = supa.list_signals()
        assert rows == []


class TestGetSignal:
    def test_get_returns_single_row(self):
        client, chain = _make_client([SAMPLE_SIGNAL])
        with patch.object(supa, "supabase_client", client):
            row = supa.get_signal("uuid-1")

        client.table.assert_called_once_with("signals")
        chain.eq.assert_called_once_with("id", "uuid-1")
        chain.limit.assert_called_once_with(1)
        assert row["id"] == "uuid-1"

    def test_get_returns_none_when_not_found(self):
        client, chain = _make_client([])
        with patch.object(supa, "supabase_client", client):
            row = supa.get_signal("missing-uuid")
        assert row is None

    def test_get_returns_none_when_data_is_none(self):
        client, chain = _make_client(None)
        with patch.object(supa, "supabase_client", client):
            row = supa.get_signal("any-uuid")
        assert row is None


class TestUpdateSignal:
    def test_update_sends_partial_payload_and_returns_row(self):
        updated = {**SAMPLE_SIGNAL, "status": "active"}
        client, chain = _make_client([updated])
        with patch.object(supa, "supabase_client", client):
            row = supa.update_signal("uuid-1", {"status": "active"})

        client.table.assert_called_once_with("signals")
        chain.update.assert_called_once_with({"status": "active"})
        chain.eq.assert_called_once_with("id", "uuid-1")
        chain.select.assert_called_once_with(supa._SIGNAL_COLS)
        assert row["status"] == "active"

    def test_update_raises_when_no_data_returned(self):
        client, chain = _make_client([])
        with patch.object(supa, "supabase_client", client):
            try:
                supa.update_signal("uuid-1", {"status": "win"})
                assert False, "expected RuntimeError"
            except RuntimeError as exc:
                assert "update_signal" in str(exc)


class TestListPendingSignals:
    def test_list_pending_filters_by_pending_review(self):
        client, chain = _make_client([SAMPLE_SIGNAL])
        with patch.object(supa, "supabase_client", client):
            rows = supa.list_pending_signals()

        chain.eq.assert_called_once_with("status", "pending_review")
        assert rows == [SAMPLE_SIGNAL]

    def test_list_pending_uses_high_limit(self):
        """list_pending_signals should use limit=200, not the default 50."""
        client, chain = _make_client([])
        with patch.object(supa, "supabase_client", client):
            supa.list_pending_signals()

        chain.limit.assert_called_once_with(200)
