/** Format ETH (or token) amounts for display — avoids rounding small balances to 0.00 */
export function formatEthAmount(value, { symbol = 'ETH' } = {}) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return `— ${symbol}`;
  if (n === 0) return `0 ${symbol}`;
  if (Math.abs(n) < 0.0001) return `${n.toExponential(2)} ${symbol}`;
  if (Math.abs(n) < 1) return `${n.toFixed(4)} ${symbol}`;
  if (Math.abs(n) < 1000) return `${n.toFixed(3)} ${symbol}`;
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${symbol}`;
}

export function formatEthAxis(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n) < 0.01) return n.toFixed(4);
  if (Math.abs(n) < 10) return n.toFixed(2);
  return n.toFixed(1);
}
