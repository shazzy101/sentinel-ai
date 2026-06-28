import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine,
} from 'recharts';

export default function EquityChart({ equity = [], startingCapital = 10000, height = 280 }) {
  const data = equity.map((p, i) => ({ i, equity: Math.round(p.equity) }));
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-text-muted">
        No equity history yet — signals will populate this curve.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="i" hide />
        <YAxis domain={['auto', 'auto']} width={56} tick={{ fontSize: 11, fill: '#7a8194' }}
               tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
        <ReferenceLine y={startingCapital} stroke="#7a8194" strokeDasharray="4 4" />
        <Tooltip
          contentStyle={{ background: '#0b0e1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
          labelFormatter={() => ''} formatter={(v) => [`$${v.toLocaleString()}`, 'Equity']}
        />
        <Area type="monotone" dataKey="equity" stroke="#34d399" strokeWidth={2} fill="url(#eq)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
