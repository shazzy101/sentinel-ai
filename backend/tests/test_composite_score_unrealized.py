"""composite_score must use the UNREALIZED win rate when present, so a wallet
that sells winners and holds losers can't rank highly on a fake 100% realized
record. Falls back to realized win rate when unrealized isn't available."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from copy_trading_ranker import composite_score  # noqa: E402


def _metrics(**over):
    m = {
        "trade_count": 50,
        "track_record_days": 120,
        "win_rate": 100.0,
        "profit_factor": 5.0,
        "max_drawdown_pct": 0.0,
        "avg_trade_duration_hrs": 24.0,
    }
    m.update(over)
    return m


def test_unrealized_win_rate_lowers_the_score():
    fake_perfect = composite_score(_metrics())                          # realized 100%
    honest = composite_score(_metrics(unrealized_win_rate=40.0))        # bags drag to 40%
    assert honest < fake_perfect


def test_falls_back_to_realized_when_unrealized_absent():
    a = composite_score(_metrics(win_rate=80.0))
    b = composite_score(_metrics(win_rate=80.0, unrealized_win_rate=80.0))
    assert round(a, 2) == round(b, 2)


if __name__ == "__main__":
    test_unrealized_win_rate_lowers_the_score()
    test_falls_back_to_realized_when_unrealized_absent()
    print("ok: composite_score unrealized tests passed")
