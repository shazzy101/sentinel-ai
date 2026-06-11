"""Tests for scoring-engine success-rate counting (PHASE 1.2)."""

import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scoring.engine import _tx_succeeded, score_wallet  # noqa: E402


def test_tx_succeeded_canonical_is_error_wins():
    assert _tx_succeeded({"is_error": False}) is True
    assert _tx_succeeded({"is_error": True}) is False
    # Canonical flag wins even if a raw field disagrees.
    assert _tx_succeeded({"is_error": True, "isError": "0"}) is False


def test_tx_succeeded_raw_etherscan_fallback():
    assert _tx_succeeded({"isError": "0"}) is True
    assert _tx_succeeded({"isError": "1"}) is False
    assert _tx_succeeded({"status": "success"}) is True
    assert _tx_succeeded({"status": "0"}) is False


def test_tx_succeeded_unknown_assumes_success():
    assert _tx_succeeded({}) is True


def test_mixed_success_failed_win_rate():
    now = datetime.now(timezone.utc).isoformat()
    txs = [
        {"timestamp": now, "is_error": False},
        {"timestamp": now, "is_error": False},
        {"timestamp": now, "is_error": False},
        {"timestamp": now, "is_error": True},   # one failure
    ]
    result = score_wallet(txs, balance=10.0, chain="ethereum", address="0xtest")
    # 3 of 4 succeeded → 75% win rate.
    assert result["win_rate"] == 75.0


if __name__ == "__main__":
    test_tx_succeeded_canonical_is_error_wins()
    test_tx_succeeded_raw_etherscan_fallback()
    test_tx_succeeded_unknown_assumes_success()
    test_mixed_success_failed_win_rate()
    print("ok: scoring success-rate tests passed")
