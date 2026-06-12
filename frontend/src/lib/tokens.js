/** Ethereum mainnet token registry for swap/trade flows.
 *  Swaps route through the DefiLlama aggregator, which supports any ERC-20 by
 *  address — so adding a token here is all it takes to make it tradable. */
export const TOKEN_ADDRESSES = {
  ETH:  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  DAI:  '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  LINK: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
  UNI:  '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
  AAVE: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
  LDO:  '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32',
  MKR:  '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
  CRV:  '0xD533a949740bb3306d119CC777fa900bA034cd52',
  ENS:  '0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72',
  ARB:  '0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1',
  PEPE: '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
  SHIB: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
};

export const TOKEN_DECIMALS = {
  ETH: 18, WETH: 18, USDC: 6, USDT: 6, DAI: 18, WBTC: 8,
  LINK: 18, UNI: 18, AAVE: 18, LDO: 18, MKR: 18, CRV: 18,
  ENS: 18, ARB: 18, PEPE: 18, SHIB: 18,
};

// You can pay with (sell) or receive (buy) any listed token.
const ALL_TOKENS = Object.keys(TOKEN_ADDRESSES);
export const FROM_TOKENS = ALL_TOKENS;
export const TO_TOKENS = ALL_TOKENS;

export const POPULAR_PAIRS = [
  { from: 'ETH', to: 'USDC', label: 'ETH → USDC' },
  { from: 'USDC', to: 'ETH', label: 'USDC → ETH' },
  { from: 'ETH', to: 'WBTC', label: 'ETH → WBTC' },
  { from: 'USDC', to: 'LINK', label: 'USDC → LINK' },
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
