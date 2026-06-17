import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from growth.models import Signal
from growth.ranker import tweetability_score, select_top

NOW = "2026-06-16T12:00:00+00:00"


def _sig(token, action, amount, ts, winrate=None, rank=None, kind="smart_money_buy"):
    return Signal(kind=kind, token=token, action=action, ts=ts, amount_usd=amount,
                  unrealized_win_rate_pct=winrate, rank=rank)


def test_strong_buy_outranks_weak_exit():
    strong = _sig("ARB", "buy", 80000, "2026-06-16T11:50:00+00:00", winrate=78, rank=2)
    weak = _sig("USDC", "take_profit", 200, "2026-06-15T01:00:00+00:00")
    s_strong, _ = tweetability_score(strong, now=NOW)
    s_weak, _ = tweetability_score(weak, now=NOW)
    assert s_strong > s_weak


def test_reasons_present_for_strong():
    strong = _sig("PEPE", "buy", 50000, "2026-06-16T11:55:00+00:00", winrate=70, rank=1)
    score, reasons = tweetability_score(strong, now=NOW)
    assert score > 0
    assert len(reasons) >= 2


def test_select_top_sorted_and_capped():
    sigs = [
        _sig("USDC", "take_profit", 100, "2026-06-15T00:00:00+00:00"),
        _sig("ARB", "buy", 80000, "2026-06-16T11:50:00+00:00", winrate=78, rank=2),
        _sig("LINK", "buy", 5000, "2026-06-16T10:00:00+00:00", winrate=60, rank=5),
    ]
    top = select_top(sigs, n=2, now=NOW)
    assert len(top) == 2
    assert top[0].tweetability >= top[1].tweetability
    assert top[0].signal.token == "ARB"
