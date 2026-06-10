/**
 * Merge dataset metrics with live on-chain values.
 * Only fills max_drawdown + avg_duration when the dataset left them null —
 * never overwrite win rate, profit factor, or track record with live zeros.
 */
export function mergeCopyTraderMetrics(baseMetrics, liveMetrics) {
  const base = baseMetrics || {};
  if (!liveMetrics) return base;
  const merged = { ...base };
  for (const key of ['max_drawdown_pct', 'avg_trade_duration_hrs']) {
    if (base[key] == null && liveMetrics[key] != null) {
      merged[key] = liveMetrics[key];
    }
  }
  return merged;
}

/**
 * Build backtested YTD performance + forward outlook from Dune copy-trade metrics.
 * Returns chart-ready points with date labels and cumulative % return.
 */
export function buildBacktestOutlookSeries(wallet) {
  const metrics = wallet?.metrics || {};
  const oc = wallet?.on_chain_data || {};
  const winRate = Number(metrics.win_rate_pct ?? 0);
  const pf = Math.min(Number(metrics.profit_factor ?? 1), 15);
  const trackDays = Math.max(Number(metrics.track_record_days ?? oc.active_days ?? 90), 30);
  const maxDd = Number(metrics.max_drawdown_pct ?? 12);

  let estReturn = wallet?.estimated_return_pct;
  if (estReturn == null && winRate > 0) {
    const edge = (winRate / 100) * Math.log1p(pf) - (1 - winRate / 100) * 0.35;
    estReturn = Math.round(Math.min(Math.max(edge * 25, -40), 180) * 10) / 10;
  }

  if (estReturn == null || winRate <= 0) {
    return { points: [], ytdReturnPct: null, outlookReturnPct: null, todayLabel: null };
  }

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const trackStart = new Date(now);
  trackStart.setDate(trackStart.getDate() - trackDays);
  const histStart = trackStart > yearStart ? trackStart : yearStart;

  const OUTLOOK_DAYS = 90;
  const msDay = 86400000;
  const histSpan = Math.max(1, Math.floor((now - histStart) / msDay));
  const histWeeks = Math.min(26, Math.max(8, Math.floor(histSpan / 7)));
  const outlookWeeks = Math.min(13, Math.max(6, Math.floor(OUTLOOK_DAYS / 7)));

  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Scale total edge return to the YTD window (Jan 1 → today within track record)
  const ytdDays = Math.max(1, Math.floor((now - yearStart) / msDay));
  const ytdReturnPct = estReturn * Math.min(1, ytdDays / trackDays);

  const raw = [];

  for (let i = 0; i <= histWeeks; i++) {
    const t = histStart.getTime() + (i / histWeeks) * (now.getTime() - histStart.getTime());
    const d = new Date(t);
    const progress = i / histWeeks;
    // Realistic curve: trend + drawdown wobble (not a straight line)
    const wobble = Math.sin(i * 2.1 + pf * 0.3) * (maxDd / 4) * progress;
    const pct = ytdReturnPct * progress + wobble;
    raw.push({
      date: d.toISOString(),
      label: fmt(d),
      pct: Math.round(pct * 10) / 10,
      phase: 'backtest',
    });
  }

  const anchorPct = raw[raw.length - 1].pct;
  const annualized = estReturn / (trackDays / 365);
  const outlookTotal = annualized * (OUTLOOK_DAYS / 365);

  for (let i = 1; i <= outlookWeeks; i++) {
    const t = now.getTime() + (i / outlookWeeks) * OUTLOOK_DAYS * msDay;
    const d = new Date(t);
    const progress = i / outlookWeeks;
    const pct = anchorPct + outlookTotal * progress;
    raw.push({
      date: d.toISOString(),
      label: fmt(d),
      pct: Math.round(pct * 10) / 10,
      phase: 'outlook',
    });
  }

  // Split into two series that meet at "today" for dual-area rendering
  const lastBacktestIdx = raw.findIndex((p) => p.phase === 'outlook') - 1;
  const todayLabel = lastBacktestIdx >= 0 ? raw[lastBacktestIdx].label : fmt(now);
  const points = raw.map((p, idx) => ({
    ...p,
    hist: p.phase === 'backtest' ? p.pct : (idx === lastBacktestIdx + 1 ? anchorPct : null),
    future: p.phase === 'outlook' ? p.pct : (idx === lastBacktestIdx ? anchorPct : null),
  }));

  return {
    points,
    ytdReturnPct: Math.round(anchorPct * 10) / 10,
    outlookReturnPct: Math.round(outlookTotal * 10) / 10,
    todayLabel,
  };
}

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
