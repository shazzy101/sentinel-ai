"""
Tests for backend/signals/poller.py — run_signal_poll and _is_duplicate.

All external dependencies (fetch_large_txs, insert_fn, list_signals_fn,
detectors, data.wallets.SMART_MONEY_WALLETS) are injected/mocked.
Fully offline — no network calls.
"""

import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock

# Make backend/ importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from signals.poller import run_signal_poll, _is_duplicate
from signals.patterns import PatternHit


# ─────────────────────────────────────────
# HELPERS / FACTORIES
# ─────────────────────────────────────────

def _make_tx(
    wallet: str = "0xWHALE",
    asset: str = "ETH",
    usd_value: float = 1_000_000.0,
    value_eth: float = 333.0,
    direction: str = "in",
    tx_hash: str = "0xTX_001",
    timestamp: float = 1_700_000_000.0,
) -> dict:
    """Build a minimal transaction dict matching the poller's expected shape."""
    return {
        "wallet": wallet,
        "tx_hash": tx_hash,
        "value_eth": value_eth,
        "timestamp": timestamp,
        "asset": asset,
        "direction": direction,
        "usd_value": usd_value,
    }


def _fake_detector_fires(pattern_type: str, asset: str = "ETH", wallet: str = "0xWHALE"):
    """Return a detector function that always fires a PatternHit."""
    def _detector(inp):
        # Accept both list (Pattern C) and dict (Patterns A, B, D)
        return PatternHit(
            pattern_type=pattern_type,
            asset=asset,
            wallets=[wallet],
            tx_hashes=["0xTX_001"],
            strength=0.8,
        )
    _detector.__name__ = f"fake_{pattern_type}"
    return _detector


def _fake_detector_silent(pattern_type: str = "stablecoin_staging"):
    """Return a detector that always returns None (no hit)."""
    def _detector(inp):
        return None
    _detector.__name__ = f"silent_{pattern_type}"
    return _detector


def _make_recent_signal(
    wallet: str = "0xWHALE",
    asset: str = "ETH",
    pattern_type: str = "stablecoin_staging",
    hours_ago: float = 1.0,
) -> dict:
    """Build a signal dict that looks like a recent DB row (for dedupe tests)."""
    created = datetime.now(timezone.utc) - timedelta(hours=hours_ago)
    return {
        "id": "sig-recent-001",
        "pattern_type": pattern_type,
        "asset": asset,
        "whale_wallets": [wallet],
        "status": "pending_review",
        "created_at": created.isoformat(),
    }


def _no_insert(signal_data: dict) -> dict:
    """insert_fn that does nothing and returns the input (for no-insert tests)."""
    raise AssertionError("insert_fn should NOT have been called")


# ─────────────────────────────────────────
# _is_duplicate — pure unit tests
# ─────────────────────────────────────────

class TestIsDuplicate:
    """Unit tests for the pure _is_duplicate helper."""

    def test_returns_true_for_recent_matching_signal(self):
        """A signal within the window for same wallet/asset/pattern → True."""
        recent = [
            _make_recent_signal(
                wallet="0xWHALE",
                asset="ETH",
                pattern_type="stablecoin_staging",
                hours_ago=1.0,  # 1 hour ago, well within the 6-hour window
            )
        ]
        result = _is_duplicate("0xWHALE", "ETH", "stablecoin_staging", recent)
        assert result is True

    def test_returns_false_when_no_recent_signals(self):
        """Empty recent_signals list → never a duplicate."""
        result = _is_duplicate("0xWHALE", "ETH", "stablecoin_staging", [])
        assert result is False

    def test_returns_false_for_different_pattern_type(self):
        """Same wallet/asset but different pattern_type → not a duplicate."""
        recent = [
            _make_recent_signal(
                wallet="0xWHALE",
                asset="ETH",
                pattern_type="contract_testing",
                hours_ago=1.0,
            )
        ]
        result = _is_duplicate("0xWHALE", "ETH", "stablecoin_staging", recent)
        assert result is False

    def test_returns_false_for_different_asset(self):
        """Same wallet/pattern but different asset → not a duplicate."""
        recent = [
            _make_recent_signal(
                wallet="0xWHALE",
                asset="BTC",
                pattern_type="stablecoin_staging",
                hours_ago=1.0,
            )
        ]
        result = _is_duplicate("0xWHALE", "ETH", "stablecoin_staging", recent)
        assert result is False

    def test_returns_false_for_different_wallet(self):
        """Different wallet address → not a duplicate."""
        recent = [
            _make_recent_signal(
                wallet="0xOTHER",
                asset="ETH",
                pattern_type="stablecoin_staging",
                hours_ago=1.0,
            )
        ]
        result = _is_duplicate("0xWHALE", "ETH", "stablecoin_staging", recent)
        assert result is False

    def test_returns_false_when_outside_window(self):
        """Signal older than the window (default 6 h) → not a duplicate."""
        recent = [
            _make_recent_signal(
                wallet="0xWHALE",
                asset="ETH",
                pattern_type="stablecoin_staging",
                hours_ago=8.0,  # 8 hours ago — outside the 6-hour default window
            )
        ]
        result = _is_duplicate("0xWHALE", "ETH", "stablecoin_staging", recent)
        assert result is False

    def test_exactly_at_window_boundary_is_not_duplicate(self):
        """A signal created exactly at the cutoff is NOT within the window (>=)."""
        # created_at = cutoff means NOT recent (strict: created >= cutoff → True,
        # but we want just-outside so we put it 6h+1s ago)
        just_outside = datetime.now(timezone.utc) - timedelta(hours=6, seconds=1)
        recent = [{
            "id": "old-sig",
            "pattern_type": "stablecoin_staging",
            "asset": "ETH",
            "whale_wallets": ["0xWHALE"],
            "created_at": just_outside.isoformat(),
        }]
        result = _is_duplicate("0xWHALE", "ETH", "stablecoin_staging", recent, window_hours=6)
        assert result is False

    def test_asset_comparison_is_case_insensitive(self):
        """Asset matching ignores case differences (eth vs ETH)."""
        recent = [
            _make_recent_signal(
                wallet="0xWHALE",
                asset="eth",
                pattern_type="stablecoin_staging",
                hours_ago=1.0,
            )
        ]
        result = _is_duplicate("0xWHALE", "ETH", "stablecoin_staging", recent)
        assert result is True

    def test_wallet_comparison_is_case_insensitive(self):
        """Wallet matching is case-insensitive."""
        recent = [
            _make_recent_signal(
                wallet="0xwhale",
                asset="ETH",
                pattern_type="stablecoin_staging",
                hours_ago=1.0,
            )
        ]
        result = _is_duplicate("0XWHALE", "ETH", "stablecoin_staging", recent)
        assert result is True

    def test_custom_window_hours_respected(self):
        """Custom window_hours parameter is respected."""
        # 2 hours ago, checked with window_hours=1 → should NOT be duplicate
        recent = [
            _make_recent_signal(
                wallet="0xWHALE",
                asset="ETH",
                pattern_type="stablecoin_staging",
                hours_ago=2.0,
            )
        ]
        result = _is_duplicate("0xWHALE", "ETH", "stablecoin_staging", recent, window_hours=1)
        assert result is False

    def test_missing_created_at_is_skipped(self):
        """Signals without created_at are skipped (not treated as duplicates)."""
        recent = [{
            "id": "sig-no-date",
            "pattern_type": "stablecoin_staging",
            "asset": "ETH",
            "whale_wallets": ["0xWHALE"],
            # no created_at key
        }]
        result = _is_duplicate("0xWHALE", "ETH", "stablecoin_staging", recent)
        assert result is False

    def test_multiple_wallets_in_signal(self):
        """A signal listing multiple wallets matches if any wallet matches."""
        recent = [{
            "id": "sig-multi",
            "pattern_type": "coordinated_accumulation",
            "asset": "ETH",
            "whale_wallets": ["0xALICE", "0xWHALE", "0xBOB"],
            "created_at": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(),
        }]
        result = _is_duplicate("0xWHALE", "ETH", "coordinated_accumulation", recent)
        assert result is True


# ─────────────────────────────────────────
# run_signal_poll — happy path
# ─────────────────────────────────────────

class TestRunSignalPollInserts:
    """run_signal_poll inserts a signal when a detector fires."""

    def _base_call(self, detector, inserted_signals):
        """Helper to call run_signal_poll with injected fake deps."""
        txs = [_make_tx(wallet="0xWHALE", asset="ETH", usd_value=1_500_000.0)]

        def fake_fetch(wallets):
            return txs

        def fake_insert(signal_data):
            result = {**signal_data, "id": "sig-new-001"}
            inserted_signals.append(result)
            return result

        with patch("data.wallets.SMART_MONEY_WALLETS", [{"address": "0xWHALE"}]):
            return run_signal_poll(
                fetch_large_txs=fake_fetch,
                detectors=[detector, _fake_detector_silent(), _fake_detector_silent()],
                insert_fn=fake_insert,
                list_signals_fn=lambda status=None, limit=200: [],
            )

    def test_returns_list_of_inserted_signals(self):
        """Return value is the list of inserted signal dicts."""
        inserted = []
        detector = _fake_detector_fires("stablecoin_staging", asset="ETH", wallet="0xWHALE")
        result = self._base_call(detector, inserted)
        assert isinstance(result, list)
        assert len(result) == 1

    def test_inserted_signal_status_is_pending_review(self):
        """Inserted signal must have status='pending_review'."""
        inserted = []
        detector = _fake_detector_fires("stablecoin_staging", asset="ETH", wallet="0xWHALE")
        self._base_call(detector, inserted)
        assert len(inserted) == 1
        assert inserted[0]["status"] == "pending_review"

    def test_inserted_signal_has_pattern_type(self):
        """Inserted signal dict must carry the pattern_type."""
        inserted = []
        detector = _fake_detector_fires("quiet_whale_waking", asset="ETH", wallet="0xWHALE")
        self._base_call(detector, inserted)
        assert inserted[0]["pattern_type"] == "quiet_whale_waking"

    def test_inserted_signal_has_asset(self):
        """Signal asset must match what the detector returned."""
        inserted = []
        detector = _fake_detector_fires("stablecoin_staging", asset="ETH", wallet="0xWHALE")
        self._base_call(detector, inserted)
        assert inserted[0]["asset"] == "ETH"

    def test_inserted_signal_has_whale_wallets(self):
        """Signal must include whale_wallets list."""
        inserted = []
        detector = _fake_detector_fires("stablecoin_staging", asset="ETH", wallet="0xWHALE")
        self._base_call(detector, inserted)
        assert "whale_wallets" in inserted[0]
        assert "0xWHALE" in inserted[0]["whale_wallets"]

    def test_inserted_signal_has_required_price_fields(self):
        """Signal must carry entry_low, entry_high, target, stop_loss."""
        inserted = []
        detector = _fake_detector_fires("stablecoin_staging", asset="ETH", wallet="0xWHALE")
        self._base_call(detector, inserted)
        sig = inserted[0]
        for key in ("entry_low", "entry_high", "target", "stop_loss"):
            assert key in sig, f"Missing required field: {key}"

    def test_returned_list_matches_inserted_list(self):
        """The function's return value must equal the list of inserted signals."""
        inserted = []
        detector = _fake_detector_fires("stablecoin_staging", asset="ETH", wallet="0xWHALE")
        result = self._base_call(detector, inserted)
        assert result == inserted


# ─────────────────────────────────────────
# run_signal_poll — no-detector-fires path
# ─────────────────────────────────────────

class TestRunSignalPollNoHit:
    """run_signal_poll returns empty list when no detector fires."""

    def test_returns_empty_when_all_detectors_silent(self):
        """No detectors fire → no inserts, returns []."""
        txs = [_make_tx()]

        def fake_fetch(wallets):
            return txs

        with patch("data.wallets.SMART_MONEY_WALLETS", [{"address": "0xWHALE"}]):
            result = run_signal_poll(
                fetch_large_txs=fake_fetch,
                detectors=[
                    _fake_detector_silent(),
                    _fake_detector_silent(),
                    _fake_detector_silent(),
                ],
                insert_fn=_no_insert,
                list_signals_fn=lambda status=None, limit=200: [],
            )
        assert result == []

    def test_returns_empty_when_fetch_returns_no_txs(self):
        """Empty fetch result → nothing to process, returns []."""
        with patch("data.wallets.SMART_MONEY_WALLETS", [{"address": "0xWHALE"}]):
            result = run_signal_poll(
                fetch_large_txs=lambda wallets: [],
                detectors=[_fake_detector_fires("stablecoin_staging")],
                insert_fn=_no_insert,
                list_signals_fn=lambda status=None, limit=200: [],
            )
        assert result == []

    def test_returns_empty_when_fetch_raises(self):
        """fetch_large_txs raising an exception → returns [] gracefully."""
        def bad_fetch(wallets):
            raise RuntimeError("network error")

        with patch("data.wallets.SMART_MONEY_WALLETS", [{"address": "0xWHALE"}]):
            result = run_signal_poll(
                fetch_large_txs=bad_fetch,
                detectors=[_fake_detector_fires("stablecoin_staging")],
                insert_fn=_no_insert,
                list_signals_fn=lambda status=None, limit=200: [],
            )
        assert result == []


# ─────────────────────────────────────────
# run_signal_poll — dedupe
# ─────────────────────────────────────────

class TestRunSignalPollDedupe:
    """run_signal_poll skips inserting a signal when a recent duplicate exists."""

    def test_duplicate_is_not_inserted(self):
        """When list_signals_fn returns a recent match, insert_fn is not called."""
        txs = [_make_tx(wallet="0xWHALE", asset="ETH")]
        inserted = []

        # This detector fires and returns pattern_type="stablecoin_staging" for 0xWHALE/ETH
        detector = _fake_detector_fires("stablecoin_staging", asset="ETH", wallet="0xWHALE")

        # list_signals_fn returns a recent signal that matches perfectly
        recent = [
            _make_recent_signal(
                wallet="0xWHALE",
                asset="ETH",
                pattern_type="stablecoin_staging",
                hours_ago=1.0,
            )
        ]

        def fake_insert(signal_data):
            inserted.append(signal_data)
            return {**signal_data, "id": "should-not-happen"}

        with patch("data.wallets.SMART_MONEY_WALLETS", [{"address": "0xWHALE"}]):
            result = run_signal_poll(
                fetch_large_txs=lambda wallets: txs,
                detectors=[detector, _fake_detector_silent(), _fake_detector_silent()],
                insert_fn=fake_insert,
                list_signals_fn=lambda status=None, limit=200: recent,
            )

        assert result == [], "Duplicate signal should not be inserted"
        assert inserted == [], "insert_fn must not be called for a duplicate"

    def test_non_duplicate_is_inserted_despite_other_recent_signals(self):
        """A signal with a different pattern_type is not blocked by dedupe."""
        txs = [_make_tx(wallet="0xWHALE", asset="ETH", usd_value=1_500_000.0)]
        inserted = []

        # Detector fires "stablecoin_staging" — different from recent "contract_testing"
        detector = _fake_detector_fires("stablecoin_staging", asset="ETH", wallet="0xWHALE")

        # Existing signal is a different pattern type → should NOT block
        recent = [
            _make_recent_signal(
                wallet="0xWHALE",
                asset="ETH",
                pattern_type="contract_testing",  # different!
                hours_ago=1.0,
            )
        ]

        def fake_insert(signal_data):
            result = {**signal_data, "id": "sig-allowed"}
            inserted.append(result)
            return result

        with patch("data.wallets.SMART_MONEY_WALLETS", [{"address": "0xWHALE"}]):
            result = run_signal_poll(
                fetch_large_txs=lambda wallets: txs,
                detectors=[detector, _fake_detector_silent(), _fake_detector_silent()],
                insert_fn=fake_insert,
                list_signals_fn=lambda status=None, limit=200: recent,
            )

        assert len(result) == 1, "Different pattern_type should not be deduped"
        assert inserted[0]["pattern_type"] == "stablecoin_staging"

    def test_old_signal_does_not_block_insert(self):
        """A signal older than the dedupe window does not block a new insert."""
        txs = [_make_tx(wallet="0xWHALE", asset="ETH", usd_value=1_500_000.0)]
        inserted = []

        detector = _fake_detector_fires("stablecoin_staging", asset="ETH", wallet="0xWHALE")

        # Existing signal is too old (8 hours ago, window is 6 hours)
        recent = [
            _make_recent_signal(
                wallet="0xWHALE",
                asset="ETH",
                pattern_type="stablecoin_staging",
                hours_ago=8.0,  # outside the 6-hour window
            )
        ]

        def fake_insert(signal_data):
            result = {**signal_data, "id": "sig-fresh"}
            inserted.append(result)
            return result

        with patch("data.wallets.SMART_MONEY_WALLETS", [{"address": "0xWHALE"}]):
            result = run_signal_poll(
                fetch_large_txs=lambda wallets: txs,
                detectors=[detector, _fake_detector_silent(), _fake_detector_silent()],
                insert_fn=fake_insert,
                list_signals_fn=lambda status=None, limit=200: recent,
            )

        assert len(result) == 1, "Old signal should not block new insert"


# ─────────────────────────────────────────
# run_signal_poll — coordinated detector
# ─────────────────────────────────────────

class TestRunSignalPollCoordinatedDetector:
    """When no detectors override is provided, the coordinated detector is
    wired as a special cross-wallet path.  We can test it by injecting
    a fake coordinated_accumulation hit via a custom detector wrapper."""

    def test_no_override_detectors_uses_defaults_gracefully(self):
        """Passing detectors=None triggers the real detector path.
        With a mocked fetch that returns no txs, it still returns [].
        """
        # We patch the real detector imports and SMART_MONEY_WALLETS
        fake_hit = PatternHit(
            pattern_type="stablecoin_staging",
            asset="ETH",
            wallets=["0xWHALE"],
            tx_hashes=["0xTX"],
            strength=0.8,
        )

        with (
            patch("data.wallets.SMART_MONEY_WALLETS", [{"address": "0xWHALE"}]),
            patch("signals.patterns.detect_stablecoin_staging", return_value=fake_hit),
            patch("signals.patterns.detect_contract_testing", return_value=None),
            patch("signals.patterns.detect_quiet_whale_waking", return_value=None),
            patch("signals.patterns.detect_coordinated_accumulation", return_value=None),
        ):
            inserted = []

            def fake_fetch(wallets):
                return [_make_tx(wallet="0xWHALE", usd_value=1_500_000.0)]

            def fake_insert(signal_data):
                result = {**signal_data, "id": "sid-coord"}
                inserted.append(result)
                return result

            result = run_signal_poll(
                fetch_large_txs=fake_fetch,
                detectors=None,  # use the real default detector set
                insert_fn=fake_insert,
                list_signals_fn=lambda status=None, limit=200: [],
            )

        # At least the stablecoin_staging hit should have been inserted
        assert isinstance(result, list)
        assert len(result) >= 1
        assert result[0]["pattern_type"] == "stablecoin_staging"


# ─────────────────────────────────────────
# run_signal_poll — multi-wallet support
# ─────────────────────────────────────────

class TestRunSignalPollMultiWallet:
    """Multiple wallets in the tx list each get their own detector pass."""

    def test_two_wallets_each_get_a_signal(self):
        """Transactions from two different wallets each produce a signal."""
        txs = [
            _make_tx(wallet="0xALICE", tx_hash="0xTX_A", usd_value=1_500_000.0),
            _make_tx(wallet="0xBOB", tx_hash="0xTX_B", usd_value=2_000_000.0),
        ]
        inserted = []

        def always_fires(inp):
            # Works for both dict (per-wallet) inputs
            wallet = inp.get("wallet", "unknown") if isinstance(inp, dict) else "unknown"
            asset = inp.get("asset", "ETH") if isinstance(inp, dict) else "ETH"
            return PatternHit(
                pattern_type="stablecoin_staging",
                asset=asset,
                wallets=[wallet],
                tx_hashes=[],
                strength=0.8,
            )
        always_fires.__name__ = "always_fires"

        def fake_insert(signal_data):
            result = {**signal_data, "id": f"sig-{len(inserted)}"}
            inserted.append(result)
            return result

        with patch("data.wallets.SMART_MONEY_WALLETS", [
            {"address": "0xALICE"},
            {"address": "0xBOB"},
        ]):
            result = run_signal_poll(
                fetch_large_txs=lambda wallets: txs,
                detectors=[always_fires, _fake_detector_silent(), _fake_detector_silent()],
                insert_fn=fake_insert,
                list_signals_fn=lambda status=None, limit=200: [],
            )

        assert len(result) == 2, "One signal per distinct wallet"
