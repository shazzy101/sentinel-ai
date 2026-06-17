import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from growth.models import Signal, RankedSignal
from growth.content import make_content

CTA_HOST = "hadaleum.com"


def _ranked(**kw):
    s = Signal(kind=kw.pop("kind", "smart_money_buy"), token=kw.pop("token", "ARB"),
               action=kw.pop("action", "buy"), ts="2026-06-16T11:50:00+00:00", **kw)
    return RankedSignal(signal=s, tweetability=5.0, reasons=["fresh entry"])


def test_content_has_cta_and_token():
    cp = make_content(_ranked(amount_usd=80000, rank=2, unrealized_win_rate_pct=78))
    assert CTA_HOST in cp.cta
    assert "ARB" in cp.original_post
    assert cp.signal_token == "ARB"


def test_all_strings_within_x_limit():
    cp = make_content(_ranked(amount_usd=80000, rank=2, unrealized_win_rate_pct=78))
    assert len(cp.original_post) <= 280
    assert all(len(v) <= 280 for v in cp.reply_variants)
    assert len(cp.reply_variants) >= 2


def test_win_ledger_uses_ready_hook():
    s = Signal(kind="win_ledger", token="ETH", action="", ts="2026-06-16T11:50:00+00:00",
               raw={"tweet_hook": "🟢 Hadaleum flagged moves: 71% win rate. hadaleum.com/wins"})
    rs = RankedSignal(signal=s, tweetability=3.0, reasons=[])
    cp = make_content(rs)
    assert cp.original_post.startswith("🟢")
    assert "hadaleum.com" in cp.original_post
