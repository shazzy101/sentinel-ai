/** Ethereum mainnet token registry for swap/trade flows */
export const TOKEN_ADDRESSES = {
  ETH:  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
};

export const TOKEN_DECIMALS = {
  ETH: 18, USDC: 6, USDT: 6, WBTC: 8, WETH: 18,
};

export const FROM_TOKENS = ['ETH', 'USDC', 'USDT', 'WBTC'];
export const TO_TOKENS = ['USDC', 'USDT', 'WBTC', 'ETH', 'WETH'];

export const POPULAR_PAIRS = [
  { from: 'ETH', to: 'USDC', label: 'ETH → USDC' },
  { from: 'USDC', to: 'ETH', label: 'USDC → ETH' },
  { from: 'ETH', to: 'WBTC', label: 'ETH → WBTC' },
  { from: 'ETH', to: 'WETH', label: 'ETH → WETH' },
];

export const CHAIN_ID_MAINNET = 1;

export function isNativeToken(symbol) {
  return symbol === 'ETH';
}

export function isErc20(symbol) {
  return !isNativeToken(symbol) && Boolean(TOKEN_ADDRESSES[symbol]);
}

export function formatTokenAmount(rawAmount, tokenSymbol) {
  const decimals = TOKEN_DECIMALS[tokenSymbol] ?? 18;
  const value = Number(rawAmount) / Math.pow(10, decimals);
  if (!value && value !== 0) return '—';
  if (value === 0) return '0';
  if (value < 0.000001) return value.toExponential(4);
  if (value >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return value.toFixed(6);
}

export function toTokenUnits(amount, tokenSymbol) {
  const decimals = TOKEN_DECIMALS[tokenSymbol] ?? 18;
  return Math.floor(parseFloat(amount) * Math.pow(10, decimals)).toString();
}

export function parseQuoteOutput(quote, toToken) {
  if (!quote) return null;
  const raw = quote.toAmount ?? quote.amountOut ?? quote.estimatedAmountOut;
  if (raw == null) return null;
  return formatTokenAmount(raw, toToken);
}

export function flattenProtocols(quote) {
  if (!quote?.protocols) return [];
  const flat = [];
  const walk = (node) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node?.name) flat.push(node.name);
    else if (typeof node === 'string') flat.push(node);
  };
  walk(quote.protocols);
  return [...new Set(flat)];
}
