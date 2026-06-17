import { useState, useEffect } from 'react';
import { apiGet } from '../../lib/apiClient';
import AnimatedCounter from '../primitives/AnimatedCounter';

/* ─── Skeleton bar ─────────────────────────────────────── */
function Skeleton({ className = '' }) {
  return (
    <div
      className={`animate-pulse rounded bg-bg-elevated ${className}`}
      data-testid="stat-skeleton"
      aria-hidden="true"
    />
  );
}

/* ─── Presentational component — accepts props, fully testable ─── */
export function TrackRecordStatsDisplay({ totalSignals, winRate, avgReturn, loading }) {
  const stats = [
    {
      id: 'total-signals',
      value: totalSignals,
      decimals: 0,
      suffix: '',
      label: 'Total Signals',
      sublabel: 'all-time detections',
    },
    {
      id: 'win-rate',
      value: winRate,
      decimals: 1,
      suffix: '%',
      label: 'Win Rate',
      sublabel: 'on scored moves',
    },
    {
      id: 'avg-return',
      value: avgReturn,
      decimals: 1,
      suffix: '%',
      label: 'Avg Win Return',
      sublabel: 'per winning trade',
    },
  ];

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8"
      aria-label="Track record statistics"
      role="region"
    >
      {stats.map(({ id, value, decimals, suffix, label, sublabel }) => (
        <div
          key={id}
          className="flex flex-col items-center sm:items-start gap-1"
          data-testid={`stat-${id}`}
        >
          {loading ? (
            <>
              <Skeleton className="h-9 w-24 mb-1" />
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3 w-28 mt-0.5" />
            </>
          ) : (
            <>
              <span
                className="font-display font-bold text-[36px] md:text-[44px] leading-none text-text-primary font-mono tabular-nums"
                data-testid={`stat-value-${id}`}
              >
                <AnimatedCounter
                  value={value ?? 0}
                  decimals={decimals}
                  suffix={suffix}
                  className="font-mono"
                />
              </span>
              <span className="text-[13px] font-semibold text-text-primary">{label}</span>
              <span className="text-[11px] text-text-muted">{sublabel}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Container: fetches /api/trust-pulse/marketing → display ─── */
export default function TrackRecordStats() {
  const [data, setData] = useState({ totalSignals: null, winRate: null, avgReturn: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const body = await apiGet('/api/trust-pulse/marketing');
        if (cancelled) return;

        const statsAll = body?.stats_all ?? body?.data?.stats_all ?? {};
        setData({
          totalSignals: statsAll.detections ?? null,
          winRate: statsAll.win_rate_pct ?? null,
          avgReturn: statsAll.avg_win_return_pct ?? null,
        });
      } catch {
        // Graceful degradation — show zeros rather than breaking the page
        if (!cancelled) setData({ totalSignals: 0, winRate: 0, avgReturn: 0 });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return <TrackRecordStatsDisplay {...data} loading={loading} />;
}
