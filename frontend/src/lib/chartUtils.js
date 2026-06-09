/**
 * Use backend-computed YTD sparkline (Jan 1 → today) when available.
 */
export function buildYtdSparkline(ytdSparkline) {
  if (!ytdSparkline?.length) return [];
  return ytdSparkline.map((p, i) => ({ balance: p.balance, index: i }));
}

/**
 * Prefer backend YTD series; fall back to full tx reconstruction.
 */
export function resolveSparklineData(wallet) {
  const perf = buildYtdSparkline(wallet?.performance_sparkline);
  if (perf.length >= 2) return perf;
  const ytd = buildYtdSparkline(wallet?.ytd_sparkline);
  if (ytd.length >= 2) return ytd;
  if (wallet?.transactions?.length) {
    return buildBalanceSparkline(wallet.transactions, wallet.balance);
  }
  if (wallet?.ytd_growth_pct != null && wallet?.balance != null) {
    const start = wallet.ytd_start_balance ?? wallet.balance * 0.9;
    return [{ balance: start }, { balance: wallet.balance }];
  }
  if (wallet?.estimated_return_pct != null) {
    const end = 100 + wallet.estimated_return_pct;
    return [{ balance: 100 }, { balance: end }];
  }
  return [];
}

export function sparklineReturnPct(wallet) {
  if (wallet?.estimated_return_pct != null) return wallet.estimated_return_pct;
  return wallet?.ytd_growth_pct ?? null;
}

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
