import { useTradingData } from '@/hooks/useTradingData';

export default function TradingAdmin() {
  const { data: health } = useTradingData('/api/trading/health', { intervalMs: 15000 });
  const { data: pf } = useTradingData('/api/trading/portfolio', { intervalMs: 30000 });

  const ok = health?.status === 'ok';
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin · Engine Health</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="text-sm font-semibold">Engine</div>
          <div className="mt-2 flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span>{ok ? 'Running (paper)' : 'Unknown'}</span>
          </div>
          <div className="mt-2 text-xs text-text-muted">Market: {health?.market_open ? 'open' : 'closed'}</div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="text-sm font-semibold">Activity</div>
          <div className="mt-2 text-sm text-text-muted">Open positions: <span className="text-text-primary">{health?.open_positions ?? '—'}</span></div>
          <div className="text-sm text-text-muted">Signals today: <span className="text-text-primary">{health?.today_signals ?? '—'}</span></div>
          <div className="text-sm text-text-muted">Last signal: <span className="text-text-primary">{health?.last_signal_at ? new Date(health.last_signal_at).toLocaleString() : '—'}</span></div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="text-sm font-semibold">Capital</div>
          <div className="mt-2 text-2xl font-bold tabular-nums">
            {pf?.current_capital != null ? `$${pf.current_capital.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
          </div>
        </div>
      </div>

      <p className="text-xs text-text-muted">
        Force-run controls + portfolio reset are wired to admin-gated endpoints in Step 27.
        Crons run automatically server-side (signals 5m / monitor 1m).
      </p>
    </div>
  );
}
