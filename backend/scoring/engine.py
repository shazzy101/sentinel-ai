"""
Sentinel AI — Scoring Engine v5 "Honest Behavioral Signal"

What this score IS: a 0-100 measure of on-chain *behavior* — how recently and
how actively a wallet trades, how DeFi-native it is, how reliably its txns land.
What this score is NOT: a profitability or win-rate signal. It cannot see P&L
(no prices/cost-basis on this path). For real profitability, use the copy-trader
leaderboard, which is ranked on Dune dex.trades realized P&L.

v5 changes vs v4:
  • Bands recalibrated so scores SPREAD instead of clustering at ~100. Maxing a
    component now requires genuinely high activity/engagement, so an S/A grade
    is rare and meaningful.
  • Contracts / routers / token addresses are hard-capped as known entities
    (operational volume, not a trading signal) — see _CONTRACT_ADDRESSES.
  • The component once surfaced as "win_rate" is now honestly named
    tx_success_rate (txns that didn't revert — NOT trades that made money).

Weights (component maxes unchanged so the UI breakdown bars stay valid):
  Recency        0-25   How recently active. Dormant wallets sink hard.
  Activity       0-25   Transaction frequency in the fetched window.
  DeFi engage    0-25   Contract-call ratio + token diversity = real trading.
  Tx success     0-15   % of txns that succeeded (reverted txns hurt).
  Balance        0-10   Mild log-scaled confidence factor. Never the driver.
"""

import math
from datetime import datetime, timezone
from typing import Optional


_SUCCESS_STATUSES = ("success", "Success", "1", "finalized", "confirmed")


def _tx_succeeded(t: dict) -> bool:
    """Whether a single transaction succeeded.

    The canonical normalized boolean `is_error` is authoritative. Only fall back
    to raw Etherscan fields when it's absent, and treat fully unknown status as
    success (don't penalize pending/unlabeled data). Each tx is evaluated once,
    so there's no OR-chain or global fallback double-counting.
    """
    is_error = t.get("is_error")
    if isinstance(is_error, bool):
        return not is_error
    raw = t.get("isError")
    if raw is not None:
        return str(raw) == "0"
    status = t.get("status")
    if status is not None:
        return status in _SUCCESS_STATUSES
    return True  # no status info → assume success


# Known exchange hot wallet addresses (lowercase) — address-based detection
_EXCHANGE_ADDRESSES = {
    "0x28c6c06298d514db089934071355e5743bf21d60",  # Binance 14
    "0x21a31ee1afc51d94c2efccaa1486ffa9c4a2a28",   # Binance 16
    "0x56eddb7aa87536c09ccc2793473599fd21a8b17f",   # Binance 17
    "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be",   # Binance 1
    "0xd551234ae421e3bcba99a0da6d736074f22192ff",   # Binance 2
    "0x0681d8db095565fe8a346fa0277bffde9c0edbbf",   # Binance 4
    "0x001866ae5b3de6caa5a51543fd9fb64f524f5478",   # Coinbase 2
    "0x503828976d22510aad0201ac7ec88293211d23da",   # Coinbase 3
    "0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740",   # Coinbase 4
    "0x3cd751e6b0078be393132286c442345e5dc49699",   # Coinbase 5
    "0xa7efae728d2936e78bda97dc267687568dd593f3",   # Kraken 1
    "0xe853c56864a2ebe4576a807d26fdc4a0ada51919",   # Kraken 2
    "0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0",   # Kraken 3
    "0x6fc82a5fe25a5cdb58bc74600a40a69c065263f8",   # Gemini 2
    "0xd24400ae8bfebb18ca49be86258a3c749cf46853",   # Gemini 3
    "0x2b5634c42055806a59e9107ed44d43c426e58258",   # KuCoin
    "0x689c56aef474df92d44a1b70850f808488f9769c",   # KuCoin 2
    "0x1692e170361cefd1eb7240ec13d048fd9af6d667",   # OKX 1
    "0x6cc5f688a315f3dc28a7781717a9a798a59fda7b",   # OKX 2
    "0x236f9f97e0e62388479bf9e5ba4889e46b0273c3",   # Bitfinex
    "0x1151314c646ce4e0efd76d1af4760ae66a9fe30f",   # Bitfinex 2
}

# DeFi routers, aggregators and major token contracts. These are NOT trading
# wallets — they're infrastructure that shows up with enormous "trade" volume
# (e.g. a router is the taker on every swap it forwards). Without this cap they
# leak into the leaderboard as fake score-100 "whales". Treated as entities.
_CONTRACT_ADDRESSES = {
    "0x7a250d5630b4cf539739df2c5dacb4c659f2488d",  # Uniswap V2 router
    "0xe592427a0aece92de3edee1f18e0157c05861564",  # Uniswap V3 router
    "0x68b3465833fb59dff930eea164973ecf6cdf4ede",  # Uniswap router 2
    "0x111111125421ca6dc452d289314280a0f8842a65",  # 1inch v6
    "0x1111111254eeb25477b68fb85ed929f73a960582",  # 1inch v5
    "0xdef1c0ded9bec7f1a1670819833240f027b25eff",  # 0x Exchange Proxy
    "0xba12222222228d8ba445958a75a0704d566bf2c8",  # Balancer Vault
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",  # WETH
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",  # USDC
    "0xdac17f958d2ee523a2206206994597c13d831ec7",  # USDT
    "0x6b175474e89094c44da98b954eedeac495271d0f",  # DAI
    "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",  # WBTC
}
_EXCHANGE_ADDRESSES |= _CONTRACT_ADDRESSES

# Broad keyword set for named exchanges / custodians / protocols / infra.
# Matches the seed-file "known-entity" tagging so they rank low consistently.
# Comprehensive global coverage — these are operational wallets, not alpha.
_ENTITY_KEYWORDS = {
    # major exchanges
    "binance", "coinbase", "kraken", "kucoin", "okx", "okex", "gemini", "bitfinex",
    "gate", "bybit", "huobi", "htx", "bitmex", "bitstamp", "crypto.com", "ftx",
    "upbit", "bithumb", "coinone", "poloniex", "hitbtc", "bitmart", "whitebit",
    "bingx", "btcturk", "bitbank", "coincheck", "revolut", "bitflyer", "quadrigacx",
    "luno", "korbit", "gopax", "probit", "latoken", "ascendex", "phemex", "deribit",
    "bitvavo", "wazirx", "coindcx", "bitget", "lbank", "mexc", "bitpanda", "robinhood",
    # regional / additional exchanges (the ones that slipped through)
    "coinhako", "bitso", "bitkub", "indodax", "mercado", "paribu", "zebpay", "valr",
    "yellowcard", "coins.ph", "swyftx", "coinjar", "easycrypto", "kanga", "zonda",
    "coinmate", "cex.io", "gmo", "liquid", "zaif", "foblgate", "gdac", "hanbitco",
    "p2pb2b", "coinsbit", "digifinex", "xt.com", "bitrue", "coinw", "tokocrypto",
    "independent reserve", "kanga", "bitazza", "bitopro",
    "cryptomkt", "buda", "ripio", "quidax", "busha", "roqqu",
    # custodians / market makers / OTC / funds
    "falconx", "bitgo", "cumberland", "wintermute", "jump", "b2c2", "genesis", "gsr",
    "dwf", "circle", "paxos", "tether", "matrixport", "amber", "qcp", "galaxy",
    "fireblocks", "copper", "anchorage", "ceffu", "sygnum", "cobo", "hex trust",
    "nexo", "celsius", "blockfi", "voyager", "dcg", "withdrawdao",
    # generic infra / contract markers
    "exchange", "hot wallet", "cold wallet", "mev bot", "deposit", "custody",
    "wrapped", "bridge", "beacon", "staking", "vault", "router", "contract",
    "treasury", "fund", "reserve", "multisig", "gnosis safe",
}


def _is_known_entity(address: Optional[str], label: Optional[str], hint: bool = False) -> bool:
    """True if wallet is a known exchange/custodian/protocol — capped low."""
    if hint:
        return True
    if address and address.lower() in _EXCHANGE_ADDRESSES:
        return True
    label_lower = (label or "").lower()
    if ":" in (label or ""):  # "Linea: L1 Message Service" style protocol labels
        return True
    if any(kw in label_lower for kw in _ENTITY_KEYWORDS):
        return True
    # Defer to data.wallets if present (legacy detection)
    try:
        from data.wallets import is_exchange as label_check
        return label_check(label or "")
    except Exception:
        return False


def score_wallet(
    transactions: list,
    balance: float,
    chain: str,
    address: str = None,
    label: str = None,
    known_entity: bool = False,
) -> dict:
    """Score a wallet 0-100 on trading-alpha behavior. See module docstring."""

    if _is_known_entity(address, label, hint=known_entity):
        return _entity_result(label)

    if not transactions:
        return _empty_result()

    now = datetime.now(timezone.utc)
    tx_count = len(transactions)

    # ── RECENCY (0-25) ───────────────────────────────────────────────
    # v5.1: CONTINUOUS exponential decay instead of buckets. Bucketed recency
    # gave every active wallet a flat 25, which (with the other maxed buckets)
    # produced a wall of 100s. A smooth curve lets scores actually spread.
    latest = _get_latest_timestamp(transactions)
    days_since = (now - latest).days if latest else None
    if days_since is None:
        recency_score = 0
    else:
        recency_score = round(25 * math.exp(-max(days_since, 0) / 25.0))

    # ── ACTIVITY (0-25) ──────────────────────────────────────────────
    # v5.1: CONTINUOUS log scale, asymptotic to 25 only at extreme counts.
    # Two busy whales with different tx counts now get different scores instead
    # of both flat-lining at 25.
    activity_score = round(min(25.0, 25 * math.log1p(tx_count) / math.log1p(800)))

    # ── DeFi ENGAGEMENT (0-25) ───────────────────────────────────────
    # Real alpha interacts with DeFi: contract calls (methodId != 0x) and a
    # diversity of token transfers. Passive holders / custodians score ~0 here,
    # which is exactly how we separate traders from parked capital.
    contract_calls = sum(
        1 for t in transactions
        if t.get("method_id") not in (None, "", "0x", "0x0")
        or t.get("type") == "token_transfer"
    )
    token_symbols = {
        t.get("token_symbol") for t in transactions
        if t.get("type") == "token_transfer" and t.get("token_symbol")
    }
    token_diversity = len(token_symbols)

    # v5.1: CONTINUOUS — call ratio scaled linearly (0-13) + token diversity on a
    # saturating curve (0-12). Neither maxes for a typical wallet, so DeFi
    # engagement spreads scores instead of pinning them at 25.
    call_ratio = contract_calls / tx_count if tx_count else 0
    engage_points = call_ratio * 13.0
    engage_points += 12.0 * (1 - math.exp(-token_diversity / 9.0))
    defi_score = round(min(engage_points, 25))

    # ── SUCCESS RATE (0-15) ──────────────────────────────────────────
    # Decide success per-transaction. The canonical normalized flag `is_error`
    # is authoritative; only fall back to raw Etherscan fields when it's absent.
    # Each tx is counted at most once (no OR-chain / global fallback double-count).
    successful = sum(1 for t in transactions if _tx_succeeded(t))
    success_rate = successful / tx_count if tx_count else 0
    success_score = round(success_rate * 15)

    # ── BALANCE (0-10) ───────────────────────────────────────────────
    # v5.1: CONTINUOUS log — mild confidence factor, never the driver.
    balance_score = round(min(10.0, 10 * math.log1p(max(balance, 0)) / math.log1p(50000))) if balance > 0 else 0

    total = min(
        activity_score + defi_score + recency_score + success_score + balance_score,
        100,
    )
    grade = _grade(total)

    return {
        "score": total,
        "grade": grade,
        "breakdown": {
            "activity": activity_score,
            "success_rate": success_score,
            "balance": balance_score,
            "recency": recency_score,
            "defi": defi_score,
        },
        "methodology": "v5_behavioral",
        # tx_success_rate = % of txns that didn't revert. NOT a trading win rate.
        "tx_success_rate": round(success_rate * 100, 1),
        "defi_ratio": round(call_ratio * 100, 1),
        "token_diversity": token_diversity,
        "last_active_days_ago": days_since,
        "summary": _summary(total, tx_count, success_rate, balance, days_since, defi_score),
        "is_exchange": False,
    }


def _entity_result(label: str) -> dict:
    """Known exchange/custodian/protocol — operational volume, no trading signal."""
    return {
        "score": 20,
        "grade": "F",
        "breakdown": {
            "activity": 10,
            "success_rate": 8,
            "balance": 2,
            "recency": 0,
            "defi": 0,
        },
        "methodology": "v5_entity",
        "tx_success_rate": 0,
        "defi_ratio": 0,
        "token_diversity": 0,
        "summary": "Known entity (exchange / custodian / router / token contract). Operational flow only — not a trading signal.",
        "is_exchange": True,
    }


def _empty_result() -> dict:
    return {
        "score": 0,
        "grade": "F",
        "breakdown": {
            "activity": 0,
            "success_rate": 0,
            "balance": 0,
            "recency": 0,
            "defi": 0,
        },
        "methodology": "v5_no_data",
        "tx_success_rate": 0,
        "defi_ratio": 0,
        "token_diversity": 0,
        "summary": "No transaction data available yet.",
        "is_exchange": False,
    }


def _get_latest_timestamp(transactions: list) -> Optional[datetime]:
    """Return the most recent transaction time across the list (not just [0])."""
    latest: Optional[datetime] = None
    for tx in transactions:
        dt = None
        ts_unix = tx.get("timestamp_unix")
        ts_str = tx.get("timestamp")
        try:
            if ts_unix and int(ts_unix) > 0:
                dt = datetime.fromtimestamp(int(ts_unix), tz=timezone.utc)
            elif ts_str:
                dt = datetime.fromisoformat(str(ts_str).replace("Z", "+00:00"))
                if not dt.tzinfo:
                    dt = dt.replace(tzinfo=timezone.utc)
        except Exception:
            continue
        if dt and (latest is None or dt > latest):
            latest = dt
    return latest


def _grade(score: int) -> str:
    if score >= 90: return "S"
    if score >= 80: return "A"
    if score >= 65: return "B"
    if score >= 50: return "C"
    if score >= 35: return "D"
    return "F"


def _summary(score: int, tx_count: int, win_rate: float, balance: float,
             days_since: Optional[int], defi_score: int) -> str:
    win_pct = round(win_rate * 100)
    eth = f"{balance:,.2f} ETH"
    active = (
        "active today" if days_since is not None and days_since <= 1
        else f"last active {days_since}d ago" if days_since is not None
        else "activity unknown"
    )
    defi = "DeFi-active" if defi_score >= 12 else "low DeFi engagement"
    # Behavioral language only — this score does not measure profitability.
    if score >= 80:
        return (f"Highly active on-chain — {active}, {tx_count} recent txns, "
                f"{win_pct}% landed, {defi}, {eth}. Behavioral signal, not P&L.")
    if score >= 65:
        return f"Consistently active — {active}, {tx_count} txns tracked, {win_pct}% landed, {defi}."
    if score >= 50:
        return f"Moderate activity — {active}, {tx_count} txns, {eth}."
    if score >= 35:
        return f"Light/dormant — {active}, {tx_count} txns recorded."
    return f"Dormant or low-signal — {active}, {tx_count} txns, {eth}."
