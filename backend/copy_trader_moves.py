"""
Recent DEX-style moves from ranked copy traders — Etherscan token transfers.

No whale / $250k gate: scans top traders' latest on-chain token flows and
surfaces swaps (token out + token in, same tx hash).
"""

from __future__ import annotations

import asyncio
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from chains.ethereum import get_eth_token_transfers
from observability import log_error

STABLECOINS = frozenset({
    "USDC", "USDT", "DAI", "BUSD", "FRAX", "TUSD", "USDP", "LUSD", "GHO", "PYUSD", "FDUSD",
})
WETH_ALIASES = frozenset({"WETH", "ETH", "STETH", "WSTETH", "CBETH", "RETH"})

# Liquid tokens worth showing (includes stables + majors)
LIQUID_SYMBOLS = frozenset({
    "ETH", "WETH", "WBTC", "USDC", "USDT", "DAI", "UNI", "LINK", "AAVE", "ARB", "OP",
    "PEPE", "SHIB", "LDO", "MKR", "CRV", "SNX", "COMP", "ENS", "RNDR", "FET", "INJ",
    "WSTETH", "STETH", "WEETH", "CBETH", "RETH", "BONK", "FLOKI", "MATIC", "POL",
    "GMX", "PENDLE", "EIGEN", "ETHFI", "ONDO", "WLD", "BLUR", "APE", "SAND", "MANA",
    "TIA", "SEI", "DOGE", "HYPE",
}) | STABLECOINS | WETH_ALIASES

ETH_USD_FALLBACK = 3500.0  # used only when no live price is supplied
MIN_USD_EST = 50.0  # drop dust swaps, not whale-sized gates


def _usd_estimate(symbol: str, amount: float, eth_usd: float = ETH_USD_FALLBACK) -> float | None:
    sym = (symbol or "").upper()
    if sym in STABLECOINS:
        return float(amount)
    if sym in WETH_ALIASES:
        return float(amount) * eth_usd
    return None


def _classify_action(bought: str, sold: str) -> str:
    b, s = bought.upper(), sold.upper()
    if b in STABLECOINS:
        return "take_profit"
    if s in STABLECOINS or s in WETH_ALIASES:
        return "buy"
    return "rotate"


def _swaps_from_transfers(address: str, transfers: list[dict], eth_usd: float = ETH_USD_FALLBACK) -> list[dict]:
    """Group token transfers by tx hash; keep txs with both in and out legs."""
    by_tx: dict[str, list[dict]] = defaultdict(list)
    for t in transfers:
        h = t.get("hash")
        if h:
            by_tx[h].append(t)

    swaps: list[dict] = []
    for tx_hash, legs in by_tx.items():
        ins = [l for l in legs if l.get("direction") == "in"]
        outs = [l for l in legs if l.get("direction") == "out"]
        if not ins or not outs:
            continue

        bought_leg = max(ins, key=lambda x: float(x.get("value") or 0))
        sold_leg = max(outs, key=lambda x: float(x.get("value") or 0))
        bought = (bought_leg.get("token_symbol") or "?").upper()
        sold = (sold_leg.get("token_symbol") or "?").upper()

        if bought not in LIQUID_SYMBOLS and sold not in LIQUID_SYMBOLS:
            continue

        bought_amt = float(bought_leg.get("value") or 0)
        sold_amt = float(sold_leg.get("value") or 0)
        usd_b = _usd_estimate(bought, bought_amt, eth_usd)
        usd_s = _usd_estimate(sold, sold_amt, eth_usd)
        usd_candidates = [x for x in (usd_b, usd_s) if x is not None]
        amount_usd = max(usd_candidates) if usd_candidates else None
        if amount_usd is not None and amount_usd < MIN_USD_EST:
            continue

        ts = bought_leg.get("timestamp") or sold_leg.get("timestamp")
        swaps.append({
            "time": ts,
            "tx_hash": tx_hash,
            "sold": sold,
            "bought": bought,
            "sold_address": sold_leg.get("contract_address"),
            "bought_address": bought_leg.get("contract_address"),
            "sold_amount": round(sold_amt, 6),
            "bought_amount": round(bought_amt, 6),
            "amount_usd": round(amount_usd, 2) if amount_usd is not None else None,
            "project": "DEX",
            "action": _classify_action(bought, sold),
        })

    swaps.sort(
        key=lambda m: m.get("time") or "",
        reverse=True,
    )
    return swaps


async def _fetch_trader_swaps(
    address: str,
    *,
    transfer_limit: int = 25,
    sem: asyncio.Semaphore,
    eth_usd: float = ETH_USD_FALLBACK,
) -> list[dict]:
    async with sem:
        try:
            transfers = await get_eth_token_transfers(address, limit=transfer_limit)
            swaps = _swaps_from_transfers(address, transfers, eth_usd)
        except Exception as e:
            log_error("copy_moves_fetch_failed", address=address, error=str(e)[:200])
            swaps = []
    # Throttle OUTSIDE the semaphore so the slot frees before sleeping — avoids
    # serializing all fetches behind the pacing delay.
    await asyncio.sleep(0.22)
    return swaps


async def fetch_recent_copy_moves(
    traders: list[dict],
    *,
    limit: int = 15,
    traders_to_scan: int = 40,
    transfer_limit: int = 25,
    eth_usd: float = ETH_USD_FALLBACK,
) -> list[dict]:
    """
    Pull recent swaps from top-ranked copy traders via Etherscan.
    `traders` should already be enriched dicts with address, label, metrics, etc.
    """
    # Filter to traders with an address BEFORE building tasks, so the task list
    # and `scan` stay index-aligned — otherwise zip() misattributes swaps to the
    # wrong trader whenever an input trader is missing an address.
    scan = [t for t in traders[:traders_to_scan] if t.get("address")]
    sem = asyncio.Semaphore(4)
    tasks = [
        _fetch_trader_swaps(
            (t.get("address") or "").lower(),
            transfer_limit=transfer_limit,
            sem=sem,
            eth_usd=eth_usd,
        )
        for t in scan
    ]
    results = await asyncio.gather(*tasks)

    moves: list[dict] = []
    seen: set[str] = set()

    for trader, swaps in zip(scan, results):
        addr = (trader.get("address") or "").lower()
        metrics = trader.get("metrics") or {}
        for s in swaps:
            tx = s["tx_hash"]
            if tx in seen:
                continue
            seen.add(tx)
            moves.append({
                **s,
                "trader_address": addr,
                "trader_label": trader.get("label"),
                "rank": trader.get("rank"),
                "copy_score": trader.get("copy_trading_score"),
                # Realized win rate / PF kept for internal ranking only — never
                # surfaced as a copy-pick claim (sells-winners-holds-losers reads
                # a fake 100%). Unrealized is the honest number we display.
                "win_rate_pct": metrics.get("win_rate_pct"),
                "unrealized_win_rate_pct": metrics.get("unrealized_win_rate_pct"),
                "profit_factor": metrics.get("profit_factor"),
            })

    moves.sort(key=lambda m: m.get("time") or "", reverse=True)
    return moves[:limit]
