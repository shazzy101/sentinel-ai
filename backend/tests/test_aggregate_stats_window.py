"""The 24h headline must reflect moves *scored* in the window, not moves
*detected* in it. Because scoring lags detection by 24h, a detected-at window
of 24h can only ever contain still-PENDING moves — so wins(24h) is structurally
always 0. Filtering by scored time makes freshly-resolved wins show up live."""

import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from detected_moves import _aggregate_stats  # noqa: E402


def _iso(hours_ago):
    return (datetime.now(timezone.utc) - timedelta(hours=hours_ago)).isoformat()


def test_scored_window_counts_recently_scored_not_recently_detected():
    rows = [
        # Detected 30h ago, scored 2h ago, WIN → belongs in a 24h *scored* window.
        {"detected_at": _iso(30), "outcome_scored_at": _iso(2),
         "outcome_status": "WIN", "return_pct_24h": 5.0, "hypothetical_pnl_usd": 50.0},
        # Detected 2h ago, still PENDING → must NOT count (no outcome yet).
        {"detected_at": _iso(2), "outcome_scored_at": None, "outcome_status": "PENDING"},
        # Scored 40h ago → outside the 24h scored window.
        {"detected_at": _iso(60), "outcome_scored_at": _iso(40),
         "outcome_status": "LOSS", "return_pct_24h": -4.0, "hypothetical_pnl_usd": -40.0},
    ]
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    stats = _aggregate_stats(rows, since=since, by="scored")
    assert stats["wins"] == 1
    assert stats["losses"] == 0
    assert stats["resolved"] == 1


def test_detected_window_still_available_for_long_ranges():
    rows = [
        {"detected_at": _iso(2), "outcome_scored_at": None, "outcome_status": "PENDING"},
        {"detected_at": _iso(50), "outcome_scored_at": _iso(20),
         "outcome_status": "WIN", "return_pct_24h": 4.0, "hypothetical_pnl_usd": 40.0},
    ]
    since = datetime.now(timezone.utc) - timedelta(days=7)
    stats = _aggregate_stats(rows, since=since)  # default by="detected"
    assert stats["detections"] == 2
    assert stats["wins"] == 1


if __name__ == "__main__":
    test_scored_window_counts_recently_scored_not_recently_detected()
    test_detected_window_still_available_for_long_ranges()
    print("ok: aggregate_stats window tests passed")
