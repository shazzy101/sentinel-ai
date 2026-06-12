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
) -> float | None:
    """Percent of positions in profit, counting open bags at current price.

    completed_trades: [{"profitable": bool}, ...]
    open_positions:   [{"token": str, "cost_per_unit": float, "amount": float}, ...]
    current_prices:   {TOKEN_SYMBOL_UPPER: usd_price}

    Open positions with no current price are excluded (we can't judge them).
    Returns the win rate as a percent, or None when there are no judgeable positions.
    """
    wins = 0
    total = 0

    for t in completed_trades:
        total += 1
        if t.get("profitable"):
            wins += 1

    for pos in open_positions:
        price = current_prices.get((pos.get("token") or "").upper())
        if price is None:
            continue  # unpriceable bag — can't score it
        total += 1
        if price > (pos.get("cost_per_unit") or 0):
            wins += 1

    if total == 0:
        return None
    return round(wins / total * 100, 1)
