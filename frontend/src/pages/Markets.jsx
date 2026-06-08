import { useEffect, useRef, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useWatchlist } from '../hooks/useWatchlist';
import { api } from '../lib/api';
import { SignalPill } from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import TradeModal from '../components/wallet/TradeModal';

const RANGE_MAP = { '7D': 7, '30D': 30, '90D': 90, '1Y': 365, 'ALL': 1825 };
const RANGES = ['7D', '30D', '90D', '1Y', 'ALL'];

function fmt(n, dec = 2) {
  return Number(n ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

function StatCard({ label, children }) {
  return (
    <div className="bg-bg-surface border border-border-default rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">{label}</div>
      {children}
    </div>
  );
}

function ChangeChip({ value }) {
  if (value == null) return null;
  const up = value >= 0;
  return (
    <span className={`text-[12px] font-mono font-medium ${up ? 'text-green' : 'text-red'}`}>
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(2)}%
    </span>
  );
}

/* ── Token detail panel ─────────────────────────── */
function TokenPanel({ token, onClose, onTrade }) {
  const [miniChart, setMiniChart] = useState(null);

  useEffect(() => {
    if (!token) return;
    api.getTokenChart(token.id, 7).then((d) => {
      const pts = d?.prices?.map(([ts, price]) => ({
        price: Math.round(price * 100) / 100,
        ts,
      })) || [];
      setMiniChart(pts);
    }).catch(() => {});
  }, [token?.id]);

  if (!token) return null;

  const change24h = token.price_change_percentage_24h ?? 0;
  const changeColor = change24h >= 0 ? '#00D992' : '#FF4D4D';

  return (
    <aside className="w-[320px] flex-shrink-0 h-full bg-bg-surface border-l border-border-subtle flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
        <div className="flex items-center gap-3">
          <img src={token.image} alt={token.symbol} className="w-8 h-8 rounded-full" />
          <div>
            <div className="font-display text-[15px] font-bold text-text-primary">{token.name}</div>
            <div className="text-[10px] text-text-muted font-mono uppercase">{token.symbol}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-lg hover:bg-bg-elevated flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="px-5 py-4 border-b border-border-subtle">
        <div className="font-display text-[28px] font-bold text-text-primary">
          ${fmt(token.current_price, token.current_price > 1 ? 2 : 6)}
        </div>
        <ChangeChip value={change24h} />
      </div>

      {/* Mini 7d chart */}
      <div className="px-3 py-2">
        {miniChart ? (
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={miniChart} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="tkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={changeColor} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={changeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="price" stroke={changeColor} strokeWidth={1.5}
                fill="url(#tkGrad)" dot={false} />
              <Tooltip
                contentStyle={{ background: '#141418', border: '1px solid #28283A', borderRadius: '6px', padding: '6px 10px' }}
                itemStyle={{ color: '#EEEDF0', fontSize: '11px', fontFamily: 'IBM Plex Mono' }}
                formatter={(v) => [`$${fmt(v, 2)}`, '7d price']}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[120px] flex items-center justify-center">
            <Spinner size="sm" />
          </div>
        )}
      </div>

      <div className="px-5 py-3 grid grid-cols-2 gap-3 border-t border-border-subtle">
        {[
          { label: 'Market Cap', value: `$${(token.market_cap / 1e9).toFixed(2)}B` },
          { label: '24h Volume', value: `$${(token.total_volume / 1e9).toFixed(2)}B` },
          { label: 'Rank', value: `#${token.market_cap_rank}` },
          { label: '7d Change', value: `${(token.price_change_percentage_7d_in_currency ?? 0).toFixed(2)}%`, colored: true, val: token.price_change_percentage_7d_in_currency },
        ].map(({ label, value, colored, val }) => (
          <div key={label} className="bg-bg-elevated rounded-lg p-2.5">
            <div className="text-[10px] uppercase text-text-muted mb-0.5">{label}</div>
            <div className={`text-[12px] font-mono ${colored ? (val >= 0 ? 'text-green' : 'text-red') : 'text-text-secondary'}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="px-5 py-4 mt-auto border-t border-border-subtle">
        <button
          type="button"
          onClick={() => onTrade(token)}
          className="w-full bg-green text-bg-base font-semibold text-[13px] py-2.5 rounded-lg hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          ⚡ Trade {token.symbol.toUpperCase()}
        </button>
      </div>
    </aside>
  );
}

/* ── Main page ──────────────────────────────────── */
export default function MarketsPage() {
  const { wallets } = useWatchlist();
  const [ethData, setEthData] = useState(null);
  const [ethChart, setEthChart] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [chartDays, setChartDays] = useState(365);
  const [loading, setLoading] = useState(true);
  const [selectedToken, setSelectedToken] = useState(null);
  const [tradeToken, setTradeToken] = useState(null);
  const [tradeOpen, setTradeOpen] = useState(false);

  useEffect(() => { document.title = 'Markets — Sentinel AI'; }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getEthPrice(),
      api.getEthChart(chartDays),
      api.getTopEthTokens(),
    ]).then(([price, chart, tks]) => {
      setEthData(price.ethereum);
      setEthChart(chart);
      setTokens(Array.isArray(tks) ? tks : []);
      setLoading(false);
    }).catch((err) => {
      console.error('Markets data error:', err);
      setLoading(false);
    });
  }, [chartDays]);

  // Refresh ETH price every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      api.getEthPrice().then((d) => setEthData(d.ethereum)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close token panel on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setSelectedToken(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Whale sentiment from live watchlist
  const bullish = wallets.filter((w) => w.signal === 'BULLISH').length;
  const bearish = wallets.filter((w) => w.signal === 'BEARISH').length;
  const total = bullish + bearish;
  const sentiment = total === 0 ? 'NEUTRAL'
    : bullish / total > 0.6 ? 'BULLISH'
    : bearish / total > 0.6 ? 'BEARISH'
    : 'NEUTRAL';

  const change24h = ethData?.usd_24h_change ?? 0;

  // Chart data
  const chartData = ethChart?.prices?.map(([ts, price]) => ({
    date: new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    price: Math.round(price * 100) / 100,
    ts,
  })) || [];

  // 24h volume from last chart point
  const vol24h = ethChart?.total_volumes?.slice(-1)[0]?.[1];

  const handleTrade = (token) => {
    setTradeToken(token);
    setTradeOpen(true);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-3 text-text-muted text-[13px]">
          <Spinner size="md" /> Loading market data...
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-5 flex flex-col gap-5">

          {/* Row 1 — ETH hero stats */}
          <div className="grid grid-cols-4 gap-3">
            <StatCard label="ETH Price">
              <div className="font-display text-[28px] font-bold text-text-primary leading-none">
                ${fmt(ethData?.usd)}
              </div>
              <div className="mt-1">
                <ChangeChip value={change24h} />
              </div>
            </StatCard>

            <StatCard label="Market Cap">
              <div className="font-display text-[28px] font-bold text-text-primary leading-none">
                ${((ethData?.usd_market_cap ?? 0) / 1e9).toFixed(1)}B
              </div>
              <div className="text-[12px] text-text-muted mt-1">Rank #2</div>
            </StatCard>

            <StatCard label="24H Volume">
              <div className="font-display text-[28px] font-bold text-text-primary leading-none">
                {vol24h ? `$${(vol24h / 1e9).toFixed(1)}B` : '—'}
              </div>
              <div className="text-[12px] text-text-muted mt-1">rolling 24h</div>
            </StatCard>

            <StatCard label="Whale Sentiment">
              <div className="mt-1">
                <SignalPill signal={sentiment} />
              </div>
              <div className="text-[11px] text-text-muted mt-2">
                {bullish} bull · {bearish} bear of {total} signals
              </div>
            </StatCard>
          </div>

          {/* Row 2 — ETH price chart */}
          <div className="bg-bg-surface border border-border-default rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="font-display font-bold text-[16px] text-text-primary">ETH / USD</span>
                <span className="font-mono text-[14px] text-green">${fmt(ethData?.usd)}</span>
              </div>
              <div className="flex gap-1">
                {RANGES.map((range) => {
                  const days = RANGE_MAP[range];
                  return (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setChartDays(days)}
                      className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                        chartDays === days
                          ? 'bg-bg-elevated border-border-strong text-text-primary'
                          : 'border-border-subtle text-text-muted hover:text-text-secondary'
                      }`}
                    >
                      {range}
                    </button>
                  );
                })}
              </div>
            </div>

            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="ethGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00D992" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#00D992" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E1E26" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#4A4A5E', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                  tickLine={false} axisLine={false}
                  interval={Math.max(1, Math.floor(chartData.length / 6))}
                />
                <YAxis
                  tick={{ fill: '#4A4A5E', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                  tickLine={false} axisLine={false}
                  tickFormatter={(v) => `$${v.toLocaleString()}`}
                  domain={['auto', 'auto']}
                  width={70}
                />
                <Tooltip
                  contentStyle={{ background: '#141418', border: '1px solid #28283A', borderRadius: '8px', padding: '8px 12px' }}
                  labelStyle={{ color: '#8B8A9B', fontSize: '11px', marginBottom: '4px' }}
                  itemStyle={{ color: '#EEEDF0', fontSize: '13px', fontFamily: 'IBM Plex Mono', fontWeight: 600 }}
                  formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Price']}
                />
                <Area type="monotone" dataKey="price" stroke="#00D992" strokeWidth={1.5}
                  fill="url(#ethGrad)" dot={false} activeDot={{ r: 4, fill: '#00D992' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Row 3 — Top ETH ecosystem tokens */}
          <div className="bg-bg-surface border border-border-default rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between">
              <span className="font-display text-[14px] font-medium text-text-primary">Top ETH Ecosystem Tokens</span>
              <span className="text-[10px] text-text-muted">Powered by CoinGecko</span>
            </div>

            {/* Table header */}
            <div
              className="grid px-5 py-2.5 bg-bg-overlay border-b border-border-subtle text-[10px] uppercase tracking-widest text-text-muted"
              style={{ gridTemplateColumns: '36px 1fr 120px 100px 100px 120px 140px' }}
            >
              <div>#</div>
              <div>Token</div>
              <div className="text-right">Price</div>
              <div className="text-right">24h</div>
              <div className="text-right">7d</div>
              <div className="text-right">Mkt Cap</div>
              <div className="text-right">Volume 24h</div>
            </div>

            {tokens.map((token, i) => {
              const c24 = token.price_change_percentage_24h ?? 0;
              const c7d = token.price_change_percentage_7d_in_currency ?? 0;
              const volPct = tokens[0]?.total_volume
                ? Math.min((token.total_volume / tokens[0].total_volume) * 100, 100)
                : 0;

              return (
                <div
                  key={token.id}
                  onClick={() => setSelectedToken(selectedToken?.id === token.id ? null : token)}
                  className={`grid px-5 py-3.5 border-b border-border-subtle last:border-0 hover:bg-bg-elevated transition-colors cursor-pointer items-center ${
                    selectedToken?.id === token.id ? 'bg-bg-elevated border-l-2 border-l-green' : ''
                  }`}
                  style={{ gridTemplateColumns: '36px 1fr 120px 100px 100px 120px 140px' }}
                >
                  <span className="text-[11px] text-text-muted font-mono">{i + 1}</span>

                  <div className="flex items-center gap-3">
                    <img src={token.image} alt={token.symbol} className="w-7 h-7 rounded-full" />
                    <div>
                      <div className="text-[13px] font-medium text-text-primary">{token.name}</div>
                      <div className="text-[10px] text-text-muted font-mono uppercase">{token.symbol}</div>
                    </div>
                  </div>

                  <span className="font-mono text-[13px] text-text-primary text-right">
                    ${fmt(token.current_price, token.current_price > 1 ? 2 : 6)}
                  </span>

                  <span className={`font-mono text-[12px] text-right font-medium ${c24 >= 0 ? 'text-green' : 'text-red'}`}>
                    {c24 >= 0 ? '+' : ''}{c24.toFixed(2)}%
                  </span>

                  <span className={`font-mono text-[12px] text-right font-medium ${c7d >= 0 ? 'text-green' : 'text-red'}`}>
                    {c7d >= 0 ? '+' : ''}{c7d.toFixed(2)}%
                  </span>

                  <span className="font-mono text-[12px] text-text-secondary text-right">
                    ${(token.market_cap / 1e9).toFixed(2)}B
                  </span>

                  <div className="flex items-center gap-2 justify-end">
                    <div className="flex-1 h-[2px] bg-bg-overlay rounded-full max-w-[60px]">
                      <div className="h-full rounded-full" style={{ width: `${volPct}%`, background: 'rgba(99,126,234,0.5)' }} />
                    </div>
                    <span className="font-mono text-[11px] text-text-muted">
                      ${(token.total_volume / 1e9).toFixed(2)}B
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Token detail panel */}
      {selectedToken && (
        <TokenPanel
          token={selectedToken}
          onClose={() => setSelectedToken(null)}
          onTrade={handleTrade}
        />
      )}

      <TradeModal
        isOpen={tradeOpen}
        onClose={() => setTradeOpen(false)}
        defaultToken={tradeToken}
        ethPrice={ethData?.usd}
      />
    </div>
  );
}

/* ── EthPriceBadge — used in App.jsx topbar ──── */
export function EthPriceBadge() {
  const [ethData, setEthData] = useState(null);

  useEffect(() => {
    api.getEthPrice().then((d) => setEthData(d.ethereum)).catch(() => {});
    const iv = setInterval(() => {
      api.getEthPrice().then((d) => setEthData(d.ethereum)).catch(() => {});
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  if (!ethData) return null;
  const change = ethData.usd_24h_change ?? 0;

  return (
    <div className="flex items-center gap-2 bg-bg-surface border border-border-default rounded-lg px-3 py-1.5">
      <img
        src="https://assets.coingecko.com/coins/images/279/small/ethereum.png"
        alt="ETH"
        className="w-4 h-4"
      />
      <span className="font-mono font-bold text-[14px] text-text-primary">
        ${Number(ethData.usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <span className={`text-[11px] font-mono ${change >= 0 ? 'text-green' : 'text-red'}`}>
        {change >= 0 ? '+' : ''}{change.toFixed(2)}%
      </span>
    </div>
  );
}
