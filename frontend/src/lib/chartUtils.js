/**
 * Reconstruct wallet ETH balance history from transaction array.
 * Walks backwards from current balance, reversing each tx.
 */
export function buildBalanceSparkline(transactions, currentBalance) {
  if (!transactions?.length) return [];

  const sorted = [...transactions].sort(
    (a, b) => (a.timestamp_unix || 0) - (b.timestamp_unix || 0)
  );

  let balance = Number(currentBalance) || 0;
  const points = [{ balance, index: sorted.length }];

  for (let i = sorted.length - 1; i >= 0; i--) {
    const tx = sorted[i];
    const val = parseFloat(tx.value || 0);
    if (tx.direction === 'in') {
      balance = balance - val;
    } else {
      balance = balance + val;
    }
    balance = Math.max(0, balance);
    points.unshift({ balance, index: i });
  }

  return points;
}

/**
 * Format large USD numbers: 1234567 → "$1.23M"
 */
export function formatUsd(value) {
  if (!value && value !== 0) return '—';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}
