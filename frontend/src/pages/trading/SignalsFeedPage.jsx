import { useState } from 'react';
import { useTradingData } from '@/hooks/useTradingData';

const STATUSES = ['', 'PENDING', 'WIN', 'LOSS', 'EXPIRED'];

export default function SignalsFeedPage() {
  const [status, setStatus] = useState('');
  const [dir, setDir] = useState('');
  const [hcOnly, setHcOnly] = useState(false);
  const qs = status ? `?status=${status}&limit=200` : '?limit=200';
  const { data, loading } = useTradingData(`/api/trading/signals${qs}`, { intervalMs: 30000 });

  let signals = data?.signals || [];
  if (dir) signals = signals.filter((s) => s.direction === dir);
  if (hcOnly) signals = signals.filter((s) => s.is_high_conviction);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Signals</h1>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5">
          {STATUSES.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
        </select>
        <select value={dir} onChange={(e) => setDir(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5">
          <option value="">All directions</option>
          <option value="LONG">Long</option>
          <option value="SHORT">Short</option>
        </select>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={hcOnly} onChange={(e) => setHcOnly(e.target.checked)} />
          High conviction only
        </label>
        <span className="ml-auto text-text-muted">{signals.length} signals</span>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-text-muted">
            <tr className="border-b border-white/[0.06]">
              <th className="px-4 py-2">Asset</th><th>Dir</th><th>Votes</th><th>Strategies</th>
              <th>RSI</th><th>Status</th><th className="text-right pr-4">P&L</th>
            </tr>
          </thead>
          <tbody>
            {signals.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                {loading ? 'Loading…' : 'No signals match.'}</td></tr>
            ) : signals.map((s) => (
              <tr key={s.id} className="border-t border-white/[0.04]">
                <td className="px-4 py-2 font-medium">{s.asset}</td>
                <td className={s.direction === 'LONG' ? 'text-emerald-400' : 'text-red-400'}>{s.direction}</td>
                <td className="tabular-nums">{s.votes}{s.is_high_conviction ? ' ★' : ''}</td>
                <td className="max-w-[220px] truncate text-text-muted">{(s.strategies || []).join(', ')}</td>
                <td className="tabular-nums">{s.rsi != null ? Number(s.rsi).toFixed(0) : '—'}</td>
                <td className="text-text-muted">{s.status}</td>
                <td className="pr-4 text-right tabular-nums">{s.pnl_pct != null ? `${s.pnl_pct >= 0 ? '+' : ''}${Number(s.pnl_pct).toFixed(2)}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
