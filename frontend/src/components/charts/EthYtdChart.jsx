import { useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, Tooltip, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { api } from '../../lib/api';

function fmtPrice(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function EthYtdChart() {
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.getEthChart(365)
      .then((data) => {
        if (cancelled) return;
        const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
        const pts = (data?.prices || [])
          .filter(([ts]) => ts >= yearStart)
          .map(([ts, price]) => ({
            ts,
            price,
            label: new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          }));
        setPrices(pts);
      })
      .catch(() => { if (!cancelled) setPrices([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const ytdChange = useMemo(() => {
    if (prices.length < 2) return null;
    const start = prices[0].price;
    const end = prices[prices.length - 1].price;
    return start > 0 ? ((end - start) / start) * 100 : 0;
  }, [prices]);

  if (loading) {
    return (
      <div className="bg-bg-surface border border-border-default rounded-xl px-5 py-8 text-center text-[12px] text-text-muted">
        Loading ETH year-to-date chart…
      </div>
    );
  }

  if (prices.length < 2) return null;

  const up = (ytdChange ?? 0) >= 0;
  const color = up ? '#00D992' : '#FF4D4D';

  return (
    <div className="bg-bg-surface border border-border-default rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between">
        <div>
          <span className="font-display text-[14px] font-medium text-text-primary">ETH · Year to Date</span>
          <span className="text-[10px] text-text-muted ml-2">CoinGecko · Jan 1 → today</span>
        </div>
        {ytdChange != null && (
          <span className={`font-mono text-[14px] font-bold ${up ? 'text-green' : 'text-red'}`}>
            {up ? '+' : ''}{ytdChange.toFixed(2)}% YTD
          </span>
        )}
      </div>
      <div className="px-2 py-3" style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={prices} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="ethYtdGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: '#6B6B7B' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fontSize: 9, fill: '#6B6B7B' }}
              axisLine={false}
              tickLine={false}
              width={52}
              tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
            />
            <Area type="monotone" dataKey="price" stroke={color} strokeWidth={1.5} fill="url(#ethYtdGrad)" dot={false} />
            <Tooltip
              contentStyle={{ background: '#141418', border: '1px solid #28283A', borderRadius: '6px', fontSize: '11px' }}
              formatter={(v) => [`$${fmtPrice(v)}`, 'ETH']}
              labelFormatter={(l) => l}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
