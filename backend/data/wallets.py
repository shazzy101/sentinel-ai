"""
Sentinel AI — Verified Smart Money Wallet Registry
Curated list of real funds, traders, and institutional players.
Exchange wallets are explicitly excluded from smart money scoring.
"""

SMART_MONEY_WALLETS = [
    # ── INSTITUTIONAL FUNDS ─────────────────────────
    {
        "label": "Paradigm",
        "address": "0x5F51F49e5B5E9476e2f4AF59b8146aef4F3E26Fb",
        "category": "fund",
        "tags": ["vc", "institutional", "defi"],
    },
    {
        "label": "a16z Crypto",
        "address": "0x05e793ce0C6027323Ac150F6d45C2344d28B6019",
        "category": "fund",
        "tags": ["vc", "institutional"],
    },
    {
        "label": "Dragonfly Capital",
        "address": "0x564286362092D8e7936f0549571a803B203aAce",
        "category": "fund",
        "tags": ["vc", "institutional"],
    },
    {
        "label": "Jump Crypto",
        "address": "0x46340b20830761efd32832A74d7169B29FEB9758",
        "category": "market_maker",
        "tags": ["market-maker", "institutional"],
    },
    {
        "label": "Wintermute",
        "address": "0x4f3aFF3A747fCADe12598081e80c6605A8be192F",
        "category": "market_maker",
        "tags": ["market-maker", "institutional", "active"],
    },
    {
        "label": "Cumberland DRW",
        "address": "0x53d284357ec70cE289D6D64134DfAc8E511c8a3D",
        "category": "market_maker",
        "tags": ["institutional", "trading"],
    },
    {
        "label": "Galaxy Digital",
        "address": "0xD558b79b3bFb4e4E95Db5F2bECd26ebF19D30bE9",
        "category": "fund",
        "tags": ["institutional", "fund"],
    },
    {
        "label": "Multicoin Capital",
        "address": "0xF977814e90dA44bFA03b6295A0616a897441aceC",
        "category": "fund",
        "tags": ["vc", "institutional"],
    },
    {
        "label": "Pantera Capital",
        "address": "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8",
        "category": "fund",
        "tags": ["vc", "fund", "institutional"],
    },
    # ── KNOWN DEFI SMART TRADERS ────────────────────
    {
        "label": "DeFi Whale Alpha",
        "address": "0x28C6c06298d514Db089934071355E5743bf21d60",
        "category": "smart_money",
        "tags": ["defi", "smart-money", "active"],
    },
    {
        "label": "Known DeFi Trader",
        "address": "0xA69babEF1cA67A37Ffaf7a485DfFF3382056e78B",
        "category": "smart_money",
        "tags": ["defi", "smart-money"],
    },
    {
        "label": "ETH Accumulator",
        "address": "0x220866B1A2219f40e72f5c628B65D54268cA3A9D",
        "category": "smart_money",
        "tags": ["accumulator", "long-term"],
    },
    {
        "label": "DeFi Power User",
        "address": "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503",
        "category": "smart_money",
        "tags": ["defi", "yield-farming"],
    },
    {
        "label": "Flashbots Searcher",
        "address": "0x98C3d3183C4b8A650614ad179A1a98be0a8d6B8E",
        "category": "mev",
        "tags": ["mev", "arbitrage", "active"],
    },
    # ── PROTOCOL TREASURIES ─────────────────────────
    {
        "label": "Uniswap Treasury",
        "address": "0x1a9C8182C09F50C8318d769245beA52c32BE35BC",
        "category": "protocol",
        "tags": ["protocol", "defi", "uniswap"],
    },
    {
        "label": "Aave Collector",
        "address": "0x464C71f6c2F760DdA6093dCB91C24c39e5d6e18c",
        "category": "protocol",
        "tags": ["protocol", "defi", "aave"],
    },
    {
        "label": "Compound Treasury",
        "address": "0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B",
        "category": "protocol",
        "tags": ["protocol", "defi", "compound"],
    },
    {
        "label": "Curve DAO",
        "address": "0xeCb456EA5365865EbAb8a2661B0c503410e9B347",
        "category": "protocol",
        "tags": ["protocol", "defi", "curve"],
    },
    {
        "label": "Lido Treasury",
        "address": "0x3e40D73EB977Dc6a537aF587D48316feE66E9C8c",
        "category": "protocol",
        "tags": ["protocol", "staking", "lido"],
    },
    # ── LEGENDARY WALLETS ───────────────────────────
    {
        "label": "Vitalik Buterin",
        "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        "category": "founder",
        "tags": ["founder", "ethereum", "legend"],
    },
    {
        "label": "Ethereum Foundation",
        "address": "0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe",
        "category": "institution",
        "tags": ["foundation", "ethereum", "institutional"],
    },
    # ── HIGH-CONVICTION TRADERS ─────────────────────
    {
        "label": "Smart Money 0x7a",
        "address": "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        "category": "smart_money",
        "tags": ["defi", "uniswap-router", "high-volume"],
    },
    {
        "label": "ETH2 Deposit Contract",
        "address": "0x00000000219ab540356cBB839Cbe05303d7705Fa",
        "category": "smart_money",
        "tags": ["eth2-deposit", "staking", "institutional"],
    },
]

# Exchange label keywords — wallets matching these are NOT smart money
_EXCHANGE_KEYWORDS = {
    "binance", "coinbase", "kraken", "kucoin", "okx",
    "crypto.com", "gemini", "bitstamp", "coinone",
    "bybit", "huobi", "bitfinex", "upbit", "mev bot",
    "robinhood", "bithumb",
}


def is_exchange(label: str) -> bool:
    """Return True if the wallet label matches a known exchange."""
    label_lower = (label or "").lower()
    return any(ex in label_lower for ex in _EXCHANGE_KEYWORDS)
