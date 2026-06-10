import { apiFetch } from './apiClient';

// ── Market Data (CoinGecko free tier) ──────────
export const api = {
  getEthPrice: () =>
    fetch(
      'https://api.coingecko.com/api/v3/simple/price' +
      '?ids=ethereum&vs_currencies=usd' +
      '&include_24hr_change=true' +
      '&include_market_cap=true'
    ).then((r) => r.json()),

  getEthChart: (days = 365) =>
    fetch(
      `https://api.coingecko.com/api/v3/coins/ethereum` +
      `/market_chart?vs_currency=usd&days=${days}`
    ).then((r) => r.json()),

  getTopEthTokens: () =>
    fetch(
      'https://api.coingecko.com/api/v3/coins/markets' +
      '?vs_currency=usd&category=ethereum-ecosystem' +
      '&order=market_cap_desc&per_page=20&page=1' +
      '&price_change_percentage=24h,7d'
    ).then((r) => r.json()),

  getTokenChart: (coinId, days = 7) =>
    fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}` +
      `/market_chart?vs_currency=usd&days=${days}`
    ).then((r) => r.json()),

  // ── DEX Trade Quote (DefiLlama Swap API — no key needed) ──
  // `from` (the sender's address) is required for the aggregator to return
  // executable `tx` calldata. Without it, the quote is price-only and the
  // swap can't be sent through MetaMask.
  getSwapQuote: (fromToken, toToken, amount, from) => {
    const params = new URLSearchParams({
      tokenIn: fromToken,
      tokenOut: toToken,
      amountIn: String(amount),
      chain: 'ethereum',
      slippage: '0.5',
    });
    if (from) {
      params.set('from', from);
      params.set('userAddress', from); // alias used by some aggregator routes
    }
    return fetch(`https://api.swap.defillama.com/v2/quote?${params.toString()}`).then((r) => r.json());
  },

  getWhaleTrades: () =>
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/invest/whale-trades`)
      .then((r) => r.json())
      .then((body) => (body.success ? body.data?.trades : body.trades) || []),

  // ── Network dashboard (Dune-powered, cached on backend) ──
  getNetworkPulse: () =>
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/network/pulse`)
      .then((r) => r.json())
      .then((body) => body.data || { available: false }),

  getNetworkTopTokens: () =>
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/network/top-tokens`)
      .then((r) => r.json())
      .then((body) => body.data?.tokens || []),

  getNetworkLargeTrades: () =>
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/network/large-trades`)
      .then((r) => r.json())
      .then((body) => body.data?.trades || []),

  getCopyTradingTop: (opts = {}) => {
    const {
      limit = 50,
      sort = 'copy_score',
      qualifiedOnly = true,
    } = opts;
    const params = new URLSearchParams({
      limit: String(limit),
      sort,
      qualified_only: String(qualifiedOnly),
    });
    return fetch(`${import.meta.env.VITE_API_URL || ''}/api/copy-trading/top?${params}`)
      .then((r) => r.json())
      .then((body) => body.data || { wallets: [], count: 0 });
  },

  getCopyTrader: (address) =>
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/copy-trading/${address}`)
      .then((r) => r.json())
      .then((body) => (body.success ? body.data?.wallet : null)),

  trackCopyTrader: (address) =>
    apiFetch(`/api/copy-trading/${address}/track`, { method: 'POST', timeoutMs: 90000 }),

  getLatestTransactions: (limit = 12) =>
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/transactions/latest?limit=${limit}`)
      .then((r) => r.json())
      .then((body) => body.data?.transactions || []),
};
