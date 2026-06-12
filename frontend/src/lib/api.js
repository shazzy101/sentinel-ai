import { apiFetch, apiGet } from './apiClient';

/**
 * Wrapper for third-party APIs (CoinGecko, DefiLlama). Adds an AbortController
 * timeout, checks res.ok, and returns parsed JSON or throws a structured error —
 * so a hung or failing external service never leaves the UI spinning forever.
 */
async function externalJson(url, { timeoutMs = 10000, label = 'service' } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const err = new Error(`${label} request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`${label} timed out — please retry.`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const CG = 'https://api.coingecko.com/api/v3';

export const api = {
  // ── Third-party (CoinGecko / DefiLlama) — timeout + ok-checked ──
  getEthPrice: () =>
    externalJson(`${CG}/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`, { label: 'CoinGecko' }),

  getEthChart: (days = 365) =>
    externalJson(`${CG}/coins/ethereum/market_chart?vs_currency=usd&days=${days}`, { label: 'CoinGecko' }),

  getTopEthTokens: () =>
    externalJson(`${CG}/coins/markets?vs_currency=usd&category=ethereum-ecosystem&order=market_cap_desc&per_page=20&page=1&price_change_percentage=24h,7d`, { label: 'CoinGecko' }),

  getTokenChart: (coinId, days = 7) =>
    externalJson(`${CG}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`, { label: 'CoinGecko' }),

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
    return externalJson(`https://api.swap.defillama.com/v2/quote?${params.toString()}`, { label: 'DefiLlama', timeoutMs: 15000 });
  },

  // ── Internal backend (apiFetch/apiGet: timeout + consistent errors) ──
  getWhaleTrades: () =>
    apiGet('/api/invest/whale-trades').then((d) => d?.trades || []).catch(() => []),

  getAiPicks: (limit = 6) =>
    apiGet(`/api/invest/ai-picks?limit=${limit}`)
      .then((d) => ({ picks: d?.picks || [], marketSignal: d?.market_signal || 'NEUTRAL' }))
      .catch(() => ({ picks: [], marketSignal: 'NEUTRAL' })),

  getNetworkPulse: () =>
    apiGet('/api/network/pulse').then((d) => d || { available: false }).catch(() => ({ available: false })),

  getNetworkTopTokens: () =>
    apiGet('/api/network/top-tokens').then((d) => d?.tokens || []).catch(() => []),

  getNetworkLargeTrades: () =>
    apiGet('/api/network/large-trades').then((d) => d?.trades || []).catch(() => []),

  getCopyTradingTop: (opts = {}) => {
    const { limit = 50, sort = 'copy_score', qualifiedOnly = true, strict = true } = opts;
    const params = new URLSearchParams({
      limit: String(limit),
      sort,
      qualified_only: String(qualifiedOnly),
      strict: String(strict),
    });
    return apiGet(`/api/copy-trading/top?${params}`)
      .then((d) => d || { wallets: [], count: 0 })
      .catch(() => ({ wallets: [], count: 0 }));
  },

  getCopyFeatured: () =>
    apiGet('/api/copy-trading/featured').then((d) => d?.traders || []).catch(() => []),

  getCopyTrader: (address) =>
    apiGet(`/api/copy-trading/${encodeURIComponent(address)}`).then((d) => d?.wallet || null).catch(() => null),

  trackCopyTrader: (address) =>
    apiFetch(`/api/copy-trading/${encodeURIComponent(address)}/track`, { method: 'POST', timeoutMs: 20000, auth: true }),

  getQuota: () =>
    apiFetch('/api/quota', { auth: true }).then((b) => b.data),

  getCopyTraderMetrics: (address) =>
    apiGet(`/api/copy-trading/${encodeURIComponent(address)}/metrics`)
      .then((d) => d || { metrics: null, available: false })
      .catch(() => ({ metrics: null, available: false })),

  untrackWallet: (address) =>
    apiFetch(`/api/watchlist/${encodeURIComponent(address)}`, { method: 'DELETE', timeoutMs: 15000, auth: true }),

  getCopyRecentMoves: (limit = 12) =>
    apiGet(`/api/copy-trading/recent-moves?limit=${limit}`).then((d) => d?.moves || []).catch(() => []),

  getTrustPulse: () =>
    apiGet('/api/trust-pulse').then((d) => d || { available: false }).catch(() => ({ available: false })),

  getTrustMarketing: () =>
    apiGet('/api/trust-pulse/marketing').then((d) => d || {}).catch(() => ({})),

  getDetectedWins: (limit = 20) =>
    apiGet(`/api/detected-wins?limit=${limit}`).then((d) => d || { wins: [] }).catch(() => ({ wins: [] })),

  getLatestTransactions: (limit = 12) =>
    apiGet(`/api/transactions/latest?limit=${limit}`).then((d) => d?.transactions || []).catch(() => []),

  joinWaitlist: (email, source) =>
    apiFetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source }),
      timeoutMs: 15000,
    }),

  getNews: (opts = {}) => {
    const { category, source, sort = 'recent', limit = 40 } = opts;
    const params = new URLSearchParams({ sort, limit: String(limit) });
    if (category) params.set('category', category);
    if (source) params.set('source', source);
    return apiGet(`/api/news?${params}`).then((d) => d?.articles || []).catch(() => []);
  },

  getNewsPulse: () =>
    apiGet('/api/news/pulse').then((d) => d || { available: false }).catch(() => ({ available: false })),

  getNewsArticle: (id) =>
    apiGet(`/api/news/${id}`).then((d) => d || null).catch(() => null),
};

export { getApiBase, apiUrl } from './apiBase';
