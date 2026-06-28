import { useTradingData } from '@/hooks/useTradingData';
import EdgeQualityBadge from '@/components/trading/EdgeQualityBadge';
import EquityChart from '@/components/trading/EquityChart';
import KpiCard from '@/components/trading/KpiCard';

export default function TradingDashboard() {
  const { data, loading, error } = useTradingData('/api/trading/portfolio', { intervalMs: 30000 });
  const { data: sigData } = useTradingData('/api/trading/signals/latest', { intervalMs: 30000 });

  const stats = data?.stats;
  const edge = data?.edge_quality;
  const open = data?.open_positions || [];
  const signals = sigData?.signals || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {edge && <EdgeQualityBadge edge={edge} size="lg" />}
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Total Return" value={stats ? `${stats.total_return_pct >= 0 ? '+' : ''}${stats.total_return_pct.toFixed(2)}%` : '—'}
                 tone={stats?.total_return_pct >= 0 ? 'good' : 'bad'} />
        <KpiCard label="Win Rate" value={stats ? `${stats.win_rate.toFixed(0)}%` : '—'} sub={stats ? `${stats.wins}W / ${stats.losses}L` : ''} />
        <KpiCard label="Max Drawdown" value={stats ? `${stats.max_drawdown.toFixed(1)}%` : '—'} tone="bad" />
        <KpiCard label="Expectancy" value={stats ? `$${stats.expectancy.toFixed(2)}` : '—'} sub="per trade" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 lg:col-span-2">
          <div className="mb-2 text-sm font-semibold">Equity Curve</div>
          <EquityChart equity={data?.equity || []} startingCapital={data?.starting_capital || 10000} />
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="mb-3 text-sm font-semibold">Open Positions ({open.length})</div>
          {open.length === 0 ? (
            <div className="text-sm text-text-muted">{loading ? 'Loading…' : 'No open positions.'}</div>
          ) : (
            <ul className="space-y-2">
              {open.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
                  <span className="font-medium">{p.asset}</span>
                  <span className={p.direction === 'LONG' ? 'text-emerald-400' : 'text-red-400'}>{p.direction}</span>
                  <span className="tabular-nums text-text-muted">
                    {p.unrealized_pct != null ? `${p.unrealized_pct >= 0 ? '+' : ''}${p.unrealized_pct}%` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="mb-3 text-sm font-semibold">Latest Signals</div>
        {signals.length === 0 ? (
          <div className="text-sm text-text-muted">No signals yet — the engine scans every 5 minutes.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-text-muted">
              <tr><th className="py-1">Asset</th><th>Dir</th><th>Votes</th><th>Status</th><th className="text-right">P&L</th></tr>
            </thead>
            <tbody>
              {signals.map((s) => (
                <tr key={s.id} className="border-t border-white/[0.04]">
                  <td className="py-1.5 font-medium">{s.asset}</td>
                  <td className={s.direction === 'LONG' ? 'text-emerald-400' : 'text-red-400'}>{s.direction}</td>
                  <td className="tabular-nums">{s.votes}{s.is_high_conviction ? ' ★' : ''}</td>
                  <td className="text-text-muted">{s.status}</td>
                  <td className="text-right tabular-nums">{s.pnl_pct != null ? `${s.pnl_pct >= 0 ? '+' : ''}${Number(s.pnl_pct).toFixed(2)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
