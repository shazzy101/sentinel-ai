import {
  Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
} from 'recharts';
import { useTradingData } from '@/hooks/useTradingData';
import { ErrorState } from '@/components/primitives/DataState';

function confluenceBuckets(signals) {
  // win rate vs number of confluences (votes) — the core thesis
  const buckets = {};
  for (const s of signals) {
    if (!['WIN', 'LOSS'].includes(s.status)) continue;
    const key = s.votes >= 5 ? '5+' : String(s.votes);
    buckets[key] = buckets[key] || { votes: key, total: 0, wins: 0 };
    buckets[key].total += 1;
    if (s.status === 'WIN') buckets[key].wins += 1;
  }
  return ['1', '2', '3', '4', '5+']
    .filter((k) => buckets[k])
    .map((k) => ({ votes: k, winRate: Math.round((buckets[k].wins / buckets[k].total) * 100), n: buckets[k].total }));
}

export default function StrategiesPage() {
  const { data: pf, error, refresh } = useTradingData('/api/trading/portfolio', { intervalMs: 60000 });
  const { data: sig } = useTradingData('/api/trading/signals?limit=200', { intervalMs: 60000 });
  const breakdown = pf?.strategy_breakdown || [];
  const conf = confluenceBuckets(sig?.signals || []);

  if (error && !pf) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Strategies</h1>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="mb-1 text-sm font-semibold">Confluence Analysis</div>
        <p className="mb-3 text-xs text-text-muted">
          The thesis: more strategies agreeing → higher win rate. This chart proves or disproves it.
        </p>
        {conf.length === 0 ? (
          <div className="py-8 text-center text-sm text-text-muted">Not enough closed signals yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={conf}>
              <XAxis dataKey="votes" tick={{ fontSize: 12, fill: '#7a8194' }}
                     label={{ value: 'confluences', position: 'insideBottom', offset: -2, fill: '#7a8194', fontSize: 11 }} />
              <YAxis domain={[0, 100]} width={40} tick={{ fontSize: 11, fill: '#7a8194' }} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ background: '#0b0e1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                       formatter={(v, _n, p) => [`${v}% (${p.payload.n} trades)`, 'Win rate']} />
              <Bar dataKey="winRate" radius={[4, 4, 0, 0]}>
                {conf.map((d, i) => <Cell key={i} fill={d.winRate >= 50 ? '#34d399' : '#f59e0b'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {breakdown.length === 0 ? (
          <div className="text-sm text-text-muted">No strategy data yet.</div>
        ) : breakdown.map((b) => (
          <div key={b.strategy} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="font-semibold">{b.strategy}</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-text-muted">Win rate </span><span className="tabular-nums">{b.win_rate.toFixed(0)}%</span></div>
              <div><span className="text-text-muted">Signals </span><span className="tabular-nums">{b.signals}</span></div>
              <div><span className="text-text-muted">Avg P&L </span><span className="tabular-nums">{b.avg_pnl_pct.toFixed(2)}%</span></div>
              <div><span className="text-text-muted">Best </span><span>{b.best_asset || '—'}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
