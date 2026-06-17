import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from growth.models import Signal, RankedSignal
from growth.engagement import load_targets, plan


def _rs(token, tweetability):
    s = Signal(kind="smart_money_buy", token=token, action="buy",
               ts="2026-06-16T11:50:00+00:00")
    return RankedSignal(signal=s, tweetability=tweetability, reasons=[])


def test_load_targets_reads_yaml():
    targets = load_targets()
    assert isinstance(targets, list)
    assert all("handle" in t for t in targets)


def test_plan_pairs_each_account_with_a_signal():
    targets = [{"handle": "@A", "beat": "memecoins"}, {"handle": "@B", "beat": "majors"}]
    top = [_rs("PEPE", 5.0), _rs("ETH", 4.0)]
    items = plan(targets, top)
    assert len(items) == 2
    assert all(item["handle"] in ("@A", "@B") for item in items)
    assert all("suggested_token" in item for item in items)
