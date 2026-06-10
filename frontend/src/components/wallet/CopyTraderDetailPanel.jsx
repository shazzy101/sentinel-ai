import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AreaChart, Area, Tooltip, ResponsiveContainer, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from 'recharts';
import { ExternalLink } from 'lucide-react';
import Spinner from '../ui/Spinner';
import Button from '../ui/Button';
import { TextureCard, TextureCardContent } from '../ui/texture-card';
import { formatUsd, mergeCopyTraderMetrics, buildBacktestOutlookSeries } from '../../lib/chartUtils';
import { api } from '../../lib/api';
import { useEnsName, traderDisplayName } from '../../lib/ens';

const METRIC_CARDS = [
  { key: 'win_rate_pct', label: 'Win Rate', fmt: (v) => `${v}%`, good: (v) => v >= 60 },
  { key: 'profit_factor', label: 'Profit Factor', fmt: (v) => Number(v).toFixed(1), good: (v) => v >= 2 },
  { key: 'max_drawdown_pct', label: 'Max Drawdown', fmt: (v) => `${v}%`, good: (v) => v <= 20 },
  { key: 'avg_trade_duration_hrs', label: 'Avg Duration', fmt: (v) => `${Number(v).toFixed(0)}h`, good: (v) => v >= 4 },
  { key: 'track_record_days', label: 'Track Record', fmt: (v) => `${v} days`, good: (v) => v >= 90 },
];

export default function CopyTraderDetailPanel({ wallet, onClose, onTrack, onUntrack, isTracked, isTracking }) {
  const [detail, setDetail] = useState(wallet);
  const [removing, setRemoving] = useState(false);
  const scrollRef = useRef(null);
  const ensName = useEnsName(detail?.address);

  // Live, on-chain-computed metrics (fills Max Drawdown + Avg Duration that the
  // offline Dune dataset leaves null).
  const [liveMetrics, setLiveMetrics] = useState(null);
  const [liveState, setLiveState] = useState('idle'); // idle | loading | done | unavailable

  const m = useMemo(
    () => mergeCopyTraderMetrics(detail?.metrics, liveMetrics),
    [detail?.metrics, liveMetrics],
  );
  const oc = detail?.on_chain_data || {};

  const outlook = useMemo(() => buildBacktestOutlookSeries({ ...detail, metrics: m }), [detail, m]);
  const chartData = outlook.points;
  const hasChart = chartData.length >= 4;
  const up = (outlook.ytdReturnPct ?? 0) >= 0;

  const needsLiveMetrics =
    (detail?.metrics?.max_drawdown_pct == null || detail?.metrics?.avg_trade_duration_hrs == null);

  useEffect(() => {
    setDetail(wallet);
    setLiveMetrics(null);
    setLiveState('idle');
    if (!wallet?.address) return;
    let cancelled = false;
    api.getCopyTrader(wallet.address)
      .then((w) => { if (!cancelled && w) setDetail(w); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [wallet?.address]);

  // Compute real Max Drawdown + Avg Duration on demand when the dataset is missing them.
  useEffect(() => {
    if (!wallet?.address || !needsLiveMetrics) return;
    let cancelled = false;
    setLiveState('loading');
    api.getCopyTraderMetrics(wallet.address)
      .then((res) => {
        if (cancelled) return;
        if (res?.available && res.metrics) {
          setLiveMetrics(res.metrics);
          setLiveState('done');
        } else {
          setLiveState('unavailable');
        }
      })
      .catch(() => { if (!cancelled) setLiveState('unavailable'); });
    return () => { cancelled = true; };
  }, [wallet?.address, needsLiveMetrics]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [wallet?.address]);

  const handleRemove = async () => {
    if (removing) return;
    setRemoving(true);
    try {
      await api.untrackWallet(detail.address);
      onUntrack?.(detail);
    } finally {
      setRemoving(false);
    }
  };

  if (!detail) return null;

  const displayName = traderDisplayName(detail, ensName);

  return (
    <aside className="w-full h-full min-h-0 bg-bg-surface border-l border-border-subtle flex flex-col shadow-2xl">
      <div className="flex-shrink-0 px-5 py-4 border-b border-border-subtle relative">
        <div className="font-display text-[16px] font-bold text-text-primary pr-10 leading-snug break-words">
          {displayName}
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
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] uppercase tracking-widest text-text-muted">Copy-Trade Quality Metrics</div>
            {liveState === 'loading' && (
              <span className="flex items-center gap-1.5 text-[9px] text-text-muted">
                <Spinner size="sm" /> computing on-chain
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {METRIC_CARDS.map(({ key, label, fmt, good }) => {
              const val = m[key];
              const isLiveKey = key === 'max_drawdown_pct' || key === 'avg_trade_duration_hrs';
              const isComputing = val == null && isLiveKey && liveState === 'loading';
              const isGood = val != null && good(val);
              return (
                <div key={key} className="rounded-xl border border-border-subtle bg-bg-elevated/50 px-3 py-2.5">
                  <div className="text-[9px] uppercase tracking-widest text-text-muted">{label}</div>
                  <div className={`font-mono text-[15px] font-bold mt-0.5 ${
                    val == null ? 'text-text-muted' : isGood ? 'text-green' : 'text-text-primary'
                  }`}>
                    {val != null ? fmt(val) : isComputing ? 'Computing…' : '—'}
                  </div>
                </div>
              );
            })}
          </div>
          {liveState === 'unavailable' && needsLiveMetrics && (
            <p className="text-[10px] text-text-muted mt-2 leading-relaxed">
              Drawdown & duration need a longer on-chain trade history than this wallet currently exposes.
            </p>
          )}
        </div>

        <div className="px-5 py-4 border-b border-border-subtle">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest text-text-muted">
              YTD Backtest · Forward Outlook
            </span>
            {hasChart && outlook.ytdReturnPct != null && (
              <span className={`font-mono text-[13px] font-bold ${up ? 'text-green' : 'text-red'}`}>
                {up ? '+' : ''}{outlook.ytdReturnPct.toFixed(1)}% YTD
              </span>
            )}
          </div>
          {hasChart ? (
            <>
              <div className="rounded-xl border border-border-subtle bg-bg-elevated/40 p-2">
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="backtestGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00D992" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#00D992" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="outlookGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#818CF8" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#818CF8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                      tickLine={false}
                      axisLine={false}
                      interval={Math.floor(chartData.length / 5)}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                      width={42}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '6px',
                        fontSize: '11px',
                        color: 'var(--text-primary)',
                      }}
                      formatter={(v, name) => [
                        v != null ? `${Number(v).toFixed(1)}%` : '—',
                        name === 'hist' ? 'Backtested' : 'Outlook',
                      ]}
                      labelFormatter={(l) => l}
                    />
                    {outlook.todayLabel && (
                      <ReferenceLine
                        x={outlook.todayLabel}
                        stroke="var(--border-strong)"
                        strokeDasharray="4 4"
                        label={{ value: 'Today', position: 'insideTopRight', fill: 'var(--text-muted)', fontSize: 9 }}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="hist"
                      stroke="#00D992"
                      strokeWidth={1.5}
                      fill="url(#backtestGrad)"
                      dot={false}
                      connectNulls={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="future"
                      stroke="#818CF8"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      fill="url(#outlookGrad)"
                      dot={false}
                      connectNulls={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 mt-2 text-[10px] text-text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-green rounded" /> Backtested (win rate {m.win_rate_pct}% · PF {Number(m.profit_factor).toFixed(1)})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-blue rounded border-dashed" /> +{outlook.outlookReturnPct?.toFixed(1)}% outlook (90d)
                </span>
              </div>
              <p className="text-[10px] text-text-muted mt-1.5 leading-relaxed">
                Backtested from on-chain DEX history ({m.track_record_days}d track record). Outlook extrapolates the same edge forward — not a guarantee.
              </p>
            </>
          ) : (
            <div className="rounded-xl border border-border-subtle bg-bg-elevated/40 px-4 py-5 text-center">
              <div className="text-[12px] text-text-secondary font-medium">Insufficient trade history</div>
              <p className="text-[11px] text-text-muted mt-1">Need win rate and profit factor to build a backtest curve.</p>
            </div>
          )}
        </div>

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
                This wallet passed Hadaleum filters: not an MEV bot (&lt;100 trades/day), has measurable DEX history over 90+ days, win rate above 60%, profit factor above 2.0.
              </div>
            </TextureCardContent>
          </TextureCard>
        </div>
      </div>

      <div className="flex-shrink-0 px-5 py-4 border-t border-border-subtle space-y-2">
        {isTracked ? (
          <>
            <div className="text-center py-2 px-3 rounded-xl border border-blue/25 bg-blue/10 text-[12px] text-blue font-medium">
              ✓ On your watchlist
            </div>
            <Button
              variant="danger"
              fullWidth
              disabled={removing}
              onClick={handleRemove}
            >
              {removing ? <><Spinner size="sm" /> Removing…</> : 'Remove from watchlist'}
            </Button>
          </>
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
