"""
Tests for the Signals REST API (Task 13).

Covers:
- Public GET /api/signals — never leaks pending_review
- Public GET /api/signals/{id} — 404 for missing + pending_review
- Public GET /api/track-record — correct computed stats
- compute_track_record helper math
- Admin POST /api/admin/signals — creates with pending_review
- Admin POST /api/admin/signals/{id}/approve — flips to active + sets approved_at
- Admin POST /api/admin/signals/{id}/reject — sets status=rejected
- Admin GET /api/admin/signals/pending — returns pending signals
- Admin auth guard — 401 without correct X-Admin-Key header
"""

import sys
import os
from pathlib import Path
from unittest.mock import MagicMock, patch

# ---------------------------------------------------------------------------
# Path setup — ensure backend/ is importable.
# ---------------------------------------------------------------------------
_BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND))

# ---------------------------------------------------------------------------
# Stub heavy dependencies before importing app so tests stay offline.
# ---------------------------------------------------------------------------

# Stub config (loads .env) — must come before any backend module.
config_mod = MagicMock()
sys.modules.setdefault("config", config_mod)

# Stub Supabase so supabase_client is a MagicMock (not a real connection).
import db.supabase as _supa_mod  # noqa: E402

_mock_supa = MagicMock()
_mock_supa.table.return_value = _mock_supa
_mock_supa.select.return_value = _mock_supa
_mock_supa.insert.return_value = _mock_supa
_mock_supa.update.return_value = _mock_supa
_mock_supa.upsert.return_value = _mock_supa
_mock_supa.eq.return_value = _mock_supa
_mock_supa.order.return_value = _mock_supa
_mock_supa.limit.return_value = _mock_supa
_mock_result = MagicMock()
_mock_result.data = []
_mock_supa.execute.return_value = _mock_result
_supa_mod.supabase_client = _mock_supa

# Stub other heavy backend modules that main.py imports.
for _mod in (
    "sentry_sdk",
    "sentry_sdk.integrations.fastapi",
    "slowapi",
    "slowapi.util",
    "slowapi.errors",
    "httpx",
    "chains.ethereum",
    "ai.analyst",
    "integrations.dune",
    "integrations.resend",
    "observability",
    "auth_context",
    "quota",
    "rate_limits",
    "responses",
    "performance",
    "copy_traders_store",
    "copy_trader_moves",
    "detected_moves",
    "scoring.engine",
    "copy_trading_live",
    "integrations",
):
    if _mod not in sys.modules:
        sys.modules[_mod] = MagicMock()

# responses.error / responses.success need real return types for TestClient.
from fastapi.responses import JSONResponse  # noqa: E402

def _mk_resp(code_key, msg, status_code=200, details=None):
    body = {"error": code_key, "message": msg}
    if details:
        body["details"] = details
    return JSONResponse(content=body, status_code=status_code)

def _mk_success(data, status_code=200):
    return JSONResponse(content={"data": data}, status_code=status_code)

sys.modules["responses"].error = _mk_resp
sys.modules["responses"].success = _mk_success
sys.modules["responses"].quota_error = MagicMock(return_value=_mk_resp("QUOTA", "q"))

# observability stubs
sys.modules["observability"].setup_logging = MagicMock()
sys.modules["observability"].bind_request_context = MagicMock()
sys.modules["observability"].log_error = MagicMock()
sys.modules["observability"].log_info = MagicMock()
sys.modules["observability"].new_request_id = MagicMock(return_value="test-rid")

# auth_context stub
_anon_user = MagicMock()
_anon_user.user_id = None
_anon_user.plan = "anonymous"
import asyncio as _asyncio

async def _resolve_user(auth):
    return _anon_user
sys.modules["auth_context"].resolve_user = _resolve_user

# quota stubs
sys.modules["quota"].try_consume_scan_quota = MagicMock(return_value=(True, MagicMock()))
sys.modules["quota"].get_quota_status = MagicMock()
sys.modules["quota"].consume_global_budget = MagicMock()
sys.modules["quota"].record_token_usage = MagicMock()

# rate_limits
sys.modules["rate_limits"].rate_limit_key = MagicMock(return_value="127.0.0.1")
sys.modules["rate_limits"].rate_limit_message = MagicMock(return_value="Rate limited")

# slowapi
_limiter = MagicMock()
_limiter.limit = MagicMock(return_value=lambda fn: fn)
sys.modules["slowapi"].Limiter = MagicMock(return_value=_limiter)
sys.modules["slowapi.util"].get_remote_address = MagicMock(return_value="127.0.0.1")
sys.modules["slowapi.errors"].RateLimitExceeded = Exception

# chains.ethereum
sys.modules["chains.ethereum"].ChainAdapterError = type("ChainAdapterError", (Exception,), {"code": "ERR", "message": "", "details": {}})
sys.modules["chains.ethereum"].get_eth_balance = MagicMock()
sys.modules["chains.ethereum"].get_eth_transactions = MagicMock()
sys.modules["chains.ethereum"].get_eth_transactions_since = MagicMock()
sys.modules["chains.ethereum"].get_eth_token_transfers = MagicMock()
sys.modules["chains.ethereum"].discover_whale_addresses = MagicMock()

# ai.analyst
sys.modules["ai.analyst"].analyze_wallet = MagicMock()
sys.modules["ai.analyst"].calls_remaining = MagicMock(return_value=100)
sys.modules["ai.analyst"].get_market_summary = MagicMock()
sys.modules["ai.analyst"].init_analyst = MagicMock()
sys.modules["ai.analyst"].MAX_CALLS_PER_HOUR = 100

# performance
sys.modules["performance"].compute_ytd_growth = MagicMock(return_value={"ytd_pct": 0, "ytd_start_balance": 0, "sparkline": []})
sys.modules["performance"].downsample_sparkline = MagicMock(return_value=[])
sys.modules["performance"].build_copy_trader_sparkline = MagicMock()
sys.modules["performance"].estimate_supplemental_metrics = MagicMock()

# copy_traders_store
sys.modules["copy_traders_store"].copy_traders_meta = MagicMock(return_value={})
sys.modules["copy_traders_store"].find_copy_trader_by_address = MagicMock()
sys.modules["copy_traders_store"].invalidate_copy_traders_cache = MagicMock()
sys.modules["copy_traders_store"].is_exchange_trader = MagicMock(return_value=False)
sys.modules["copy_traders_store"].load_copy_traders = MagicMock()
sys.modules["copy_traders_store"].sync_copy_traders_to_db = MagicMock(return_value={"synced": 0, "total": 0})

# copy_trader_moves
sys.modules["copy_trader_moves"].fetch_recent_copy_moves = MagicMock()

# detected_moves
sys.modules["detected_moves"].get_marketing_snapshot = MagicMock()
sys.modules["detected_moves"].get_pending_preview = MagicMock()
sys.modules["detected_moves"].get_trust_pulse = MagicMock()
sys.modules["detected_moves"].run_trust_pipeline = MagicMock()

# scoring
sys.modules["scoring.engine"].score_wallet = MagicMock(return_value={"score": 50, "grade": "B", "breakdown": {}})

# integrations
sys.modules["integrations"].dune = MagicMock()
sys.modules["integrations.dune"].is_configured = MagicMock(return_value=False)
sys.modules["integrations.dune"].get_latest_results = MagicMock(return_value=[])
sys.modules["integrations.dune"].QUERY_NETWORK_PULSE = 1
sys.modules["integrations.dune"].QUERY_TOP_TOKENS = 2
sys.modules["integrations.dune"].QUERY_WHALE_TRADES = 3
sys.modules["integrations"].resend = MagicMock()
sys.modules["integrations.resend"].is_configured = MagicMock(return_value=False)

# copy_trading_live
sys.modules["copy_trading_live"].warm_live_metrics = MagicMock()
sys.modules["copy_trading_live"].load_live_metrics_cache = MagicMock()

# Now import the app and test client.
os.environ.setdefault("ADMIN_API_KEY", "test-admin-key")
os.environ.setdefault("SUPABASE_URL", "https://fake.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "fake-key")

from fastapi.testclient import TestClient  # noqa: E402
import main  # noqa: E402  — triggers app + router registration
import signals_api  # noqa: E402

client = TestClient(main.app, raise_server_exceptions=False)

_ADMIN_HEADERS = {"X-Admin-Key": "test-admin-key"}

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

SAMPLE_ACTIVE = {
    "id": "sig-active-1",
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
    "status": "active",
    "outcome_return": None,
    "tweet_id": None,
    "approved_at": "2026-06-16T01:00:00+00:00",
    "resolved_at": None,
}

SAMPLE_PENDING = {
    **SAMPLE_ACTIVE,
    "id": "sig-pending-1",
    "status": "pending_review",
    "approved_at": None,
}

SAMPLE_WIN = {
    **SAMPLE_ACTIVE,
    "id": "sig-win-1",
    "status": "win",
    "outcome_return": 12.5,
    "confidence": 4,
}

SAMPLE_LOSS = {
    **SAMPLE_ACTIVE,
    "id": "sig-loss-1",
    "status": "loss",
    "outcome_return": -5.0,
    "confidence": 3,
}


# ---------------------------------------------------------------------------
# compute_track_record — pure unit tests (no HTTP)
# ---------------------------------------------------------------------------

class TestComputeTrackRecord:
    def test_empty_signals(self):
        result = signals_api.compute_track_record([])
        assert result["total_signals"] == 0
        assert result["wins"] == 0
        assert result["losses"] == 0
        assert result["win_rate"] == 0.0
        assert result["avg_return"] == 0.0
        assert result["best_signal_return"] == 0.0
        assert result["worst_signal_return"] == 0.0
        for tier in range(1, 6):
            assert result["per_confidence"][str(tier)]["count"] == 0

    def test_win_rate_calculation(self):
        signals = [SAMPLE_WIN, SAMPLE_LOSS, {**SAMPLE_WIN, "id": "sig-win-2"}]
        result = signals_api.compute_track_record(signals)
        assert result["total_signals"] == 3
        assert result["wins"] == 2
        assert result["losses"] == 1
        assert abs(result["win_rate"] - round(2 / 3, 4)) < 1e-6

    def test_avg_return(self):
        signals = [SAMPLE_WIN, SAMPLE_LOSS]  # returns: 12.5 and -5.0
        result = signals_api.compute_track_record(signals)
        expected_avg = round((12.5 + (-5.0)) / 2, 4)
        assert abs(result["avg_return"] - expected_avg) < 1e-6

    def test_best_and_worst_return(self):
        signals = [SAMPLE_WIN, SAMPLE_LOSS]
        result = signals_api.compute_track_record(signals)
        assert result["best_signal_return"] == 12.5
        assert result["worst_signal_return"] == -5.0

    def test_per_confidence_tier(self):
        # SAMPLE_WIN has confidence=4, outcome_return=12.5 (win)
        # SAMPLE_LOSS has confidence=3, outcome_return=-5.0 (loss)
        result = signals_api.compute_track_record([SAMPLE_WIN, SAMPLE_LOSS])
        tier4 = result["per_confidence"]["4"]
        assert tier4["count"] == 1
        assert tier4["win_rate"] == 1.0
        assert tier4["avg_return"] == 12.5

        tier3 = result["per_confidence"]["3"]
        assert tier3["count"] == 1
        assert tier3["win_rate"] == 0.0
        assert tier3["avg_return"] == -5.0

    def test_pending_signals_excluded(self):
        """Active/pending signals must not pollute the track record."""
        signals = [SAMPLE_WIN, SAMPLE_PENDING, SAMPLE_ACTIVE]
        result = signals_api.compute_track_record(signals)
        # Only SAMPLE_WIN is win/loss; active and pending are ignored
        assert result["total_signals"] == 1
        assert result["wins"] == 1

    def test_missing_outcome_return_excluded_from_avg(self):
        no_return = {**SAMPLE_WIN, "id": "no-ret", "outcome_return": None}
        result = signals_api.compute_track_record([no_return])
        # win counted but returns list is empty → avg/best/worst are 0
        assert result["wins"] == 1
        assert result["avg_return"] == 0.0


# ---------------------------------------------------------------------------
# Public GET /api/signals
# ---------------------------------------------------------------------------

class TestListPublicSignals:
    def test_returns_active_signals(self):
        with patch("signals_api.list_signals", return_value=[SAMPLE_ACTIVE]):
            resp = client.get("/api/signals")
        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] == 1
        assert body["signals"][0]["id"] == "sig-active-1"

    def test_never_returns_pending_review_by_default(self):
        # Mix of active and pending — pending must be filtered out.
        with patch("signals_api.list_signals", return_value=[SAMPLE_ACTIVE, SAMPLE_PENDING]):
            resp = client.get("/api/signals")
        assert resp.status_code == 200
        ids = [s["id"] for s in resp.json()["signals"]]
        assert "sig-pending-1" not in ids
        assert "sig-active-1" in ids

    def test_explicit_pending_review_status_returns_empty(self):
        """Passing status=pending_review must not leak pending signals."""
        with patch("signals_api.list_signals", return_value=[SAMPLE_PENDING]):
            resp = client.get("/api/signals?status=pending_review")
        assert resp.status_code == 200
        assert resp.json()["signals"] == []
        assert resp.json()["count"] == 0

    def test_status_filter_active(self):
        with patch("signals_api.list_signals", return_value=[SAMPLE_ACTIVE]) as mock_ls:
            resp = client.get("/api/signals?status=active")
        assert resp.status_code == 200
        assert resp.json()["count"] == 1

    def test_unknown_status_returns_empty(self):
        resp = client.get("/api/signals?status=unicorn")
        assert resp.status_code == 200
        assert resp.json()["signals"] == []

    def test_limit_param_respected(self):
        many = [SAMPLE_ACTIVE] * 10
        with patch("signals_api.list_signals", return_value=many):
            resp = client.get("/api/signals?limit=3")
        assert resp.status_code == 200
        assert resp.json()["count"] <= 3


# ---------------------------------------------------------------------------
# Public GET /api/signals/{id}
# ---------------------------------------------------------------------------

class TestGetPublicSignal:
    def test_returns_active_signal(self):
        with patch("signals_api.get_signal", return_value=SAMPLE_ACTIVE):
            resp = client.get("/api/signals/sig-active-1")
        assert resp.status_code == 200
        assert resp.json()["signal"]["id"] == "sig-active-1"

    def test_404_when_not_found(self):
        with patch("signals_api.get_signal", return_value=None):
            resp = client.get("/api/signals/nonexistent")
        assert resp.status_code == 404

    def test_404_for_pending_review(self):
        """A pending_review signal must return 404, not the signal data."""
        with patch("signals_api.get_signal", return_value=SAMPLE_PENDING):
            resp = client.get("/api/signals/sig-pending-1")
        assert resp.status_code == 404

    def test_returns_win_signal(self):
        with patch("signals_api.get_signal", return_value=SAMPLE_WIN):
            resp = client.get("/api/signals/sig-win-1")
        assert resp.status_code == 200
        assert resp.json()["signal"]["status"] == "win"


# ---------------------------------------------------------------------------
# Public GET /api/track-record
# ---------------------------------------------------------------------------

class TestTrackRecord:
    def test_returns_correct_stats(self):
        with patch("signals_api.list_signals", return_value=[SAMPLE_WIN, SAMPLE_LOSS]):
            resp = client.get("/api/track-record")
        assert resp.status_code == 200
        tr = resp.json()["track_record"]
        assert tr["wins"] == 1
        assert tr["losses"] == 1
        assert tr["total_signals"] == 2
        assert abs(tr["win_rate"] - 0.5) < 1e-6

    def test_empty_track_record(self):
        with patch("signals_api.list_signals", return_value=[]):
            resp = client.get("/api/track-record")
        assert resp.status_code == 200
        tr = resp.json()["track_record"]
        assert tr["total_signals"] == 0
        assert tr["win_rate"] == 0.0

    def test_pending_not_counted(self):
        with patch("signals_api.list_signals", return_value=[SAMPLE_WIN, SAMPLE_PENDING]):
            resp = client.get("/api/track-record")
        tr = resp.json()["track_record"]
        assert tr["total_signals"] == 1  # only win counts


# ---------------------------------------------------------------------------
# Admin GET /api/admin/signals/pending
# ---------------------------------------------------------------------------

class TestAdminListPending:
    def test_requires_admin(self):
        resp = client.get("/api/admin/signals/pending")
        assert resp.status_code == 401

    def test_returns_pending_signals(self):
        with patch("signals_api.list_pending_signals", return_value=[SAMPLE_PENDING]):
            resp = client.get("/api/admin/signals/pending", headers=_ADMIN_HEADERS)
        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] == 1
        assert body["signals"][0]["status"] == "pending_review"


# ---------------------------------------------------------------------------
# Admin POST /api/admin/signals/{id}/approve
# ---------------------------------------------------------------------------

class TestAdminApprove:
    def test_requires_admin(self):
        resp = client.post("/api/admin/signals/sig-pending-1/approve")
        assert resp.status_code == 401

    def test_approve_sets_active_and_approved_at(self):
        approved = {**SAMPLE_PENDING, "status": "active", "approved_at": "2026-06-16T02:00:00+00:00"}
        with patch("signals_api.get_signal", return_value=SAMPLE_PENDING), \
             patch("signals_api.update_signal", return_value=approved) as mock_update:
            resp = client.post(
                "/api/admin/signals/sig-pending-1/approve",
                headers=_ADMIN_HEADERS,
            )
        assert resp.status_code == 200
        # Verify the payload passed to update_signal contains status=active + approved_at
        call_args = mock_update.call_args
        update_payload = call_args[0][1]  # positional arg 1
        assert update_payload["status"] == "active"
        assert "approved_at" in update_payload
        # approved_at must be a non-empty ISO string
        assert isinstance(update_payload["approved_at"], str)
        assert update_payload["approved_at"] != ""
        # Response should include the updated signal
        assert resp.json()["signal"]["status"] == "active"

    def test_approve_404_for_missing_signal(self):
        with patch("signals_api.get_signal", return_value=None):
            resp = client.post(
                "/api/admin/signals/nonexistent/approve",
                headers=_ADMIN_HEADERS,
            )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Admin POST /api/admin/signals/{id}/reject
# ---------------------------------------------------------------------------

class TestAdminReject:
    def test_requires_admin(self):
        resp = client.post("/api/admin/signals/sig-pending-1/reject")
        assert resp.status_code == 401

    def test_reject_sets_status_rejected(self):
        rejected = {**SAMPLE_PENDING, "status": "rejected"}
        with patch("signals_api.get_signal", return_value=SAMPLE_PENDING), \
             patch("signals_api.update_signal", return_value=rejected) as mock_update:
            resp = client.post(
                "/api/admin/signals/sig-pending-1/reject",
                headers=_ADMIN_HEADERS,
            )
        assert resp.status_code == 200
        call_args = mock_update.call_args
        update_payload = call_args[0][1]
        assert update_payload["status"] == "rejected"
        assert resp.json()["signal"]["status"] == "rejected"

    def test_reject_404_for_missing_signal(self):
        with patch("signals_api.get_signal", return_value=None):
            resp = client.post(
                "/api/admin/signals/nonexistent/reject",
                headers=_ADMIN_HEADERS,
            )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Admin POST /api/admin/signals — manual signal entry
# ---------------------------------------------------------------------------

VALID_SIGNAL_BODY = {
    "asset": "BTC",
    "direction": "long",
    "confidence": 3,
    "entry_low": 60000,
    "entry_high": 61000,
    "target": 70000,
    "stop_loss": 55000,
    "explanation": "Whale consolidation detected",
    "pattern_type": "consolidation",
    "whale_wallets": ["0xBBB"],
    "tx_hashes": ["0xtx2"],
}


class TestAdminCreateSignal:
    def test_requires_admin(self):
        resp = client.post("/api/admin/signals", json=VALID_SIGNAL_BODY)
        assert resp.status_code == 401

    def test_creates_signal_with_pending_review(self):
        created = {**VALID_SIGNAL_BODY, "id": "new-sig", "status": "pending_review"}
        with patch("signals_api.insert_signal", return_value=created) as mock_insert:
            resp = client.post(
                "/api/admin/signals",
                json=VALID_SIGNAL_BODY,
                headers=_ADMIN_HEADERS,
            )
        assert resp.status_code == 200
        # Verify insert_signal was called with status=pending_review
        inserted_data = mock_insert.call_args[0][0]
        assert inserted_data["status"] == "pending_review"
        assert resp.json()["signal"]["status"] == "pending_review"

    def test_rejects_invalid_direction(self):
        body = {**VALID_SIGNAL_BODY, "direction": "sideways"}
        resp = client.post("/api/admin/signals", json=body, headers=_ADMIN_HEADERS)
        assert resp.status_code == 422

    def test_rejects_confidence_out_of_range_high(self):
        body = {**VALID_SIGNAL_BODY, "confidence": 6}
        resp = client.post("/api/admin/signals", json=body, headers=_ADMIN_HEADERS)
        assert resp.status_code == 422

    def test_rejects_confidence_out_of_range_low(self):
        body = {**VALID_SIGNAL_BODY, "confidence": 0}
        resp = client.post("/api/admin/signals", json=body, headers=_ADMIN_HEADERS)
        assert resp.status_code == 422

    def test_rejects_missing_required_fields(self):
        resp = client.post("/api/admin/signals", json={}, headers=_ADMIN_HEADERS)
        assert resp.status_code == 422

    def test_accepts_short_direction(self):
        body = {**VALID_SIGNAL_BODY, "direction": "short"}
        created = {**body, "id": "new-sig-2", "status": "pending_review"}
        with patch("signals_api.insert_signal", return_value=created):
            resp = client.post("/api/admin/signals", json=body, headers=_ADMIN_HEADERS)
        assert resp.status_code == 200
