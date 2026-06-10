#!/usr/bin/env python3
"""
Sentinel AI — Copy Trading Wallet Ranker
=========================================
Finds Ethereum wallets with best copy-trading metrics:

  • Win Rate         – % of trades that were profitable (target: >60%)
  • Profit Factor    – gross profit / gross loss (target: >2.0)
  • Max Drawdown     – largest peak-to-trough in cumulative P&L (target: <20%)
  • Avg Trade Duration – avg hours between buy and matching sell
  • Track Record     – days of active trading history (target: >90 days)

Pipeline:
  1. Collect candidate addresses from existing Sentinel data files
     + top holders of 20 major DeFi tokens via Etherscan API
  2. For each candidate: fetch last 180 days of token transfers
  3. Reconstruct DEX trades (group transfers by tx hash, match buy/sell FIFO)
  4. Price trades: stablecoins=$1, ETH/WETH=CoinGecko ETH price history
  5. Compute all 5 metrics
  6. Rank and output top N as CSV + JSON

Usage:
  python3 copy_trading_ranker.py

Output:
  copy_trading_top_wallets.csv
  copy_trading_top_wallets.json
"""

import asyncio
import json
import os
import sys
import time
import math
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx

sys.path.insert(0, os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")))

# ─── Config ──────────────────────────────────────────────────────────────────

ETHERSCAN_API_KEY = "XT2XUF6RCII7SIMCAJKRXXJ5XKMN785E8S"
ETHERSCAN_BASE    = "https://api.etherscan.io/v2/api"
COINGECKO_BASE    = "https://api.coingecko.com/api/v3"

# Concurrency / rate-limit controls
ETHERSCAN_CONCURRENCY = 4   # max simultaneous Etherscan requests
ETHERSCAN_DELAY       = 0.25  # seconds between each call (4/sec to stay under 5/sec limit)
COINGECKO_DELAY       = 6.5   # seconds between CoinGecko calls (stay under 10/min free tier)

# Trade analysis window
HISTORY_DAYS = 180   # fetch last 6 months of transfers
MIN_TRADES   = 10    # require at least 10 completed trades to score a wallet
MIN_DAYS     = 30    # require at least 30-day track record

# Top-N output
TOP_N = 5000

# Stablecoins — priced at $1 always
STABLECOINS = {
    "USDC", "USDT", "DAI", "BUSD", "FRAX", "TUSD", "USDP", "LUSD",
    "USDD", "GUSD", "SUSD", "MIM", "ALUSD", "CRVUSD", "DOLA",
    "GHO", "PYUSD", "FDUSD",
}

# Wrapped ETH tokens — treated same as ETH for pricing
WETH_SYMBOLS = {"WETH", "STETH", "WSTETH", "CBETH", "RETH", "SWETH", "ANKRETH"}

# 20 major DeFi tokens to harvest top holders from
DEFI_TOKENS = {
    "WETH":  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "USDC":  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "USDT":  "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    "WBTC":  "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    "stETH": "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
    "UNI":   "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    "AAVE":  "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
    "CRV":   "0xD533a949740bb3306d119CC777fa900bA034cd52",
    "MKR":   "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2",
    "LDO":   "0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32",
    "SNX":   "0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F",
    "COMP":  "0xc00e94Cb662C3520282E6f5717214004A7f26888",
    "1INCH": "0x111111111117dC0aa78b770fA6A738034120C302",
    "BAL":   "0xba100000625a3754423978a60c9317c58a424e3D",
    "YFI":   "0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e",
    "CVX":   "0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B",
    "FXS":   "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0",
    "RPL":   "0xD33526068D116cE69F19A9ee46F0bd304F21A51f",
    "PENDLE":"0x808507121B80c02388fAd14726482e061B8da827",
    "ENA":   "0x57e114B691Db790C35207b2e685D4A43181e6061",
}

# Known exchange/infra addresses to skip (not copy-trading targets)
SKIP_ADDRESSES = {
    "0x28c6c06298d514db089934071355e5743bf21d60",
    "0x21a31ee1afc51d94c2efccaa1486ffa9c4a2a28",
    "0x56eddb7aa87536c09ccc2793473599fd21a8b17f",
    "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be",
    "0xd551234ae421e3bcba99a0da6d736074f22192ff",
    "0x0681d8db095565fe8a346fa0277bffde9c0edbbf",
    "0x001866ae5b3de6caa5a51543fd9fb64f524f5478",
    "0x503828976d22510aad0201ac7ec88293211d23da",
    "0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740",
    "0x3cd751e6b0078be393132286c442345e5dc49699",
    "0xa7efae728d2936e78bda97dc267687568dd593f3",
    "0x6fc82a5fe25a5cdb58bc74600a40a69c065263f8",
    "0xd24400ae8bfebb18ca49be86258a3c749cf46853",
    "0x2b5634c42055806a59e9107ed44d43c426e58258",
    "0x689c56aef474df92d44a1b70850f808488f9769c",
    "0x1692e170361cefd1eb7240ec13d048fd9af6d667",
    "0x6cc5f688a315f3dc28a7781717a9a798a59fda7b",
}

SKIP_LABEL_KEYWORDS = {
    "binance", "coinbase", "kraken", "kucoin", "okx", "gemini", "bitfinex",
    "bybit", "huobi", "htx", "ftx", "exchange", "hot wallet", "cold wallet",
    "router", "contract", "treasury", "bridge", "beacon", "staking contract",
    "vault", "multisig", "gnosis safe", "protocol", "deployer",
}


# ─── Etherscan helpers ────────────────────────────────────────────────────────

_eth_semaphore: Optional[asyncio.Semaphore] = None

def get_semaphore():
    global _eth_semaphore
    if _eth_semaphore is None:
        _eth_semaphore = asyncio.Semaphore(ETHERSCAN_CONCURRENCY)
    return _eth_semaphore


async def etherscan_get(client: httpx.AsyncClient, params: dict, retries: int = 3) -> Optional[list]:
    """Rate-limited Etherscan API call. Returns result list or None."""
    params["apikey"] = ETHERSCAN_API_KEY
    params["chainid"] = "1"

    async with get_semaphore():
        for attempt in range(retries):
            try:
                await asyncio.sleep(ETHERSCAN_DELAY)
                resp = await client.get(ETHERSCAN_BASE, params=params, timeout=15)
                data = resp.json()
                if data.get("status") == "1":
                    return data.get("result", [])
                if data.get("message") == "No transactions found":
                    return []
                # Rate limit or transient error — back off
                if attempt < retries - 1:
                    await asyncio.sleep(1.0 * (attempt + 1))
            except Exception:
                if attempt < retries - 1:
                    await asyncio.sleep(1.0)
        return None


async def get_token_holders(client: httpx.AsyncClient, token_address: str, pages: int = 2) -> list[str]:
    """Fetch top ERC-20 token holders (up to pages×100 addresses)."""
    addresses = []
    for page in range(1, pages + 1):
        result = await etherscan_get(client, {
            "module": "token",
            "action": "tokenholderlist",
            "contractaddress": token_address,
            "page": page,
            "offset": 100,
        })
        if not result:
            break
        for h in result:
            addr = (h.get("TokenHolderAddress") or "").strip().lower()
            if addr and addr not in SKIP_ADDRESSES:
                addresses.append(addr)
    return addresses


async def get_token_transfers(client: httpx.AsyncClient, address: str, days: int = HISTORY_DAYS) -> list[dict]:
    """Fetch ERC-20 token transfers for address in the last N days."""
    cutoff_ts = int((datetime.now(timezone.utc) - timedelta(days=days)).timestamp())
    all_transfers = []
    page = 1

    while page <= 10:  # max 10 pages (1000 transfers)
        result = await etherscan_get(client, {
            "module": "account",
            "action": "tokentx",
            "address": address,
            "page": page,
            "offset": 100,
            "sort": "desc",
        })
        if not result:
            break
        reached_cutoff = False
        for tx in result:
            if int(tx.get("timeStamp", 0)) < cutoff_ts:
                reached_cutoff = True
                break
            all_transfers.append(tx)
        if reached_cutoff or len(result) < 100:
            break
        page += 1

    return all_transfers


# ─── Price data ───────────────────────────────────────────────────────────────

_eth_price_cache: dict[str, float] = {}   # "YYYY-MM-DD" → USD price


async def fetch_eth_price_history(client: httpx.AsyncClient, days: int = HISTORY_DAYS + 30):
    """
    Bulk-fetch ETH daily price history from CoinGecko and cache it.
    Single API call; reused for all wallets.
    """
    global _eth_price_cache
    print("  → Fetching ETH price history from CoinGecko...")
    try:
        await asyncio.sleep(COINGECKO_DELAY)
        resp = await client.get(
            f"{COINGECKO_BASE}/coins/ethereum/market_chart",
            params={"vs_currency": "usd", "days": days, "interval": "daily"},
            timeout=30,
        )
        data = resp.json()
        prices = data.get("prices", [])
        for ts_ms, price in prices:
            date_str = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
            _eth_price_cache[date_str] = price
        print(f"  → Cached {len(_eth_price_cache)} days of ETH prices")
    except Exception as e:
        print(f"  ⚠ CoinGecko error: {e} — using fallback ETH price $2500")


def eth_price_on(ts_unix: int) -> float:
    """Return ETH USD price on the given unix timestamp day."""
    if not _eth_price_cache:
        return 2500.0  # fallback
    date_str = datetime.fromtimestamp(ts_unix, tz=timezone.utc).strftime("%Y-%m-%d")
    if date_str in _eth_price_cache:
        return _eth_price_cache[date_str]
    # Walk back up to 3 days for nearest price
    for delta in range(1, 4):
        d = (datetime.fromtimestamp(ts_unix, tz=timezone.utc) - timedelta(days=delta)).strftime("%Y-%m-%d")
        if d in _eth_price_cache:
            return _eth_price_cache[d]
    return 2500.0


def token_usd_value(symbol: str, amount: float, ts_unix: int) -> Optional[float]:
    """
    Return USD value of `amount` of `symbol` at time `ts_unix`.
    Returns None if we cannot price it (skip those trades in P&L).
    """
    sym = (symbol or "").upper().strip()
    if sym in STABLECOINS:
        return amount  # $1 peg
    if sym in WETH_SYMBOLS or sym == "ETH":
        return amount * eth_price_on(ts_unix)
    return None  # unknown token — skip from P&L calculation


# ─── Trade reconstruction ─────────────────────────────────────────────────────

def reconstruct_trades(address: str, transfers: list[dict]) -> list[dict]:
    """
    Reconstruct completed trades from raw token transfers.

    Strategy:
      1. Group all token transfers by transaction hash.
      2. For each tx: identify tokens flowing IN (bought) and OUT (sold).
      3. A "swap" = at least one token in AND one token out in the same tx.
      4. Price the swap's "cost" and "proceeds" in USD using our price function.
         Only include swaps where at least one leg is a priceable token.
      5. Match sells to prior buys per token using FIFO to compute trade P&L.
    """
    addr_lower = address.lower()

    # Step 1: group by tx hash
    by_tx: dict[str, list] = defaultdict(list)
    for t in transfers:
        by_tx[t["hash"]].append(t)

    # Step 2 & 3: identify swaps → individual buy events
    # Each swap records the token purchased, amount, cost in USD, and timestamp.
    # "Buy" = I sent something and received a target token.
    # We track: buys = list of (token_symbol, amount_in, cost_usd, ts_unix)
    # We match sells to buys FIFO.

    # Per-token FIFO buy queue: {symbol: [(amount, cost_per_unit_usd, ts_unix), ...]}
    buy_queue: dict[str, list] = defaultdict(list)
    completed_trades: list[dict] = []
    first_ts = None
    last_ts = None

    # Sort transactions oldest-first for correct FIFO matching
    all_txs = sorted(by_tx.items(), key=lambda x: int(x[1][0].get("timeStamp", 0)))

    for tx_hash, tx_transfers in all_txs:
        ts = int(tx_transfers[0].get("timeStamp", 0))
        if first_ts is None or ts < first_ts:
            first_ts = ts
        if last_ts is None or ts > last_ts:
            last_ts = ts

        tokens_in = []   # received by wallet
        tokens_out = []  # sent by wallet

        for t in tx_transfers:
            from_addr = t.get("from", "").lower()
            to_addr   = t.get("to", "").lower()
            symbol    = (t.get("tokenSymbol") or "").upper().strip()
            decimals  = int(t.get("tokenDecimal") or 18)
            try:
                raw_val = int(t.get("value") or 0)
                amount  = raw_val / (10 ** decimals)
            except Exception:
                amount = 0.0

            if to_addr == addr_lower:
                tokens_in.append((symbol, amount, ts))
            elif from_addr == addr_lower:
                tokens_out.append((symbol, amount, ts))

        # Only process swaps (both in and out present in same tx)
        if not tokens_in or not tokens_out:
            continue

        # Calculate total cost (what was sent out) in USD
        total_cost_usd = 0.0
        cost_priceable = False
        for sym, amt, t_ts in tokens_out:
            usd = token_usd_value(sym, amt, t_ts)
            if usd is not None:
                total_cost_usd += usd
                cost_priceable = True

        # Calculate total proceeds (what came in) in USD
        total_proceeds_usd = 0.0
        proceeds_priceable = False
        for sym, amt, t_ts in tokens_in:
            usd = token_usd_value(sym, amt, t_ts)
            if usd is not None:
                total_proceeds_usd += usd
                proceeds_priceable = True

        # We need at least one leg to be priceable
        if not cost_priceable and not proceeds_priceable:
            continue

        # Record individual "buy" events for the tokens received
        # We split cost proportionally by priceable value if needed
        for sym, amt, t_ts in tokens_in:
            if amt <= 0:
                continue
            # Cost basis for this specific token = proportional share of total cost
            cost_for_this = total_cost_usd  # simplified: full cost per token leg
            if len(tokens_in) > 1 and total_proceeds_usd > 0:
                usd_this = token_usd_value(sym, amt, t_ts) or 0
                cost_for_this = total_cost_usd * (usd_this / total_proceeds_usd)
            cost_per_unit = cost_for_this / amt if amt > 0 else 0
            buy_queue[sym].append({
                "amount": amt,
                "cost_per_unit": cost_per_unit,
                "cost_total": cost_for_this,
                "ts": t_ts,
            })

        # Record individual "sell" events for the tokens sent out
        for sym, amt, t_ts in tokens_out:
            if amt <= 0 or sym not in buy_queue or not buy_queue[sym]:
                continue
            proceeds_per_unit = 0.0
            usd_proceeds = token_usd_value(sym, amt, t_ts)
            if usd_proceeds is not None and amt > 0:
                proceeds_per_unit = usd_proceeds / amt

            # FIFO match against buy queue
            remaining_sell = amt
            while remaining_sell > 1e-12 and buy_queue[sym]:
                buy = buy_queue[sym][0]
                match_amount = min(remaining_sell, buy["amount"])

                cost     = match_amount * buy["cost_per_unit"]
                proceeds = match_amount * proceeds_per_unit if proceeds_per_unit else 0.0
                pnl      = proceeds - cost

                buy["amount"]     -= match_amount
                remaining_sell    -= match_amount

                if buy["amount"] < 1e-12:
                    buy_queue[sym].pop(0)

                if cost > 0 or proceeds > 0:
                    duration_hrs = max(0, (t_ts - buy["ts"]) / 3600)
                    completed_trades.append({
                        "token":        sym,
                        "pnl_usd":      pnl,
                        "cost_usd":     cost,
                        "proceeds_usd": proceeds,
                        "buy_ts":       buy["ts"],
                        "sell_ts":      t_ts,
                        "duration_hrs": duration_hrs,
                        "profitable":   pnl > 0,
                    })

    return completed_trades, first_ts, last_ts


# ─── Metrics computation ──────────────────────────────────────────────────────

def compute_metrics(trades: list[dict], first_ts: Optional[int], last_ts: Optional[int]) -> dict:
    """Compute the 5 copy-trading metrics from reconstructed trades."""
    if not trades:
        return None

    n = len(trades)
    wins     = [t for t in trades if t["profitable"]]
    losses   = [t for t in trades if not t["profitable"]]
    win_rate = len(wins) / n

    gross_profit = sum(t["pnl_usd"] for t in wins)
    gross_loss   = abs(sum(t["pnl_usd"] for t in losses))
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else (999.0 if gross_profit > 0 else 0.0)

    # Max drawdown from cumulative P&L curve
    cumulative = 0.0
    peak = 0.0
    max_dd = 0.0
    for t in sorted(trades, key=lambda x: x["sell_ts"]):
        cumulative += t["pnl_usd"]
        if cumulative > peak:
            peak = cumulative
        drawdown = (peak - cumulative) / abs(peak) if peak > 0 else 0
        if drawdown > max_dd:
            max_dd = drawdown

    # Average trade duration
    avg_duration_hrs = sum(t["duration_hrs"] for t in trades) / n if n > 0 else 0

    # Track record
    track_record_days = 0
    if first_ts and last_ts and last_ts > first_ts:
        track_record_days = (last_ts - first_ts) / 86400

    # Net P&L
    net_pnl = sum(t["pnl_usd"] for t in trades)

    return {
        "trade_count":        n,
        "win_rate":           round(win_rate * 100, 1),         # as percent
        "profit_factor":      round(profit_factor, 2),
        "max_drawdown_pct":   round(max_dd * 100, 1),           # as percent
        "avg_trade_duration_hrs": round(avg_duration_hrs, 1),
        "track_record_days":  round(track_record_days),
        "net_pnl_usd":        round(net_pnl, 2),
        "gross_profit_usd":   round(gross_profit, 2),
        "gross_loss_usd":     round(gross_loss, 2),
    }


def composite_score(m: dict) -> float:
    """
    Composite copy-trading score (0–100).
    Weights match the 5 user-specified metrics.
    """
    if not m or m["trade_count"] < MIN_TRADES:
        return 0.0
    if m["track_record_days"] < MIN_DAYS:
        return 0.0

    # Win rate: 0→0, 60→25, 80→30, 100→30  (25 pts max)
    wr = m["win_rate"]
    wr_score = min(wr / 100 * 30, 30)

    # Profit factor: 0→0, 2→25, 5→30, >5→30  (30 pts max)
    pf = m["profit_factor"]
    pf_score = min(math.log1p(pf) / math.log1p(5) * 30, 30)

    # Max drawdown: 0%→20pts, 20%→10pts, 50%+→0pts  (20 pts max, inverse)
    dd = m["max_drawdown_pct"]
    dd_score = max(0, 20 - dd * 0.4)

    # Avg trade duration: longer = better for copy trading (max 10 pts)
    # 1hr=1pt, 24hr=5pt, 168hr(1wk)=10pt
    dur = m["avg_trade_duration_hrs"]
    dur_score = min(math.log1p(dur) / math.log1p(168) * 10, 10)

    # Track record: 30days=2pts, 90days=7pts, 180days=10pts  (10 pts max)
    tr = m["track_record_days"]
    tr_score = min(math.log1p(tr) / math.log1p(180) * 10, 10)

    return round(wr_score + pf_score + dd_score + dur_score + tr_score, 2)


# ─── Candidate pool ───────────────────────────────────────────────────────────

def load_existing_wallets() -> list[dict]:
    """Load existing wallets from Sentinel data files."""
    # Resolve data dir relative to this script so it works on any machine
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
    data_dir = os.path.normpath(data_dir)
    wallets = {}

    # Prefer the Dune-enriched candidate list if available
    for fname in ["copy_trading_candidates.json", "etherscan_top_accounts.json",
                  "eth_smart_wallets.json", "world_whales.json", "whale_expansion.json"]:
        fpath = os.path.join(data_dir, fname)
        if not os.path.exists(fpath):
            continue
        try:
            with open(fpath) as f:
                data = json.load(f)
            if not isinstance(data, list):
                continue
            for item in data:
                addr = (item.get("address") or "").strip().lower()
                if not addr or addr in SKIP_ADDRESSES:
                    continue
                label = (item.get("label") or "").lower()
                if any(kw in label for kw in SKIP_LABEL_KEYWORDS):
                    continue
                if addr not in wallets:
                    wallets[addr] = {
                        "address":      addr,
                        "label":        item.get("label", ""),
                        "source":       fname,
                    }
        except Exception as e:
            print(f"  ⚠ Could not load {fname}: {e}")

    print(f"  Loaded {len(wallets)} addresses from existing data files")
    return list(wallets.values())


async def expand_pool_from_defi_tokens(
    client: httpx.AsyncClient, existing_addrs: set, target: int = 4000
) -> list[dict]:
    """Harvest top holders of DeFi tokens to expand the candidate pool."""
    discovered = {}
    tokens_list = list(DEFI_TOKENS.items())
    per_token = max(2, math.ceil(target / len(tokens_list) / 100) + 1)

    print(f"\n  Fetching top holders from {len(tokens_list)} DeFi tokens "
          f"({per_token} pages × 100 per token)...")

    for i, (symbol, token_addr) in enumerate(tokens_list):
        holders = await get_token_holders(client, token_addr, pages=per_token)
        new = 0
        for addr in holders:
            if addr not in existing_addrs and addr not in discovered:
                discovered[addr] = {
                    "address": addr,
                    "label":   f"{symbol} Top Holder",
                    "source":  "defi_token_holders",
                }
                new += 1
        print(f"    [{i+1}/{len(tokens_list)}] {symbol}: +{new} new addresses "
              f"(pool: {len(existing_addrs) + len(discovered)})")
        if len(discovered) >= target:
            break

    print(f"  Discovered {len(discovered)} new addresses from DeFi token holders")
    return list(discovered.values())


# ─── Main pipeline ────────────────────────────────────────────────────────────

async def analyze_wallet(
    client: httpx.AsyncClient, wallet: dict
) -> Optional[dict]:
    """Fetch transfers, reconstruct trades, compute metrics for one wallet."""
    address = wallet["address"]
    try:
        transfers = await get_token_transfers(client, address)
        if len(transfers) < MIN_TRADES:
            return None

        trades, first_ts, last_ts = reconstruct_trades(address, transfers)
        if len(trades) < MIN_TRADES:
            return None

        m = compute_metrics(trades, first_ts, last_ts)
        if m is None:
            return None

        score = composite_score(m)
        if score <= 0:
            return None

        from performance import build_pnl_sparkline_from_trades
        sparkline, est_ret = build_pnl_sparkline_from_trades(trades)

        return {
            "address":               address,
            "label":                 wallet.get("label", ""),
            "source":                wallet.get("source", ""),
            "composite_score":       score,
            "pnl_sparkline":         sparkline,
            "estimated_return_pct":  est_ret,
            **m,
        }
    except Exception as e:
        return None


async def main():
    print("=" * 60)
    print("Sentinel AI — Copy Trading Wallet Ranker")
    print("=" * 60)

    async with httpx.AsyncClient() as client:
        # Step 0: ETH price history (single CoinGecko call)
        await fetch_eth_price_history(client)

        # Step 1: Build candidate pool
        print("\n[1/4] Building candidate wallet pool...")
        existing = load_existing_wallets()
        existing_addrs = {w["address"] for w in existing}

        extra = await expand_pool_from_defi_tokens(client, existing_addrs)
        all_candidates = existing + extra
        print(f"\n  Total candidates: {len(all_candidates)}")

        # Step 2 & 3: Analyze each wallet
        print(f"\n[2/4] Analyzing {len(all_candidates)} wallets "
              f"(last {HISTORY_DAYS} days of trades)...")
        print("  This runs at ~4 Etherscan calls/sec — please wait...\n")

        results = []
        batch_size = 50
        t_start = time.time()

        for i, wallet in enumerate(all_candidates):
            result = await analyze_wallet(client, wallet)
            if result:
                results.append(result)

            # Progress every 50 wallets
            if (i + 1) % batch_size == 0 or (i + 1) == len(all_candidates):
                elapsed = time.time() - t_start
                rate = (i + 1) / elapsed
                eta  = (len(all_candidates) - i - 1) / rate if rate > 0 else 0
                print(f"  {i+1:>5}/{len(all_candidates)} wallets processed | "
                      f"{len(results)} qualified | "
                      f"{rate:.1f}/s | ETA {eta/60:.0f}m")

        print(f"\n  Qualified wallets: {len(results)}")

        # Step 4: Rank and output
        print(f"\n[3/4] Ranking by composite copy-trading score...")
        results.sort(key=lambda x: x["composite_score"], reverse=True)
        top = results[:TOP_N]

        print(f"\n[4/4] Writing output files...")

        # CSV
        _data_dir = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data"))
        os.makedirs(_data_dir, exist_ok=True)
        csv_path = os.path.join(_data_dir, "copy_trading_top_wallets.csv")
        import csv
        fieldnames = [
            "rank", "address", "label", "composite_score",
            "win_rate", "profit_factor", "max_drawdown_pct",
            "avg_trade_duration_hrs", "track_record_days",
            "trade_count", "net_pnl_usd", "gross_profit_usd", "gross_loss_usd",
            "source",
        ]
        with open(csv_path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for rank, row in enumerate(top, start=1):
                writer.writerow({"rank": rank, **{k: row.get(k, "") for k in fieldnames[1:]}})

        # JSON (Sentinel backend format)
        json_path = os.path.join(_data_dir, "copy_trading_top_wallets.json")
        json_output = []
        for rank, row in enumerate(top, start=1):
            metrics = {
                "win_rate_pct":          row["win_rate"],
                "profit_factor":         row["profit_factor"],
                "max_drawdown_pct":      row["max_drawdown_pct"],
                "avg_trade_duration_hrs": row["avg_trade_duration_hrs"],
                "track_record_days":     row["track_record_days"],
                "trade_count":           row["trade_count"],
                "net_pnl_usd":           row["net_pnl_usd"],
                "gross_profit_usd":      row.get("gross_profit_usd"),
                "gross_loss_usd":        row.get("gross_loss_usd"),
            }
            oc = {
                "total_trades": row["trade_count"],
                "active_days": int(row["track_record_days"] or 0),
                "trades_per_day": round(
                    row["trade_count"] / max(int(row["track_record_days"] or 1), 1), 2
                ),
            }
            json_output.append({
                "rank":                 rank,
                "address":              row["address"],
                "label":                row.get("label") or f"Copy Trader #{rank}",
                "chain":                "ethereum",
                "tags":                 ["ethereum", "copy-trading", "dex-trader", "smart-money"],
                "copy_trading_score":   row["composite_score"],
                "wallet_type":          "DEX Trader",
                "source":               row.get("source") or "ranker",
                "metrics":              metrics,
                "on_chain_data":        oc,
                "pnl_sparkline":        row.get("pnl_sparkline") or [],
                "estimated_return_pct": row.get("estimated_return_pct"),
                "metrics_meta":         {"max_drawdown_pct": "on_chain", "avg_trade_duration_hrs": "on_chain"},
            })

        with open(json_path, "w") as f:
            json.dump(json_output, f, indent=2)

        print(f"\n{'=' * 60}")
        print(f"✓ Done! {len(top)} wallets ranked.")
        print(f"  CSV:  {csv_path}")
        print(f"  JSON: {json_path}")

        if top:
            print(f"\nTop 10 preview:")
            print(f"  {'Rank':<5} {'Score':<7} {'WinRate':<9} {'ProfFactor':<12} {'MaxDD%':<8} {'AvgDur(h)':<11} {'TrackRec(d)':<13} {'Address'}")
            print(f"  {'-'*5} {'-'*7} {'-'*9} {'-'*12} {'-'*8} {'-'*11} {'-'*13} {'-'*42}")
            for i, row in enumerate(top[:10], start=1):
                print(f"  {i:<5} {row['composite_score']:<7} "
                      f"{row['win_rate']:<9} {row['profit_factor']:<12} "
                      f"{row['max_drawdown_pct']:<8} {row['avg_trade_duration_hrs']:<11} "
                      f"{row['track_record_days']:<13} {row['address']}")


if __name__ == "__main__":
    asyncio.run(main())
