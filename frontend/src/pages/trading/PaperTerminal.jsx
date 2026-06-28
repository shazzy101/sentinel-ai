import { useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTradingData } from '@/hooks/useTradingData';

const ASSETS = ['BTC/USD', 'ETH/USD', 'SOL/USD', 'NVDA', 'TSLA', 'AAPL', 'SPY', 'QQQ'];

export default function PaperTerminal() {
  const [asset, setAsset] = useState('BTC/USD');
  const { data } = useTradingData(`/api/trading/prices?asset=${encodeURIComponent(asset)}&timeframe=5m&limit=100`, { intervalMs: 30000 });
  const { data: sigData } = useTradingData(`/api/trading/signals?asset=${encodeURIComponent(asset)}&limit=10`, { intervalMs: 30000 });
  const bars = (data?.bars || []).map((b, i) => ({ i, close: b.close }));
  const signals = sigData?.signals || [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Paper Terminal</h1>
      <div className="flex flex-wrap gap-2">
        {ASSETS.map((a) => (
          <button key={a} onClick={() => setAsset(a)}
                  className={`rounded-lg px-3 py-1.5 text-sm ${a === asset ? 'bg-white/[0.08] text-text-primary' : 'bg-white/[0.02] text-text-muted'}`}>
            {a}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 lg:col-span-2">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold">{asset}</span>
            {bars.length > 0 && <span className="tabular-nums">${bars[bars.length - 1].close.toLocaleString()}</span>}
          </div>
          {bars.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-text-muted">Loading price…</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={bars}>
                <XAxis dataKey="i" hide />
                <YAxis domain={['auto', 'auto']} width={64} tick={{ fontSize: 11, fill: '#7a8194' }} />
                <Tooltip contentStyle={{ background: '#0b0e1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                         labelFormatter={() => ''} formatter={(v) => [`$${v.toLocaleString()}`, asset]} />
                <Line type="monotone" dataKey="close" stroke="#22d3ee" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="mb-3 text-sm font-semibold">Recent signals · {asset}</div>
          {signals.length === 0 ? (
            <div className="text-sm text-text-muted">None yet.</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {signals.map((s) => (
                <li key={s.id} className="rounded-lg bg-white/[0.03] px-3 py-2">
                  <div className="flex justify-between">
                    <span className={s.direction === 'LONG' ? 'text-emerald-400' : 'text-red-400'}>{s.direction}</span>
                    <span className="text-text-muted">{s.status}</span>
                  </div>
                  <div className="mt-1 text-xs text-text-muted">votes {s.votes} · TP {Number(s.tp).toFixed(2)} · SL {Number(s.sl).toFixed(2)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
