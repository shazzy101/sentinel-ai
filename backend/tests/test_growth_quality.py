import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from growth.models import Signal, RankedSignal
from growth.ranker import select_top
from growth.content import make_content

NOW = "2026-06-16T12:00:00+00:00"


def _sig(token, amount, ts="2026-06-16T11:50:00+00:00"):
    return Signal(kind="smart_money_buy", token=token, action="buy", ts=ts,
                  amount_usd=amount, rank=1)


def test_select_top_dedupes_by_token():
    sigs = [_sig("REACT", 220), _sig("REACT", 210), _sig("ARB", 80000)]
    top = select_top(sigs, n=5, now=NOW)
    tokens = [r.signal.token for r in top]
    assert tokens.count("REACT") == 1   # only the best REACT survives


def test_small_dollar_amount_not_shown_as_number():
    rs = RankedSignal(signal=_sig("ATOS", 222), tweetability=5.0, reasons=[])
    cp = make_content(rs)
    assert "$222" not in cp.original_post
    assert "a position" in cp.original_post


def test_large_dollar_amount_is_shown():
    rs = RankedSignal(signal=_sig("ARB", 80000), tweetability=5.0, reasons=[])
    cp = make_content(rs)
    assert "$80,000" in cp.original_post
