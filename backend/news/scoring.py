"""
Heuristic news scoring — ZERO Claude calls.

Every ingested article runs through here to get tickers, protocols, category,
bull/bear sentiment, importance, and an Ethereum-relevance score. Claude is
reserved only for deep analysis on the few highest-impact stories (see
backend/ai/news_analyst.py), keeping API cost near zero.
"""

import re

# ── Token universe: symbol -> matchable aliases (lowercased) ──────────────────
TOKENS = {
    "BTC": ["bitcoin", "btc"],
    "ETH": ["ethereum", " eth", "ether ", "eth ", "$eth"],
    "SOL": ["solana", "sol "],
    "USDC": ["usdc", "circle"],
    "USDT": ["usdt", "tether"],
    "ARB": ["arbitrum", "arb "],
    "OP": ["optimism", " op "],
    "MATIC": ["polygon", "matic"],
    "LINK": ["chainlink", "link "],
    "UNI": ["uniswap", "uni "],
    "AAVE": ["aave"],
    "LDO": ["lido"],
    "MKR": ["makerdao", "maker", "mkr"],
    "PEPE": ["pepe"],
    "DOGE": ["dogecoin", "doge"],
    "XRP": ["ripple", "xrp"],
    "BNB": ["binance coin", "bnb"],
    "AVAX": ["avalanche", "avax"],
    "WBTC": ["wrapped bitcoin", "wbtc"],
    "STETH": ["steth", "staked eth"],
}

PROTOCOLS = {
    "Uniswap": ["uniswap"], "Aave": ["aave"], "Lido": ["lido"], "MakerDAO": ["makerdao", "maker"],
    "Curve": ["curve finance", "curve"], "Compound": ["compound"], "EigenLayer": ["eigenlayer", "eigen"],
    "Base": ["base "], "Arbitrum": ["arbitrum"], "Optimism": ["optimism"], "zkSync": ["zksync"],
    "Starknet": ["starknet"], "Scroll": ["scroll "], "Blast": ["blast"], "Pendle": ["pendle"],
    "Coinbase": ["coinbase"], "Binance": ["binance"], "Kraken": ["kraken"], "BlackRock": ["blackrock"],
}

# ── Ethereum-relevance terms ──────────────────────────────────────────────────
ETH_TERMS = [
    "ethereum", "ether", " eth", "vitalik", "buterin", "layer 2", "layer-2", "l2",
    "rollup", "staking", "validator", "eip-", "erc-20", "erc20", "base ", "arbitrum",
    "optimism", "zksync", "starknet", "scroll", "blast", "danksharding", "dencun",
    "the merge", "beacon chain", "gwei", "gas fee", "restaking", "eigenlayer", "lido",
]

# ── Sentiment lexicons ────────────────────────────────────────────────────────
BULL_WORDS = [
    "surge", "rally", "soar", "jump", "gain", "rise", "rises", "bullish", "breakout",
    "all-time high", "ath", "record high", "approval", "approved", "adoption", "partnership",
    "upgrade", "inflow", "inflows", "accumulate", "accumulating", "buy", "buys", "demand",
    "launch", "launches", "integration", "milestone", "outperform", "boom", "recovery",
    "institutional", "etf approval", "green light", "unlock", "expansion", "upgrade",
]
BEAR_WORDS = [
    "crash", "plunge", "plummet", "drop", "fall", "falls", "slump", "bearish", "selloff",
    "sell-off", "dump", "hack", "hacked", "exploit", "exploited", "breach", "lawsuit", "sue",
    "sued", "ban", "banned", "crackdown", "outflow", "outflows", "liquidation", "liquidated",
    "delay", "delayed", "rejected", "rejection", "fraud", "scam", "collapse", "fear",
    "warning", "probe", "investigation", "charges", "fine", "penalty", "exploit", "rug",
]

# ── High-impact event terms (boost importance) ────────────────────────────────
IMPACT_TERMS = [
    "sec", "etf", "blackrock", "fed", "federal reserve", "rate cut", "rate hike", "cpi",
    "lawsuit", "hack", "exploit", "billion", "approval", "regulation", "congress", "white house",
    "trump", "interest rate", "inflation", "bankruptcy", "ftx", "binance", "coinbase", "halving",
]

# ── Category keyword buckets ──────────────────────────────────────────────────
CATEGORY_RULES = {
    "Regulation": ["sec", "regulat", "lawsuit", "congress", "cftc", "ban", "compliance", "legal", "court"],
    "Institutional": ["etf", "blackrock", "institutional", "fidelity", "grayscale", "custody", "fund"],
    "Layer 2": ["layer 2", "layer-2", "l2", "arbitrum", "optimism", "base ", "zksync", "starknet", "scroll", "rollup"],
    "DeFi": ["defi", "uniswap", "aave", "lido", "curve", "yield", "lending", "liquidity", "tvl", "dex"],
    "Stablecoins": ["stablecoin", "usdc", "usdt", "tether", "circle", "dai", "peg"],
    "NFT": ["nft", "opensea", "collectible", "pfp", "ordinals"],
    "AI": ["artificial intelligence", " ai ", "ai token", "machine learning", "agent"],
    "Macro": ["fed", "inflation", "cpi", "interest rate", "recession", "treasury", "jobs report", "gdp"],
    "Exchange News": ["binance", "coinbase", "kraken", "exchange", "listing", "delisting"],
    "Whale Activity": ["whale", "large transfer", "moved", "accumulat", "dormant wallet"],
}

ETH_CATEGORY_TERMS = ["ethereum", "ether", "vitalik", "staking", "validator", "eip-", "the merge", "dencun"]


def _count(text: str, terms: list[str]) -> int:
    return sum(text.count(t) for t in terms)


def extract_tickers(text: str) -> list[str]:
    found = []
    for sym, aliases in TOKENS.items():
        if any(a in text for a in aliases):
            found.append(sym)
    return found


def extract_protocols(text: str) -> list[str]:
    found = []
    for name, aliases in PROTOCOLS.items():
        if any(a in text for a in aliases):
            found.append(name)
    return found


def classify_category(text: str) -> str:
    best, best_score = "Macro", 0
    for cat, terms in CATEGORY_RULES.items():
        s = _count(text, terms)
        if s > best_score:
            best, best_score = cat, s
    if best_score == 0 and any(t in text for t in ETH_CATEGORY_TERMS):
        return "Ethereum"
    return best if best_score > 0 else "Markets"


def ethereum_relevance(text: str) -> int:
    hits = _count(text, ETH_TERMS)
    return min(100, hits * 18)


def sentiment(text: str) -> tuple[int, int, str]:
    """Return (bull_score, bear_score, label). Lexicon-based, 0-100 each.
    Swing is dampened when there's little signal, so 'Strongly' labels require
    multiple sentiment words rather than a single keyword match."""
    b = _count(text, BULL_WORDS)
    r = _count(text, BEAR_WORDS)
    total = b + r
    if total == 0:
        return 50, 50, "Neutral"
    confidence = min(total / 3.0, 1.0)  # full swing only at 3+ sentiment words
    bull = round(50 + (b - r) / total * 50 * confidence)
    bull = max(0, min(100, bull))
    bear = 100 - bull
    if bull >= 72:
        label = "Strongly Bullish"
    elif bull >= 57:
        label = "Bullish"
    elif bull <= 28:
        label = "Strongly Bearish"
    elif bull <= 43:
        label = "Bearish"
    else:
        label = "Neutral"
    return bull, bear, label


def importance(text: str, source_weight: float, n_tickers: int) -> int:
    """0-100 importance. Source quality + impact terms + ticker breadth + intensity."""
    impact_hits = _count(text, IMPACT_TERMS)
    intensity = _count(text, BULL_WORDS) + _count(text, BEAR_WORDS)
    raw = (
        source_weight * 28
        + min(impact_hits, 5) * 9
        + min(n_tickers, 4) * 4
        + min(intensity, 6) * 2
    )
    return int(min(100, raw))


def score_article(title: str, summary: str, source_weight: float) -> dict:
    """Full heuristic scoring for one article. No Claude."""
    text = f" {(title or '').lower()} {(summary or '').lower()} "
    tickers = extract_tickers(text)
    protocols = extract_protocols(text)
    bull, bear, label = sentiment(text)
    return {
        "affected_tokens": tickers,
        "affected_protocols": protocols,
        "category": classify_category(text),
        "ethereum_relevance": ethereum_relevance(text),
        "bull_score": bull,
        "bear_score": bear,
        "sentiment": label,
        "importance_score": importance(text, source_weight, len(tickers)),
    }
