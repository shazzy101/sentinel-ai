import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import AnimatedCounter from '@/components/primitives/AnimatedCounter';
import { CardSkeleton, ErrorState, EmptyState } from '@/components/primitives/DataState';
import SignalCard from '@/components/signals/SignalCard';
import SignalHistoryTable from '@/components/signals/SignalHistoryTable';
import { useSignals } from '@/hooks/useSignals';
import { apiFetch } from '@/lib/apiClient';

/* ─── DashboardTopBar ────────────────────────────────────── */

/**
 * DashboardTopBar — presentational top bar showing aggregate track-record stats.
 * Purely driven by props; unit-testable with no hooks.
 */
export function DashboardTopBar({ wins = 0, losses = 0, winRate = 0, avgReturn = 0, loading = false }) {
  const stats = [
    {
      label: 'Wins',
      value: wins,
      decimals: 0,
      prefix: '',
      suffix: '',
      className: 'text-signal',
      testId: 'stat-wins',
    },
    {
      label: 'Losses',
      value: losses,
      decimals: 0,
      prefix: '',
      suffix: '',
      className: 'text-loss',
      testId: 'stat-losses',
    },
    {
      label: 'Win Rate',
      value: winRate,
      decimals: 1,
      prefix: '',
      suffix: '%',
      className: 'text-text-primary',
      testId: 'stat-win-rate',
    },
    {
      label: 'Avg Return',
      value: avgReturn,
      decimals: 1,
      prefix: avgReturn >= 0 ? '+' : '',
      suffix: '%',
      className: avgReturn >= 0 ? 'text-signal' : 'text-loss',
      testId: 'stat-avg-return',
    },
  ];

  return (
    <div
      className="border-b border-border-subtle bg-bg-surface py-3 px-5 flex items-center gap-6 flex-wrap"
      data-testid="dashboard-top-bar"
    >
      {stats.map(({ label, value, decimals, prefix, suffix, className, testId }, i, arr) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className="text-[10px] text-text-muted uppercase tracking-wider">{label}</span>
          {loading ? (
            <span className="h-3 w-10 rounded animate-pulse bg-white/[0.06] inline-block" />
          ) : (
            <AnimatedCounter
              value={value}
              decimals={decimals}
              prefix={prefix}
              suffix={suffix}
              className={cn('text-[13px] font-mono font-semibold', className)}
              data-testid={testId}
            />
          )}
          {i < arr.length - 1 && <span className="text-text-muted ml-3">·</span>}
        </div>
      ))}
    </div>
  );
}

/* ─── Signal feed skeletons ──────────────────────────────── */
function FeedSkeletons({ count = 3 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/* ─── useTrackRecord ─────────────────────────────────────── */
function useTrackRecord() {
  const [data, setData] = useState({ wins: 0, losses: 0, winRate: 0, avgReturn: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Primary: dedicated track-record endpoint (future)
        const body = await apiFetch('/api/track-record', { timeoutMs: 8000 });
        const d = body.data ?? body;
        if (!cancelled) {
          setData({
            wins: d.wins ?? d.total_wins ?? 0,
            losses: d.losses ?? d.total_losses ?? 0,
            winRate: d.win_rate ?? d.winRate ?? 0,
            avgReturn: d.avg_return ?? d.avgReturn ?? 0,
          });
        }
      } catch {
        // Fallback: trust-pulse marketing endpoint
        try {
          const body = await apiFetch('/api/trust-pulse/marketing', { timeoutMs: 8000 });
          const d = body.data ?? body;
          if (!cancelled) {
            setData({
              wins: d.wins ?? d.total_wins ?? 0,
              losses: d.losses ?? d.total_losses ?? 0,
              winRate: d.win_rate ?? d.winRate ?? 0,
              avgReturn: d.avg_return ?? d.avgReturn ?? 0,
            });
          }
        } catch {
          // Silently fall back to zeros — top bar still renders
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { ...data, loading };
}

/* ─── Dashboard page ─────────────────────────────────────── */
export default function Dashboard() {
  const { signals, loading: signalsLoading, error: signalsError } = useSignals();
  const trackRecord = useTrackRecord();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.title = 'Dashboard — Hadaleum';
  }, []);

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      {/* Top bar */}
      <DashboardTopBar
        wins={trackRecord.wins}
        losses={trackRecord.losses}
        winRate={trackRecord.winRate}
        avgReturn={trackRecord.avgReturn}
        loading={trackRecord.loading}
      />

      <div className="max-w-6xl mx-auto px-4 md:px-5 py-6 flex flex-col gap-8">
        {/* Live signal feed */}
        <section aria-label="Live signal feed">
          <h2 className="text-[11px] uppercase tracking-widest text-text-muted mb-3">
            Live signals
          </h2>
          {signalsLoading ? (
            <FeedSkeletons count={3} />
          ) : signalsError ? (
            <ErrorState message={signalsError} />
          ) : signals.length === 0 ? (
            <EmptyState
              title="No signals yet"
              body="New AI signals will appear here when they are generated."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {signals.map((signal) => (
                <SignalCard key={signal.id} signal={signal} />
              ))}
            </div>
          )}
        </section>

        {/* Signal history table */}
        <section aria-label="Signal history">
          <h2 className="text-[11px] uppercase tracking-widest text-text-muted mb-3">
            Signal history
          </h2>
          <div className="rounded-2xl bg-bg-card border border-border-subtle overflow-hidden">
            <SignalHistoryTable signals={signals} loading={signalsLoading} />
          </div>
        </section>
      </div>
    </div>
  );
}
