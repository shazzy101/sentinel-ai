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
  getSwapQuote: (fromToken, toToken, amount) =>
    fetch(
      `https://api.swap.defillama.com/v2/quote` +
      `?tokenIn=${fromToken}&tokenOut=${toToken}` +
      `&amountIn=${amount}&chain=ethereum&slippage=0.5`
    ).then((r) => r.json()),
};
