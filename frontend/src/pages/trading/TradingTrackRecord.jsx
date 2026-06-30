import { useEffect } from 'react';
import { useTradingData } from '@/hooks/useTradingData';
import { SkeletonBlock, ErrorState } from '@/components/primitives/DataState';
import EdgeQualityBadge from '@/components/trading/EdgeQualityBadge';
import EquityChart from '@/components/trading/EquityChart';
import KpiCard from '@/components/trading/KpiCard';
import WaitlistForm from '@/components/trading/WaitlistForm';

function useSeo(stats) {
  useEffect(() => {
    const prevTitle = document.title;
    const wr = stats ? `${stats.win_rate.toFixed(0)}% win rate` : 'Live paper track record';
    document.title = `APEX Trading — ${wr} | Hadaleum`;
    const desc = stats
      ? `APEX paper-trading: ${stats.win_rate.toFixed(0)}% win rate, ${stats.total_trades} trades, ${stats.total_return_pct >= 0 ? '+' : ''}${stats.total_return_pct.toFixed(1)}% return. Edge-quality verified — no one-trade-luck.`
      : 'Live, honest paper-trading track record with edge-quality verification.';
    let m = document.querySelector('meta[name="description"]');
    const prevDesc = m?.getAttribute('content');
    if (m) m.setAttribute('content', desc);
    return () => { document.title = prevTitle; if (m && prevDesc) m.setAttribute('content', prevDesc); };
  }, [stats]);
}

export default function TradingTrackRecord() {
  const { data, loading, error, refresh } = useTradingData('/api/trading/portfolio', { intervalMs: 60000 });
  const stats = data?.stats;
  const edge = data?.edge_quality;
  const breakdown = data?.strategy_breakdown || [];
  useSeo(stats);

  if (loading && !data) return <SkeletonBlock rows={8} className="max-w-4xl" />;
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wide text-amber-400">Paper Trading · Live Track Record</div>
        <h1 className="mt-1 text-3xl font-bold">
          {stats ? `${stats.win_rate.toFixed(0)}% win rate` : 'Track Record'}
          {stats && (
            <span className={stats.total_return_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {' '}· {stats.total_return_pct >= 0 ? '+' : ''}{stats.total_return_pct.toFixed(1)}%
            </span>
          )}
        </h1>
      </div>

      {/* Honesty front and center — distributed edge or not */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="mb-2 text-sm font-semibold">Edge Quality</div>
        {edge ? (
          <div className="space-y-3">
            <EdgeQualityBadge edge={edge} size="lg" />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <KpiCard label="Profit Concentration" value={`${edge.profit_concentration}%`} sub="from single best trade" tone={edge.distributed_edge ? 'good' : 'bad'} />
              <KpiCard label="Return ex-best trade" value={`${edge.return_ex_max_win}%`} sub="remove the lucky catch" />
              <KpiCard label="Consistency" value={`${edge.consistency_score}/100`} />
            </div>
            <p className="text-xs text-text-muted">
              A real edge survives removing its single best trade. We show this on purpose — a track record
              that hides one-trade-luck isn't worth trusting.
            </p>
          </div>
        ) : (
          <div className="text-sm text-text-muted">No closed trades yet.</div>
        )}
      </div>

      <WaitlistForm />

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Total Trades" value={stats?.total_trades ?? '—'} />
        <KpiCard label="Profit Factor" value={stats ? stats.profit_factor.toFixed(2) : '—'} />
        <KpiCard label="Sharpe" value={stats ? stats.sharpe.toFixed(2) : '—'} />
        <KpiCard label="Max Drawdown" value={stats ? `${stats.max_drawdown.toFixed(1)}%` : '—'} tone="bad" />
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="mb-2 text-sm font-semibold">Equity Curve</div>
        <EquityChart equity={data?.equity || []} startingCapital={data?.starting_capital || 10000} />
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="mb-3 text-sm font-semibold">Per-Strategy Breakdown</div>
        {breakdown.length === 0 ? (
          <div className="text-sm text-text-muted">No data yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-text-muted">
              <tr><th className="py-1">Strategy</th><th>Signals</th><th>Win %</th><th>Avg P&L</th><th>Best Asset</th></tr>
            </thead>
            <tbody>
              {breakdown.map((b) => (
                <tr key={b.strategy} className="border-t border-white/[0.04]">
                  <td className="py-1.5 font-medium">{b.strategy}</td>
                  <td className="tabular-nums">{b.signals}</td>
                  <td className="tabular-nums">{b.win_rate.toFixed(0)}%</td>
                  <td className="tabular-nums">{b.avg_pnl_pct.toFixed(2)}%</td>
                  <td className="text-text-muted">{b.best_asset || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
