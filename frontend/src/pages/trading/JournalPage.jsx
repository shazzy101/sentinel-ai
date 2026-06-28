import { useEffect, useState } from 'react';
import { useTradingData } from '@/hooks/useTradingData';

const RULES = [
  'Only take signals with ≥2 confluences (min_confluences).',
  'Risk 2% of capital per trade — never more.',
  'Stop trading for the day if down 5% (daily drawdown guard).',
  'Max 3 new positions per day.',
  'ATR-based SL (1.5×) and TP (3.0×). No moving stops.',
  'Collect 30 days of paper data before risking real capital.',
  'Go live ONLY if the edge is distributed, not one-trade-luck.',
];

const TARGET_WIN_RATE = 50;

export default function JournalPage() {
  const { data } = useTradingData('/api/trading/portfolio', { intervalMs: 60000 });
  const [notes, setNotes] = useState('');

  useEffect(() => { setNotes(localStorage.getItem('apex_journal') || ''); }, []);
  useEffect(() => {
    const t = setTimeout(() => localStorage.setItem('apex_journal', notes), 400);
    return () => clearTimeout(t);
  }, [notes]);

  const wr = data?.stats?.win_rate;
  const trades = data?.stats?.total_trades ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Journal</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="mb-2 text-sm font-semibold">Trading Rules</div>
          <ul className="space-y-1.5 text-sm text-text-secondary">
            {RULES.map((r, i) => <li key={i} className="flex gap-2"><span className="text-emerald-400">✓</span>{r}</li>)}
          </ul>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="mb-2 text-sm font-semibold">30-Day Collection Progress</div>
          <div className="text-sm text-text-muted">Closed trades collected: <span className="font-semibold text-text-primary">{trades}</span></div>
          <div className="mt-3 text-sm">
            Rolling win rate vs {TARGET_WIN_RATE}% target:{' '}
            <span className={wr >= TARGET_WIN_RATE ? 'text-emerald-400' : 'text-amber-400'}>
              {wr != null ? `${wr.toFixed(0)}%` : '—'}
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (wr || 0))}%` }} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="mb-2 text-sm font-semibold">Notes (saved locally)</div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={6}
                  placeholder="Observations, adjustments, what the data is telling you…"
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm outline-none" />
      </div>
    </div>
  );
}
