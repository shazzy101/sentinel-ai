from __future__ import annotations
from copy_traders_store import load_copy_traders
from copy_trader_moves import fetch_recent_copy_moves
from detected_moves import get_marketing_snapshot
from growth.models import Signal

_BUY_KINDS = {"buy": "smart_money_buy", "take_profit": "take_profit"}


def _move_to_signal(m: dict) -> Signal:
    action = m.get("action") or ""
    kind = _BUY_KINDS.get(action, "smart_money_buy")
    # The headline token is what was bought (entry) or, for take-profit, what was sold.
    token = (m.get("bought") if action != "take_profit" else m.get("sold")) or m.get("bought") or ""
    return Signal(
        kind=kind, token=token, action=action,
        ts=m.get("time") or "",
        trader_label=m.get("trader_label"),
        rank=m.get("rank"),
        amount_usd=m.get("amount_usd"),
        unrealized_win_rate_pct=m.get("unrealized_win_rate_pct"),
        tx_hash=m.get("tx_hash"),
        raw=m,
    )


async def extract_signals(limit: int = 15) -> list[Signal]:
    """Pull live smart-money moves + win-ledger hooks, normalized to Signals."""
    traders = load_copy_traders()
    moves = await fetch_recent_copy_moves(traders, limit=limit)
    signals = [_move_to_signal(m) for m in moves if (m.get("bought") or m.get("sold"))]

    snap = await get_marketing_snapshot()
    for hook in (snap.get("tweet_hooks") or [])[:2]:
        signals.append(Signal(kind="win_ledger", token="", action="",
                              ts="", raw={"tweet_hook": hook}))
    return signals
