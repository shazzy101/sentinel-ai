import { apiFetch } from './apiClient';
import { apiUrl } from './apiBase';

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
      params.set('userAddress', from);
    }
    return fetch(`https://api.swap.defillama.com/v2/quote?${params.toString()}`).then((r) => r.json());
  },

  getWhaleTrades: () =>
    fetch(apiUrl('/api/invest/whale-trades'))
      .then((r) => r.json())
      .then((body) => (body.success ? body.data?.trades : body.trades) || []),

  getNetworkPulse: () =>
    fetch(apiUrl('/api/network/pulse'))
      .then((r) => r.json())
      .then((body) => body.data || { available: false }),

  getNetworkTopTokens: () =>
    fetch(apiUrl('/api/network/top-tokens'))
      .then((r) => r.json())
      .then((body) => body.data?.tokens || []),

  getNetworkLargeTrades: () =>
    fetch(apiUrl('/api/network/large-trades'))
      .then((r) => r.json())
      .then((body) => body.data?.trades || []),

  getCopyTradingTop: (opts = {}) => {
    const {
      limit = 50,
      sort = 'copy_score',
      qualifiedOnly = true,
      strict = true,
    } = opts;
    const params = new URLSearchParams({
      limit: String(limit),
      sort,
      qualified_only: String(qualifiedOnly),
      strict: String(strict),
    });
    return fetch(apiUrl(`/api/copy-trading/top?${params}`))
      .then((r) => r.json())
      .then((body) => body.data || { wallets: [], count: 0 });
  },

  getCopyFeatured: () =>
    fetch(apiUrl('/api/copy-trading/featured'))
      .then((r) => r.json())
      .then((body) => body.data?.traders || []),

  getCopyTrader: (address) =>
    fetch(apiUrl(`/api/copy-trading/${encodeURIComponent(address)}`))
      .then((r) => r.json())
      .then((body) => (body.success ? body.data?.wallet : null)),

  trackCopyTrader: (address) =>
    apiFetch(`/api/copy-trading/${encodeURIComponent(address)}/track`, { method: 'POST', timeoutMs: 20000 }),

  getQuota: () =>
    apiFetch('/api/quota', { auth: true }).then((b) => b.data),

  getCopyTraderMetrics: (address) =>
    fetch(apiUrl(`/api/copy-trading/${encodeURIComponent(address)}/metrics`))
      .then((r) => r.json())
      .then((body) => (body.success ? body.data : { metrics: null, available: false })),

  untrackWallet: (address) =>
    apiFetch(`/api/watchlist/${encodeURIComponent(address)}`, { method: 'DELETE', timeoutMs: 15000 }),

  getCopyRecentMoves: (limit = 12) =>
    fetch(apiUrl(`/api/copy-trading/recent-moves?limit=${limit}`))
      .then((r) => r.json())
      .then((body) => body.data?.moves || []),

  getLatestTransactions: (limit = 12) =>
    fetch(apiUrl(`/api/transactions/latest?limit=${limit}`))
      .then((r) => r.json())
      .then((body) => body.data?.transactions || []),

  joinWaitlist: (email, source) =>
    fetch(apiUrl('/api/waitlist'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source }),
    }).then((r) => r.json()),

  getNews: (opts = {}) => {
    const { category, source, sort = 'recent', limit = 40 } = opts;
    const params = new URLSearchParams({ sort, limit: String(limit) });
    if (category) params.set('category', category);
    if (source) params.set('source', source);
    return fetch(apiUrl(`/api/news?${params}`))
      .then((r) => r.json())
      .then((b) => b.data?.articles || []);
  },

  getNewsPulse: () =>
    fetch(apiUrl('/api/news/pulse'))
      .then((r) => r.json())
      .then((b) => b.data || { available: false }),

  getNewsArticle: (id) =>
    fetch(apiUrl(`/api/news/${id}`))
      .then((r) => r.json())
      .then((b) => b.data || null),
};

export { getApiBase, apiUrl } from './apiBase';
