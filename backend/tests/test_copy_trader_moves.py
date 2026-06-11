"""Tests for copy-trader move attribution (PHASE 1.1)."""

import asyncio
import sys
from pathlib import Path

# Allow `import copy_trader_moves` when run from the repo root or tests/.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import copy_trader_moves  # noqa: E402


def _swap_transfer(tx_hash: str, ts: str):
    """A minimal in+out token-transfer pair that _swaps_from_transfers accepts."""
    return [
        {"hash": tx_hash, "direction": "out", "token_symbol": "USDC", "value": 1000, "timestamp": ts},
        {"hash": tx_hash, "direction": "in", "token_symbol": "WETH", "value": 0.3, "timestamp": ts},
    ]


def test_attribution_aligned_when_some_traders_lack_address(monkeypatch):
    """A trader missing an address must not shift swap attribution onto the wrong trader."""
    traders = [
        {"address": "0xAAA", "label": "Alpha", "copy_trading_score": 90, "metrics": {}},
        {"label": "NoAddress", "copy_trading_score": 80, "metrics": {}},  # <- no address
        {"address": "0xCCC", "label": "Gamma", "copy_trading_score": 70, "metrics": {}},
    ]

    async def fake_transfers(address, limit=25):
        # Only Gamma (0xccc) has an on-chain swap; Alpha has none.
        if address == "0xccc":
            return _swap_transfer("0xhashC", "2026-06-10 10:00:00")
        return []

    monkeypatch.setattr(copy_trader_moves, "get_eth_token_transfers", fake_transfers)

    moves = asyncio.run(copy_trader_moves.fetch_recent_copy_moves(traders, limit=10))

    assert len(moves) == 1
    # The swap belongs to Gamma — it must be attributed to Gamma, not the address-less trader.
    assert moves[0]["trader_address"] == "0xccc"
    assert moves[0]["trader_label"] == "Gamma"


def test_no_address_traders_produce_no_moves(monkeypatch):
    async def fake_transfers(address, limit=25):
        return _swap_transfer("0xh", "2026-06-10 09:00:00")

    monkeypatch.setattr(copy_trader_moves, "get_eth_token_transfers", fake_transfers)

    traders = [{"label": "Anon", "metrics": {}}]  # no address at all
    moves = asyncio.run(copy_trader_moves.fetch_recent_copy_moves(traders, limit=10))
    assert moves == []


if __name__ == "__main__":
    # Lightweight runner so the test works without pytest installed.
    class _MP:
        def setattr(self, obj, name, val):
            setattr(obj, name, val)

    test_attribution_aligned_when_some_traders_lack_address(_MP())
    test_no_address_traders_produce_no_moves(_MP())
    print("ok: copy_trader_moves attribution tests passed")
