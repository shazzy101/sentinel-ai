import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from growth.models import Signal, RankedSignal, ContentPiece, DailyBrief


def test_signal_minimal():
    s = Signal(kind="smart_money_buy", token="ARB", action="buy", ts="2026-06-16T12:00:00+00:00")
    assert s.token == "ARB"
    assert s.amount_usd is None


def test_ranked_wraps_signal():
    s = Signal(kind="smart_money_buy", token="ARB", action="buy", ts="2026-06-16T12:00:00+00:00")
    rs = RankedSignal(signal=s, tweetability=4.2, reasons=["recent"])
    assert rs.signal.token == "ARB"
    assert rs.tweetability == 4.2


def test_daily_brief_holds_pieces():
    s = Signal(kind="smart_money_buy", token="ARB", action="buy", ts="2026-06-16T12:00:00+00:00")
    cp = ContentPiece(original_post="x", reply_variants=["a"], cta="hadaleum.com", signal_token="ARB")
    b = DailyBrief(date="2026-06-16", pieces=[cp], engagement=[], metrics_delta={})
    assert b.pieces[0].signal_token == "ARB"
    assert b.date == "2026-06-16"
