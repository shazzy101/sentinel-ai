import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AreaChart, Area, Tooltip, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid,
} from 'recharts';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import ScoreRing from '../ui/ScoreRing';
import { ChainBadge, GradeBadge, RiskBadge, SignalPill } from '../ui/Badge';
import { TextureCard, TextureCardContent } from '../ui/texture-card';
import TradeModal from './TradeModal';

const API_BASE = import.meta.env.VITE_API_URL || '';

function gradeFromScore(score) {
  if (score >= 85) return 'S';
  if (score >= 70) return 'A';
  if (score >= 55) return 'B';
  if (score >= 40) return 'C';
  if (score >= 25) return 'D';
  return 'F';
}

function getUserTags(address) {
  try { return JSON.parse(localStorage.getItem(`sentinel-tags-${address}`) || '[]'); }
  catch { return []; }
}
function saveUserTags(address, tags) {
  localStorage.setItem(`sentinel-tags-${address}`, JSON.stringify(tags));
}

// v4 scoring engine weights: Recency/25, Activity/25, DeFi/25, SuccessRate/15, Balance/10
const V4_BREAKDOWN = [
  { key: 'activity',     label: 'Activity',     max: 25 },
  { key: 'defi',         label: 'DeFi Engage',  max: 25 },
  { key: 'recency',      label: 'Recency',       max: 25 },
  { key: 'success_rate', label: 'Success Rate',  max: 15 },
  { key: 'balance',      label: 'Balance',       max: 10 },
];

function BreakdownBar({ label, value, max }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const barPct = value > 0 ? Math.max(pct, 4) : 0;
  const colorClass = pct >= 70 ? 'fill-score-high' : pct >= 40 ? 'fill-score-mid' : 'fill-score-low';
  const textClass  = pct >= 70 ? 'text-green'       : pct >= 40 ? 'text-amber'     : 'text-red';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-text-muted">{label}</span>
        <span className={`text-[11px] font-mono font-medium ${textClass}`}>
          {value}<span className="text-text-muted font-normal">/{max}</span>
        </span>
      </div>
      <svg className="h-[3px] w-full overflow-visible" viewBox="0 0 100 3" preserveAspectRatio="none" aria-hidden="true">
        <rect x="0" y="0" width="100" height="3" className="fill-bg-elevated" rx="1.5" />
        <rect x="0" y="0" width={barPct} height="3" className={colorClass} rx="1.5" />
      </svg>
    </div>
  );
}

const CustomYtdTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div className="bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-[11px] shadow-lg">
      <div className="text-text-muted mb-0.5">{label}</div>
      <div className="font-mono font-medium text-text-primary">
        {val != null ? `${Number(val).toFixed(4)} ETH` : '—'}
      </div>
    </div>
  );
};

function TabBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${
        active
          ? 'bg-white/[0.08] text-text-primary'
          : 'text-text-muted hover:text-text-secondary'
      }`}
    >
      {children}
    </button>
  );
}

export default function WalletDetailPanel({ wallet, onClose, onRescan, onRemove }) {
  const [copied, setCopied] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [detail, setDetail] = useState(wallet);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('overview');
  const [userTags, setUserTags] = useState(() => getUserTags(wallet?.address));
  const [newTag, setNewTag] = useState('');
  const [tradeOpen, setTradeOpen] = useState(false);
  const scrollRef = useRef(null);

  const score = Number(detail?.score || 0);
  const grade = gradeFromScore(score);
  const risk = detail?.analysis?.risk_level || (score >= 80 ? 'LOW' : score >= 60 ? 'MEDIUM' : 'HIGH');
  const analysis = detail?.analysis || {};
  const analysisTags = (detail?.analysis?.tags?.length ? detail.analysis.tags : detail?.tags) || [];
  const autoTags = useMemo(() => {
    const tags = [];
    if (score > 90) tags.push('High Conviction');
    if (score > 80) tags.push('Smart Money');
    return tags;
  }, [score]);
  const allTags = [...new Set([...autoTags, ...analysisTags, ...userTags])];

  // Score breakdown — use raw values from API (v4 engine)
  const bd = detail?.score_breakdown || {};

  // YTD sparkline from detail (full fetch)
  const sparkData = useMemo(() => {
    const raw = detail?.ytd_sparkline;
    if (!Array.isArray(raw) || raw.length < 2) return [];
    return raw.map((pt) => ({
      date: pt.date
        ? new Date(pt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '',
      balance: typeof pt.balance === 'number' ? pt.balance : (pt.value ?? pt.balance ?? 0),
    }));
  }, [detail]);

  const sparkFirst = sparkData[0]?.balance ?? 0;
  const sparkLast  = sparkData[sparkData.length - 1]?.balance ?? 0;
  const sparkUp    = sparkLast >= sparkFirst;
  const trendColor = sparkUp ? '#00D992' : '#FF4D4D';
  const ytdPct     = detail?.ytd_growth_pct ?? (
    sparkFirst > 0 ? ((sparkLast - sparkFirst) / sparkFirst * 100) : null
  );

  const recentTxs = detail?.recent_transactions || [];

  // Fetch full wallet detail (with ytd_sparkline) when panel opens
  useEffect(() => {
    if (!wallet?.address) return;
    setDetail(wallet);
    setLoading(true);
    let cancelled = false;
    fetch(`${API_BASE}/api/wallets/${wallet.address}`)
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled && body.success) setDetail(body.data?.wallet || wallet);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [wallet?.address]);

  useEffect(() => { setUserTags(getUserTags(wallet?.address)); }, [wallet?.address]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; setTab('overview'); }, [wallet?.address]);

  if (!detail) return null;

  const handleRemove = async () => {
    if (removing) return;
    setRemoving(true);
    try {
      await fetch(`${API_BASE}/api/watchlist/${wallet.address}`, { method: 'DELETE' });
    } finally {
      setRemoving(false);
      onRemove?.();
    }
  };

  return (
    <aside className="w-full h-full min-h-0 bg-bg-surface border-l border-border-subtle flex flex-col">

      {/* Header */}
      <div className="flex-shrink-0 px-5 py-4 border-b border-border-subtle">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-display text-[15px] font-bold text-text-primary leading-tight truncate">
              {detail.label || 'Unnamed wallet'}
            </div>
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <ChainBadge chain={detail.chain} />
              {detail.balance != null && (
                <span className="text-[11px] font-mono text-text-secondary">
                  {Number(detail.balance).toLocaleString(undefined, { maximumFractionDigits: 4 })} ETH
                </span>
              )}
              {ytdPct != null && (
                <span className={`text-[11px] font-mono font-semibold ${ytdPct >= 0 ? 'text-green' : 'text-red'}`}>
                  {ytdPct >= 0 ? '+' : ''}{ytdPct.toFixed(1)}% YTD
                </span>
              )}
              {loading && <Spinner size="sm" />}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 mt-0.5 h-7 w-7 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors text-[14px]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Address */}
        <div className="mt-2.5 flex items-center gap-2">
          <span className="font-mono text-[10px] text-text-muted break-all leading-relaxed flex-1">
            {detail.address}
          </span>
          <button
            type="button"
            aria-label="Copy address"
            onClick={async () => {
              if (!detail.address) return;
              await navigator.clipboard.writeText(detail.address);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="flex-shrink-0 h-6 w-6 flex items-center justify-center rounded text-text-muted hover:text-green transition-colors"
          >
            {copied
              ? <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="stroke-green"><path d="M2 6.5L5 9.5L11 3.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              : <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="stroke-current"><rect x="4.5" y="1" width="7.5" height="9.5" rx="1.5" strokeWidth="1.2" /><path d="M8.5 10.5V12A1.5 1.5 0 017 13H2A1.5 1.5 0 01.5 11.5V4A1.5 1.5 0 012 2.5H4.5" strokeWidth="1.2" /></svg>
            }
          </button>
          <a
            href={`https://etherscan.io/address/${detail.address}`}
            target="_blank"
            rel="noreferrer"
            className="flex-shrink-0 h-6 w-6 flex items-center justify-center rounded text-text-muted hover:text-blue transition-colors"
            title="View on Etherscan"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current"><path d="M1 11L11 1M11 1H4M11 1V8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </a>
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {allTags.map((tag) => (
              <span key={tag} className="bg-bg-elevated border border-border-default rounded-full px-2 py-0.5 text-[10px] text-text-secondary">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex gap-1 px-4 py-2 border-b border-border-subtle">
        <TabBtn active={tab === 'overview'}     onClick={() => setTab('overview')}>Overview</TabBtn>
        <TabBtn active={tab === 'performance'}  onClick={() => setTab('performance')}>2026 Chart</TabBtn>
        <TabBtn active={tab === 'activity'}     onClick={() => setTab('activity')}>Activity</TabBtn>
      </div>

      {/* Tab body */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">

        {/* ── OVERVIEW TAB ── */}
        {tab === 'overview' && (
          <div className="px-5 py-4 space-y-4">

            {/* Score card */}
            <TextureCard>
              <TextureCardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] uppercase tracking-[1px] text-text-muted">Performance Score</span>
                  <GradeBadge grade={grade} />
                </div>
                <div className="flex gap-5 items-start">
                  <ScoreRing score={score} size={68} />
                  <div className="flex-1 flex flex-col gap-2.5 pt-1">
                    {V4_BREAKDOWN.map(({ key, label, max }) => (
                      <BreakdownBar
                        key={key}
                        label={label}
                        value={bd[key] ?? 0}
                        max={max}
                      />
                    ))}
                  </div>
                </div>
              </TextureCardContent>
            </TextureCard>

            {/* Signal + AI analysis */}
            <div>
              <div className="text-[10px] uppercase tracking-[1px] text-text-muted mb-2">AI Analysis</div>
              <div className="flex items-center gap-2 mb-2">
                <SignalPill signal={detail.signal || 'NEUTRAL'} />
                <div className="flex-shrink-0 mt-0.5"><RiskBadge level={risk} /></div>
                {detail.last_scanned && (
                  <span className="text-[10px] text-text-muted font-mono ml-auto">
                    {new Date(detail.last_scanned).toLocaleDateString()}
                  </span>
                )}
              </div>

              <p className="text-[12px] text-text-secondary leading-[1.75] break-words">
                {analysis.signal_reason || detail.signal_reason || 'Awaiting AI analysis — rescan this wallet to generate insights.'}
              </p>

              {analysis.activity_summary && (
                <p className="text-[12px] text-text-secondary leading-[1.75] mt-2 break-words">
                  {analysis.activity_summary}
                </p>
              )}

              {analysis.key_insight && (
                <TextureCard className="mt-3">
                  <TextureCardContent className="p-3 border-l-2 border-l-green">
                    <div className="text-[10px] text-green uppercase tracking-[1px] mb-1">Key Insight</div>
                    <p className="text-[12px] text-text-secondary leading-[1.75] break-words">
                      {analysis.key_insight}
                    </p>
                  </TextureCardContent>
                </TextureCard>
              )}

              {analysis.risk_reason && (
                <p className="text-[11px] text-text-muted leading-[1.65] mt-2 break-words">
                  {analysis.risk_reason}
                </p>
              )}
            </div>

            {/* Add tag */}
            <div>
              <div className="text-[10px] uppercase tracking-[1px] text-text-muted mb-2">Your Labels</div>
              <div className="flex gap-1.5 flex-wrap mb-2">
                {userTags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 bg-bg-elevated border border-border-default rounded-full px-2 py-0.5 text-[10px] text-text-secondary cursor-pointer hover:border-red/50 hover:text-red transition-colors"
                    onClick={() => {
                      const next = userTags.filter((t) => t !== tag);
                      setUserTags(next);
                      saveUserTags(detail.address, next);
                    }}
                  >
                    {tag} ×
                  </span>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const t = newTag.trim().toLowerCase();
                  if (t && !userTags.includes(t)) {
                    const next = [...userTags, t];
                    setUserTags(next);
                    saveUserTags(detail.address, next);
                  }
                  setNewTag('');
                }}
                className="flex gap-2"
              >
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add label…"
                  className="flex-1 bg-bg-elevated border border-border-default rounded-lg px-2.5 py-1.5 text-[11px] text-text-primary placeholder:text-text-muted outline-none focus:border-blue/50"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-bg-elevated border border-border-default rounded-lg text-[11px] text-text-secondary hover:border-border-subtle transition-colors"
                >
                  Add
                </button>
              </form>
            </div>

          </div>
        )}

        {/* ── PERFORMANCE TAB ── */}
        {tab === 'performance' && (
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[13px] font-semibold text-text-primary">2026 Balance History</div>
              {ytdPct != null && (
                <span className={`text-[13px] font-mono font-bold ${ytdPct >= 0 ? 'text-green' : 'text-red'}`}>
                  {ytdPct >= 0 ? '▲' : '▼'} {Math.abs(ytdPct).toFixed(1)}% YTD
                </span>
              )}
            </div>

            {loading && (
              <div className="flex items-center justify-center py-12">
                <Spinner size="md" />
                <span className="ml-2 text-[12px] text-text-muted">Loading chart data…</span>
              </div>
            )}

            {!loading && sparkData.length < 2 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-[28px] mb-2">📈</div>
                <div className="text-[13px] font-medium text-text-secondary mb-1">No 2026 history yet</div>
                <p className="text-[12px] text-text-muted max-w-[260px] leading-[1.6]">
                  Rescan this wallet to compute its YTD balance history from on-chain transactions.
                </p>
                <button
                  type="button"
                  onClick={onRescan}
                  className="mt-4 px-4 py-2 bg-bg-elevated border border-border-default rounded-xl text-[12px] text-text-secondary hover:border-border-subtle transition-colors"
                >
                  Rescan wallet
                </button>
              </div>
            )}

            {!loading && sparkData.length >= 2 && (
              <div className="rounded-xl border border-border-subtle bg-bg-elevated p-3">
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={sparkData} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ytdGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={trendColor} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={trendColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#28283A" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9, fill: '#666' }}
                      tickLine={false}
                      axisLine={false}
                      interval={Math.floor(sparkData.length / 6)}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: '#666' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${Number(v).toFixed(1)}`}
                      width={38}
                    />
                    <Tooltip content={<CustomYtdTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke={trendColor}
                      strokeWidth={1.5}
                      fill="url(#ytdGrad)"
                      dot={false}
                      activeDot={{ r: 3, fill: trendColor }}
                    />
                  </AreaChart>
                </ResponsiveContainer>

                {/* Min / Max callouts */}
                {(() => {
                  const vals = sparkData.map((d) => d.balance);
                  const minV = Math.min(...vals);
                  const maxV = Math.max(...vals);
                  return (
                    <div className="flex gap-3 mt-3 pt-3 border-t border-border-subtle">
                      <div className="flex-1 text-center">
                        <div className="text-[10px] text-text-muted">Peak</div>
                        <div className="text-[12px] font-mono font-medium text-green">{maxV.toFixed(2)} ETH</div>
                      </div>
                      <div className="w-px bg-border-subtle" />
                      <div className="flex-1 text-center">
                        <div className="text-[10px] text-text-muted">Low</div>
                        <div className="text-[12px] font-mono font-medium text-red">{minV.toFixed(2)} ETH</div>
                      </div>
                      <div className="w-px bg-border-subtle" />
                      <div className="flex-1 text-center">
                        <div className="text-[10px] text-text-muted">Now</div>
                        <div className="text-[12px] font-mono font-medium text-text-primary">{(sparkData[sparkData.length - 1]?.balance ?? 0).toFixed(2)} ETH</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ── ACTIVITY TAB ── */}
        {tab === 'activity' && (
          <div className="px-5 py-4">
            <div className="text-[10px] uppercase tracking-[1px] text-text-muted mb-3">
              Recent Transactions
            </div>
            {recentTxs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-[28px] mb-2">🔍</div>
                <div className="text-[13px] font-medium text-text-secondary mb-1">No transactions loaded</div>
                <p className="text-[12px] text-text-muted max-w-[240px] leading-[1.6]">
                  Rescan this wallet to fetch its latest on-chain activity.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {recentTxs.slice(0, 20).map((tx) => (
                  <a
                    key={tx.hash}
                    href={`https://etherscan.io/tx/${tx.hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-bg-elevated/40 px-3 py-2.5 hover:border-border-default hover:bg-bg-elevated transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${tx.direction === 'in' ? 'bg-green/15 text-green' : 'bg-red/15 text-red'}`}>
                        {tx.direction === 'in' ? '↓' : '↑'}
                      </div>
                      <div className="min-w-0">
                        <div className={`text-[12px] font-mono font-medium ${tx.direction === 'in' ? 'text-green' : 'text-red'}`}>
                          {tx.direction === 'in' ? '+' : '-'}{Number(tx.value || 0).toFixed(4)} {tx.value_symbol || 'ETH'}
                        </div>
                        <div className="text-[10px] text-text-muted truncate">
                          {tx.timestamp ? new Date(tx.timestamp).toLocaleString() : '—'}
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className="text-[10px] text-text-muted group-hover:text-text-secondary transition-colors">
                        {tx.status || 'ok'}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 px-5 py-4 bg-bg-surface border-t border-border-subtle space-y-2">
        <Button variant="primary" fullWidth onClick={() => setTradeOpen(true)}>
          ⚡ Trade
        </Button>
        <Button variant="ghost" fullWidth onClick={onRescan}>Rescan wallet</Button>
        <Button
          variant="danger"
          fullWidth
          disabled={removing}
          onClick={handleRemove}
        >
          {removing ? <><Spinner size="sm" /> Removing…</> : 'Remove from watchlist'}
        </Button>
      </div>

      <TradeModal isOpen={tradeOpen} onClose={() => setTradeOpen(false)} />
    </aside>
  );
}
