"""Unrealized (mark-to-market) win rate for copy traders.

Realized win rate counts only closed trades. This also counts still-held
positions marked to the current price, so a wallet that sells winners and holds
losers can't show a fake 100%.
"""

from __future__ import annotations


def unrealized_win_rate(
    completed_trades: list[dict],
    open_positions: list[dict],
    current_prices: dict[str, float],
    *,
    now_ts: int | None = None,
    stale_days: int = 3,
) -> float | None:
    """Percent of positions in profit, counting open bags at current price.

    completed_trades: [{"profitable": bool}, ...]
    open_positions:   [{"token": str, "cost_per_unit": float, "amount": float, "buy_ts": int}, ...]
    current_prices:   {TOKEN_SYMBOL_UPPER: usd_price}

    Priced open bag: win if current price > cost basis, else loss.
    Unpriceable open bag: if it's been held longer than `stale_days` (and we know
    `now_ts` + its buy_ts) it's treated as a LOSS — a long-held token with no DEX
    price is almost certainly dead/illiquid. A recently bought, not-yet-indexed
    token is excluded (we can't fairly judge it yet).

    Returns the win rate as a percent, or None when there are no judgeable positions.
    """
    wins = 0
    total = 0

    for t in completed_trades:
        total += 1
        if t.get("profitable"):
            wins += 1

    stale_secs = stale_days * 86_400
    for pos in open_positions:
        price = current_prices.get((pos.get("token") or "").upper())
        if price is not None:
            total += 1
            if price > (pos.get("cost_per_unit") or 0):
                wins += 1
            continue
        # Unpriceable: count as a loss only if it's an old, clearly-dead bag.
        buy_ts = pos.get("buy_ts")
        if now_ts is not None and buy_ts is not None and (now_ts - buy_ts) > stale_secs:
            total += 1  # held long with no price → dead → loss (no win increment)
        # else: recent / unknown age → exclude (can't judge yet)

    if total == 0:
        return None
    return round(wins / total * 100, 1)
