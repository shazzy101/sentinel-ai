"""
Free RSS/Atom news sources for Sentinel News Intelligence.

Only sources with legitimate, public feeds are included. Paywalled outlets
(Bloomberg, Reuters, FT, The Block) and X/Twitter (paid API) are intentionally
excluded — their ToS forbid scraping or there's no public feed.

`weight` (0.5–1.0) feeds the importance score — higher for high-signal outlets.
"""

SOURCES = [
    # ── Crypto-native ──
    {"name": "CoinDesk", "url": "https://www.coindesk.com/arc/outboundfeeds/rss/", "weight": 1.0},
    {"name": "Cointelegraph", "url": "https://cointelegraph.com/rss", "weight": 0.85},
    {"name": "Decrypt", "url": "https://decrypt.co/feed", "weight": 0.85},
    {"name": "CryptoSlate", "url": "https://cryptoslate.com/feed/", "weight": 0.75},
    {"name": "Bitcoin Magazine", "url": "https://bitcoinmagazine.com/.rss/full/", "weight": 0.75},
    {"name": "Blockworks", "url": "https://blockworks.co/feed", "weight": 0.9},
    {"name": "The Defiant", "url": "https://thedefiant.io/api/feed", "weight": 0.8},
    {"name": "BeInCrypto", "url": "https://beincrypto.com/feed/", "weight": 0.65},
    {"name": "CryptoPotato", "url": "https://cryptopotato.com/feed/", "weight": 0.6},
    # ── TradFi / macro (crypto-relevant) ──
    {"name": "Yahoo Finance", "url": "https://finance.yahoo.com/news/rssindex", "weight": 0.7},
    {"name": "CNBC Markets", "url": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258", "weight": 0.7},
]
