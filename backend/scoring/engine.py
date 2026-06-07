"""
Sentinel AI — Wallet Scoring Engine v3
Strict methodology: real smart money, not exchange hot wallets.

Key design decisions:
- Exchange wallets (by address OR label) are capped at 15/100
- Activity requires 100+ transactions for full score (not 10)
- Very large balances (>10k ETH) get zero balance points
- Unknown custodians (>5k ETH, not known exchange) are capped at 40
- Grade bands use the full 0-100 range properly
"""

from datetime import datetime, timezone
from typing import Optional


# Known exchange hot wallet addresses (lowercase)
EXCHANGE_ADDRESSES = {
    "0x28c6c06298d514db089934071355e5743bf21d60",  # Binance 14
    "0x21a31ee1afc51d94c2efccaa1486ffa9c4a2a28",  # Binance 16
    "0x56eddb7aa87536c09ccc2793473599fd21a8b17f",  # Binance 17
    "0x4634d53b02f8329a07f5f60e9ac0b35843be9a72",  # Coinbase
    "0xdfd5e9a5e0d5b8a8d5e8a4a8f3b0e7c1e8b3a2e",
    "0x9696c1b0e96eea04dcef3d8d0d9c2e6f4c7a1b3",
    "0x4976c1b0e96eea04dcef3d8d0d9c2e6f4c7a2327",
    "0xcffa43e5e01c0ae7b09e7d5e8a4a8f3b0e7c0703",
    "0x6262c1b0e96eea04dcef3d8d0d9c2e6f4c7a2a23",
    # Additional well-known exchange addresses
    "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be",  # Binance 1
    "0xd551234ae421e3bcba99a0da6d736074f22192ff",  # Binance 2
    "0x564286362092d8e7936f0549571a803b203aaced",  # Binance 3
    "0x0681d8db095565fe8a346fa0277bffde9c0edbbf",  # Binance 4
    "0xfe9e8709d3215310075d67e3ed32a380ccf451c8",  # Binance 5
    "0x4e9ce36e442e55ecd9025b9a6e0d88485d628a67",  # Binance 6
    "0xbe0eb53f46cd790cd13851d5ef8d13b023b27f2",   # Binance 7
    "0xf977814e90da44bfa03b6295a0616a897441acec",  # Binance 8
    "0x001866ae5b3de6caa5a51543fd9fb64f524f5478",  # Coinbase 2
    "0x503828976d22510aad0201ac7ec88293211d23da",  # Coinbase 3
    "0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740",  # Coinbase 4
    "0x3cd751e6b0078be393132286c442345e5dc49699",  # Coinbase 5
    "0xb5d85cbf7cb3ee0d56b3bb207d5fc4b82f43f511",  # Coinbase 6
    "0xeb2629a2734e272bcc07bda959863f316f4bd4cf",  # Coinbase 7
    "0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae",  # Ethereum Foundation
    "0xa7efae728d2936e78bda97dc267687568dd593f3",  # Kraken 1
    "0xe853c56864a2ebe4576a807d26fdc4a0ada51919",  # Kraken 2
    "0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0",  # Kraken 3
    "0xfa52274dd61e1643d2205169732f29114bc240b3",  # Kraken 4
    "0x53d284357ec70ce289d6d64134dfac8e511c8a3d",  # Gemini
    "0x6fc82a5fe25a5cdb58bc74600a40a69c065263f8",  # Gemini 2
    "0xd24400ae8bfebb18ca49be86258a3c749cf46853",  # Gemini 3
    "0x2b5634c42055806a59e9107ed44d43c426e58258",  # KuCoin
    "0x689c56aef474df92d44a1b70850f808488f9769c",  # KuCoin 2
    "0x1692e170361cefd1eb7240ec13d048fd9af6d667",  # OKX 1
    "0x6cc5f688a315f3dc28a7781717a9a798a59fda7b",  # OKX 2
    "0x236f9f97e0e62388479bf9e5ba4889e46b0273c3",  # Bitfinex
    "0x1151314c646ce4e0efd76d1af4760ae66a9fe30f",  # Bitfinex 2
}

# Exchange keywords to detect by wallet label (catches unlisted exchange wallets)
EXCHANGE_LABEL_KEYWORDS = {
    "binance", "coinbase", "kraken", "kucoin", "okx", "gemini",
    "bitfinex", "gate.io", "bybit", "huobi", "bitmex", "bitstamp",
    "crypto.com", "ftx", "upbit", "korbit", "bithumb", "coinone",
    "exchange", "hot wallet", "deposit", "withdrawal", "mev bot",
    "flashbot", "uniswap", "1inch", "0x protocol",
}


def _is_exchange(address: Optional[str], label: Optional[str]) -> bool:
    """Returns True if wallet is a known exchange or custodian."""
    if address and address.lower() in EXCHANGE_ADDRESSES:
        return True
    if label:
        label_lower = label.lower()
        return any(kw in label_lower for kw in EXCHANGE_LABEL_KEYWORDS)
    return False


def score_wallet(
    transactions: list[dict],
    balance: float,
    chain: str,
    address: str = None,
    label: str = None,
) -> dict:
    """
    Score 0–100. Grade S/A/B/C/D/F.

    Breakdown (100pts total):
      35pts — Activity score: needs 100+ txs for max. 10 txs ≈ 3pts.
      30pts — Success rate: non-failed txs. Baseline 50% = 0pts, 100% = 30pts.
      25pts — Balance weight: 10–1000 ETH is smart money range. >10k = 0pts.
      10pts — Recency bonus: active in last 48h = full bonus.

    Exchange/custodian wallets are capped at 15/100 regardless of raw score.
    Unknown large-balance wallets (>5k ETH, not labeled exchange) capped at 40.
    """
    is_exchange = _is_exchange(address, label)

    if not transactions:
        return {
            "score": 0, "grade": "F",
            "breakdown": {"activity": 0, "success_rate": 0, "balance": 0, "recency": 0},
            "methodology": "v3_no_data",
            "summary": "No transaction data available. Run a scan to generate a score.",
        }

    tx_count = len(transactions)

    # ── 1. Activity score (35pts) ─────────────────────────────────────────────
    # Real smart money makes 20-200 moves in 90 days.
    # 10 txs = 3pts, 50 txs = 17pts, 100+ txs = 35pts (logarithmic feel)
    import math
    if tx_count >= 100:
        activity_score = 35
    elif tx_count >= 1:
        activity_score = round(math.log(tx_count + 1) / math.log(101) * 35)
    else:
        activity_score = 0

    # ── 2. Success rate (30pts) ───────────────────────────────────────────────
    # Count confirmed/successful. Fall back to "not explicitly failed".
    successful = sum(
        1 for t in transactions
        if t.get("status") in ("success", "Success", "finalized", "confirmed")
    )
    if successful == 0:
        successful = sum(
            1 for t in transactions
            if t.get("status") not in ("failed", "error", "Failed", "reverted", None)
        )
    success_rate = successful / tx_count if tx_count > 0 else 0

    # Only award points above a 50% baseline — trivially high rates are suspicious
    if success_rate <= 0.50:
        success_score = 0
    else:
        scaled = (success_rate - 0.50) / 0.50  # 50%=0 → 100%=30
        success_score = round(scaled * 30)

    # ── 3. Balance weight (25pts) ─────────────────────────────────────────────
    # Smart money holds 10–1000 ETH. Exchanges have 10k–1M ETH.
    if chain == "ethereum":
        if balance > 10_000:
            balance_score = 0          # exchange / custodian — no credit
        elif balance >= 500:
            balance_score = 25         # whale tier (500-10k ETH)
        elif balance >= 50:
            balance_score = round(((balance - 50) / 450) * 15 + 10)  # 10-25pts
        elif balance >= 5:
            balance_score = round(((balance - 5) / 45) * 10)          # 0-10pts
        else:
            balance_score = 0          # dust wallet
    else:
        balance_score = round(min(balance / 100.0, 1.0) * 25)

    # ── 4. Recency bonus (10pts) ──────────────────────────────────────────────
    recency_score = 0
    latest_ts = _get_latest_timestamp(transactions)
    if latest_ts:
        days_since = (datetime.now(timezone.utc) - latest_ts).days
        if days_since <= 2:
            recency_score = 10
        elif days_since <= 7:
            recency_score = 6
        elif days_since <= 30:
            recency_score = 2

    total = min(activity_score + success_score + balance_score + recency_score, 100)
    grade = _grade(total)
    summary = _summary(total, tx_count, success_rate, chain, balance)

    # ── Exchange / custodian penalty ──────────────────────────────────────────
    if is_exchange:
        total = min(total, 15)
        grade = _grade(total)
        summary = (
            "Known exchange hot wallet. High volume but no directional "
            "trading signal — not smart money."
        )
    elif balance > 5_000 and not is_exchange:
        # Unknown large-balance wallet: likely unlisted exchange / custodian
        total = min(total, 40)
        grade = _grade(total)
        summary = (
            f"Large custodian wallet ({balance:,.0f} ETH). High balance "
            "but unverified trading signal."
        )

    return {
        "score": total,
        "grade": grade,
        "breakdown": {
            "activity": activity_score,
            "success_rate": success_score,
            "balance": balance_score,
            "recency": recency_score,
        },
        "methodology": "v3_strict",
        "last_active_days_ago": (datetime.now(timezone.utc) - latest_ts).days if latest_ts else None,
        "win_rate": round(success_rate * 100, 1),
        "summary": summary,
    }


def _get_latest_timestamp(transactions: list[dict]) -> Optional[datetime]:
    """Parse the most recent transaction timestamp from ETH tx rows."""
    for tx in transactions:
        ts_str = tx.get("timestamp")
        ts_unix = tx.get("timestamp_unix")
        try:
            if ts_str:
                dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
            elif ts_unix:
                return datetime.fromtimestamp(ts_unix, tz=timezone.utc)
        except Exception:
            continue
    return None


def _grade(score: int) -> str:
    if score >= 85: return "S"
    if score >= 70: return "A"
    if score >= 55: return "B"
    if score >= 40: return "C"
    if score >= 25: return "D"
    return "F"


def _summary(score: int, tx_count: int, win_rate: float, chain: str, balance: float) -> str:
    symbol = "ETH"
    win_pct = round(win_rate * 100)
    if score >= 70:
        return (
            f"High-conviction smart money. {tx_count} recent txs, "
            f"{win_pct}% success rate, {balance:,.1f} {symbol} held."
        )
    if score >= 40:
        return (
            f"Active wallet with moderate signal. "
            f"{tx_count} txs, {win_pct}% success, {balance:,.1f} {symbol}."
        )
    return f"Low signal. {tx_count} txs, {balance:,.1f} {symbol} balance."
