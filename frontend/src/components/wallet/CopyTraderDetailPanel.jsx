import { useEffect, useMemo, useRef, useState } from 'react';
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts';
import { ExternalLink } from 'lucide-react';
import Spinner from '../ui/Spinner';
import Button from '../ui/Button';
import { TextureCard, TextureCardContent } from '../ui/texture-card';
import { resolveSparklineData, sparklineReturnPct, formatUsd } from '../../lib/chartUtils';
import { api } from '../../lib/api';

const API_BASE = import.meta.env.VITE_API_URL || '';

const METRIC_CARDS = [
  { key: 'win_rate_pct', label: 'Win Rate', fmt: (v) => `${v}%`, good: (v) => v >= 60 },
  { key: 'profit_factor', label: 'Profit Factor', fmt: (v) => Number(v).toFixed(1), good: (v) => v >= 2 },
  { key: 'max_drawdown_pct', label: 'Max Drawdown', fmt: (v) => `${v}%`, good: (v) => v <= 20 },
  { key: 'avg_trade_duration_hrs', label: 'Avg Duration', fmt: (v) => `${Number(v).toFixed(0)}h`, good: (v) => v >= 4 },
  { key: 'track_record_days', label: 'Track Record', fmt: (v) => `${v} days`, good: (v) => v >= 90 },
];

export default function CopyTraderDetailPanel({ wallet, onClose, onTrack, isTracked, isTracking }) {
  const [detail, setDetail] = useState(wallet);
  const scrollRef = useRef(null);
  const m = detail?.metrics || {};
  const oc = detail?.on_chain_data || {};

  // True on-chain YTD (real ETH balance curve) when this address has been
  // scanned. Falls back to the estimated P&L curve only when unavailable.
  const [ytd, setYtd] = useState(null); // { sparkline:[{balance,ts}], pct }

  const estSparkData = useMemo(() => resolveSparklineData(detail), [detail]);
  const estReturnPct = sparklineReturnPct(detail);

  const hasTrueYtd = ytd?.sparkline?.length >= 2;
  const sparkData = hasTrueYtd ? ytd.sparkline : estSparkData;
  const returnPct = hasTrueYtd ? ytd.pct : estReturnPct;
  const up = (returnPct ?? 0) >= 0;
  const trendColor = up ? '#00D992' : '#FF4D4D';

  useEffect(() => {
    setDetail(wallet);
    setYtd(null);
    if (!wallet?.address) return;
    let cancelled = false;
    api.getCopyTrader(wallet.address)
      .then((w) => { if (!cancelled && w) setDetail(w); })
      .catch(() => {});
    // Pull the real on-chain YTD balance curve for this address.
    fetch(`${API_BASE}/api/wallets/${wallet.address}`)
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        const w = body?.data?.wallet;
        const spark = w?.ytd_sparkline;
        if (Array.isArray(spark) && spark.length >= 2) {
          setYtd({ sparkline: spark, pct: w.ytd_growth_pct ?? null });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [wallet?.address]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [wallet?.address]);

  if (!detail) return null;

  return (
    <aside className="w-full h-full min-h-0 bg-bg-surface border-l border-border-subtle flex flex-col shadow-2xl">
      <div className="flex-shrink-0 px-5 py-4 border-b border-border-subtle relative">
        <div className="font-display text-[16px] font-bold text-text-primary pr-10 leading-snug break-words">
          {detail.label || `DEX Trader #${detail.rank}`}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="px-2 py-0.5 rounded bg-green/10 text-green border border-green/20 font-mono">
            Score {detail.copy_trading_score?.toFixed?.(0) ?? detail.copy_trading_score}
          </span>
          <span className="text-text-muted">{oc.trades_per_day?.toFixed(1)} trades/day</span>
          <span className="text-text-muted">·</span>
          <span className="text-text-muted">{formatUsd(oc.avg_trade_usd)} avg swap</span>
        </div>
        <Button variant="icon" className="absolute right-4 top-3" onClick={onClose} aria-label="Close">✕</Button>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-5 py-4 border-b border-border-subtle">
          <a
            href={`https://etherscan.io/address/${detail.address}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[11px] text-blue hover:underline break-all inline-flex items-start gap-1 leading-relaxed"
          >
            {detail.address}
            <ExternalLink className="h-3 w-3 shrink-0 mt-0.5" />
          </a>
        </div>

        <div className="px-5 py-4 border-b border-border-subtle">
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-3">Copy-Trade Quality Metrics</div>
          <div className="grid grid-cols-2 gap-2">
            {METRIC_CARDS.map(({ key, label, fmt, good }) => {
              const val = m[key];
              const isGood = val != null && good(val);
              return (
                <div key={key} className="rounded-xl border border-border-subtle bg-bg-elevated/50 px-3 py-2.5">
                  <div className="text-[9px] uppercase tracking-widest text-text-muted">{label}</div>
                  <div className={`font-mono text-[15px] font-bold mt-0.5 ${
                    val == null ? 'text-text-muted' : isGood ? 'text-green' : 'text-text-primary'
                  }`}>
                    {val != null ? fmt(val) : 'Pending ranker'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {sparkData.length >= 2 && (
          <div className="px-5 py-4 border-b border-border-subtle">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-widest text-text-muted">
                {hasTrueYtd ? 'Year-to-Date · On-chain ETH balance' : 'Estimated P&L Trend'}
              </span>
              {returnPct != null && (
                <span className={`font-mono text-[13px] font-bold ${up ? 'text-green' : 'text-red'}`}>
                  {up ? '+' : ''}{returnPct.toFixed(1)}%{hasTrueYtd ? ' YTD' : ''}
                </span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={sparkData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="copyTraderGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={trendColor} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={trendColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="balance" stroke={trendColor} strokeWidth={1.5} fill="url(#copyTraderGrad)" dot={false} />
                <Tooltip
                  contentStyle={{ background: '#141418', border: '1px solid #28283A', borderRadius: '6px', fontSize: '11px' }}
                  formatter={(v) => [hasTrueYtd ? `${Number(v).toFixed(2)} ETH` : Number(v).toFixed(1), hasTrueYtd ? 'Balance' : 'Index']}
                />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-text-muted mt-2 leading-relaxed">
              {hasTrueYtd
                ? 'Real on-chain ETH balance since Jan 1, reconstructed from this wallet’s transaction history.'
                : 'Curve estimated from win rate, profit factor, and trade volume. Track this wallet to fetch its real on-chain balance history.'}
            </p>
          </div>
        )}

        <div className="px-5 py-4">
          <TextureCard>
            <TextureCardContent className="p-4 space-y-2 text-[12px] text-text-secondary leading-relaxed">
              <div className="text-[10px] uppercase tracking-widest text-text-muted mb-2">On-Chain Activity</div>
              <p><strong className="text-text-primary">{oc.total_trades?.toLocaleString()}</strong> DEX trades across <strong className="text-text-primary">{oc.tokens_traded}</strong> tokens</p>
              <p>{formatUsd(oc.total_volume_usd)} total volume · {oc.dex_count} DEX{oc.dex_count !== 1 ? 'es' : ''}</p>
              <p className="text-[11px] text-text-muted font-mono">
                {oc.first_trade?.slice(0, 10)} → {oc.last_trade?.slice(0, 10)}
              </p>
              <div className="pt-2 border-t border-border-subtle text-[11px] text-text-muted leading-[1.6]">
                This wallet passed Sentinel filters: not an MEV bot (&lt;100 trades/day), has measurable DEX history over 90+ days, win rate above 60%, profit factor above 2.0.
              </div>
            </TextureCardContent>
          </TextureCard>
        </div>
      </div>

      <div className="flex-shrink-0 px-5 py-4 border-t border-border-subtle space-y-2">
        {isTracked ? (
          <div className="text-center py-2 px-3 rounded-xl border border-blue/25 bg-blue/10 text-[12px] text-blue font-medium">
            ✓ On your watchlist — view in My Watchlist tab
          </div>
        ) : (
          <Button
            variant="primary"
            fullWidth
            disabled={isTracking}
            onClick={() => onTrack?.(detail)}
          >
            {isTracking ? <><Spinner size="sm" /> Tracking & analyzing…</> : '+ Track on Watchlist'}
          </Button>
        )}
        <a
          href={`https://etherscan.io/address/${detail.address}`}
          target="_blank"
          rel="noreferrer"
          className="block text-center text-[11px] text-text-muted hover:text-blue"
        >
          View full history on Etherscan →
        </a>
      </div>
    </aside>
  );
}
