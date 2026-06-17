import sys
import asyncio
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import growth.alpha_extractor as ax


def test_extract_maps_moves_and_winledger(monkeypatch):
    fake_traders = [{"address": "0xAAA", "label": "Alpha", "metrics": {}}]
    fake_moves = [{
        "bought": "ARB", "sold": "USDC", "amount_usd": 80000, "action": "buy",
        "time": "2026-06-16T11:50:00+00:00", "tx_hash": "0xtx", "trader_label": "Alpha",
        "rank": 2, "unrealized_win_rate_pct": 78,
    }]
    fake_snapshot = {"tweet_hooks": ["🟢 71% win rate across scored moves. hadaleum.com/wins"]}

    monkeypatch.setattr(ax, "load_copy_traders", lambda **k: fake_traders)

    async def _fake_moves(traders, **k):
        return fake_moves
    monkeypatch.setattr(ax, "fetch_recent_copy_moves", _fake_moves)

    async def _fake_snap():
        return fake_snapshot
    monkeypatch.setattr(ax, "get_marketing_snapshot", _fake_snap)

    signals = asyncio.run(ax.extract_signals(limit=10))
    kinds = {s.kind for s in signals}
    assert "smart_money_buy" in kinds
    assert "win_ledger" in kinds
    buy = next(s for s in signals if s.kind == "smart_money_buy")
    assert buy.token == "ARB"
    assert buy.amount_usd == 80000
    assert buy.ts == "2026-06-16T11:50:00+00:00"
