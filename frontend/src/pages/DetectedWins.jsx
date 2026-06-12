import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { ExternalLink, Trophy, Eye, TrendingUp, Copy, Check, Image as ImageIcon } from 'lucide-react';
import { api, getApiBase } from '../lib/api';
import AnimatedCounter from '../components/primitives/AnimatedCounter';
import SentinelLogo from '../components/ui/SentinelLogo';
import MagneticButton from '../components/primitives/MagneticButton';

function fmtUsd(n) {
  const x = Number(n ?? 0);
  const sign = x < 0 ? '−' : '';
  const a = Math.abs(x);
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(1)}K`;
  return `${sign}$${a.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function relTime(ts) {
  if (!ts) return '';
  const ms = Date.now() - new Date(ts).getTime();
  if (Number.isNaN(ms)) return '';
  const h = Math.floor(ms / 3600000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function moveLabel(m) {
  const action = m.action || 'buy';
  if (action === 'take_profit' && m.token_sold) return `Profit on ${m.token_sold}`;
  if (m.token_bought) return `${m.token_sold || '?'} → ${m.token_bought}`;
  return 'On-chain swap';
}

const WINDOWS = [
  { key: 'stats_24h', label: '24h' },
  { key: 'stats_7d', label: '7d' },
  { key: 'stats_30d', label: '30d' },
];

function StatCard({ label, value, sub, color = 'text-text-primary', prefix = '', suffix = '', animate = true }) {
  return (
    <div className="rounded-2xl border border-border-default bg-bg-surface p-5 flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[1.4px] text-text-muted">{label}</span>
      <span className={`font-display text-3xl font-bold tabular-nums ${color}`}>
        {prefix}
        {animate && typeof value === 'number' ? (
          <AnimatedCounter value={value} decimals={suffix === '%' ? 0 : 0} />
        ) : value}
        {suffix}
      </span>
      {sub && <span className="text-[11px] text-text-muted">{sub}</span>}
    </div>
  );
}

function ScoredRow({ move, live = false }) {
  const ret = live ? move.live_return_pct : move.return_pct_24h;
  const pnl = live ? move.hypothetical_pnl_live_usd : move.hypothetical_pnl_usd;
  const isLoss = !live && move.outcome_status === 'LOSS';
  const up = (ret ?? 0) >= 0;

  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-border-subtle last:border-0 hover:bg-bg-elevated/30 transition-colors">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        live ? 'bg-amber/10 border border-amber/20'
        : isLoss ? 'bg-red/10 border border-red/20'
        : 'bg-green/15 border border-green/25'
      }`}>
        {live ? <Eye className="h-4 w-4 text-amber" />
          : isLoss ? <TrendingUp className="h-4 w-4 text-red rotate-180" />
          : <Trophy className="h-4 w-4 text-green" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-text-primary truncate">
          {move.trader_label || 'Ranked copy trader'}
          {move.trader_rank ? <span className="text-text-muted font-normal ml-2">#{move.trader_rank}</span> : null}
          {!live && (
            <span className={`ml-2 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${isLoss ? 'bg-red/15 text-red' : 'bg-green/15 text-green'}`}>
              {isLoss ? 'Loss' : 'Win'}
            </span>
          )}
        </div>
        <div className="text-[12px] text-text-secondary mt-0.5">{moveLabel(move)}</div>
        <div className="text-[10px] text-text-muted mt-1 flex flex-wrap gap-x-2">
          <span>{relTime(move.detected_at)}</span>
          {move.amount_usd > 0 && <span>· {fmtUsd(move.amount_usd)} on-chain</span>}
          {live && move.hours_until_score != null && <span>· scores in ~{move.hours_until_score}h</span>}
        </div>
      </div>
      <div className="text-right shrink-0">
        {ret != null && (
          <div className={`font-mono text-[15px] font-bold ${up ? 'text-green' : 'text-red'}`}>
            {up ? '+' : ''}{Number(ret).toFixed(1)}%
          </div>
        )}
        {pnl != null && (
          <div className="text-[10px] text-text-muted font-mono">{fmtUsd(pnl)} on $1K</div>
        )}
      </div>
      {move.tx_hash && (
        <a
          href={`https://etherscan.io/tx/${move.tx_hash}`}
          target="_blank" rel="noreferrer"
          className="p-2 rounded-lg text-text-muted hover:text-green hover:bg-green/10 transition-colors shrink-0"
          title="Verify on Etherscan"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}

function EquityCurve({ points }) {
  const data = useMemo(() => (points || []).map((p) => ({ n: p.n, pnl: p.cum_pnl })), [points]);
  if (data.length < 2) return null;
  const last = data[data.length - 1].pnl;
  const up = last >= 0;
  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-[18px] font-semibold text-text-primary">Cumulative P&L curve</h2>
        <span className={`font-mono text-[15px] font-bold ${up ? 'text-green' : 'text-red'}`}>{fmtUsd(last)}</span>
      </div>
      <div className="rounded-2xl border border-border-default bg-bg-surface p-4">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={up ? '#00D992' : '#EF4444'} stopOpacity={0.25} />
                <stop offset="95%" stopColor={up ? '#00D992' : '#EF4444'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="n" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} width={52}
              tickFormatter={(v) => fmtUsd(v)} />
            <ReferenceLine y={0} stroke="var(--border-strong)" strokeDasharray="3 3" />
            <Tooltip
              contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '8px', fontSize: '12px' }}
              formatter={(v) => [fmtUsd(v), 'Cumulative P&L']}
              labelFormatter={(l) => `Move #${l}`}
            />
            <Area type="monotone" dataKey="pnl" stroke={up ? '#00D992' : '#EF4444'} strokeWidth={2} fill="url(#eqGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-text-muted mt-2">Hypothetical: $1,000 copied into every scored move — wins, losses, and sub-3% movers — in detection order.</p>
    </section>
  );
}

export default function DetectedWinsPage() {
  const [marketing, setMarketing] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [windowKey, setWindowKey] = useState('stats_30d');

  useEffect(() => { document.title = 'Detected Wins — Hadaleum'; }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api.getTrustMarketing()
        .then((d) => { if (!cancelled) setMarketing(d); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const copyHeadline = () => {
    const text = marketing?.headline || marketing?.tweet_hooks?.[0];
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const stats = marketing?.[windowKey] || {};
  const decisive = (stats.wins || 0) + (stats.losses || 0);
  const winRate = stats.win_rate_pct;
  const scored = marketing?.recent_scored || [];
  const watching = marketing?.watching || [];
  const biggest = marketing?.biggest_win;
  const ogUrl = `${getApiBase()}/api/trust/og.svg`;

  return (
    <div className="min-h-screen bg-bg-base">
      <nav className="border-b border-border-subtle px-6 py-4 flex items-center justify-between max-w-5xl mx-auto">
        <Link to="/" className="flex items-center gap-2 text-text-primary hover:opacity-80 transition-opacity">
          <SentinelLogo size={22} />
          <span className="font-display font-semibold text-[15px]">Hadaleum</span>
        </Link>
        <MagneticButton
          type="button"
          onClick={() => { window.location.href = '/signup'; }}
          className="bg-green text-text-inverse text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-green-bright transition-colors"
        >
          Track whales free →
        </MagneticButton>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="inline-flex items-center gap-2 rounded-full border border-green/25 bg-green/[0.08] px-3 py-1 mb-6">
            <span className="relative h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green" />
            </span>
            <span className="text-[11px] font-medium text-green uppercase tracking-wide">Live · Verified on-chain</span>
          </div>

          {/* Win-rate hero */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-2">
            <div>
              <h1 className="font-display text-4xl md:text-5xl font-bold text-text-primary tracking-tight mb-3">
                Track record
              </h1>
              <p className="text-[15px] text-text-muted max-w-2xl leading-relaxed">
                Every move is logged when a ranked copy trader swaps on Ethereum, then scored a win or loss
                24 hours later via CoinGecko. Wins <em>and</em> losses — fully verifiable on Etherscan.
              </p>
            </div>
            {/* Window toggle */}
            <div className="flex gap-1 p-0.5 rounded-xl bg-bg-elevated border border-border-subtle self-start shrink-0">
              {WINDOWS.map((w) => (
                <button
                  key={w.key}
                  type="button"
                  onClick={() => setWindowKey(w.key)}
                  className={`text-[12px] font-semibold px-3.5 py-1.5 rounded-lg transition-colors ${
                    windowKey === w.key ? 'bg-green text-text-inverse' : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          {marketing?.headline && (
            <div className="rounded-2xl border border-green/20 bg-green/[0.06] p-5 my-8 flex flex-col sm:flex-row sm:items-center gap-4">
              <p className="text-[15px] text-text-primary leading-snug flex-1 font-medium">{marketing.headline}</p>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={copyHeadline}
                  className="flex items-center gap-2 text-[12px] font-semibold px-4 py-2 rounded-xl border border-border-default bg-bg-surface hover:bg-bg-elevated transition-colors">
                  {copied ? <Check className="h-3.5 w-3.5 text-green" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy pitch'}
                </button>
                <a href={ogUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-[12px] font-semibold px-4 py-2 rounded-xl border border-border-default bg-bg-surface hover:bg-bg-elevated transition-colors">
                  <ImageIcon className="h-3.5 w-3.5" /> Share image
                </a>
              </div>
            </div>
          )}

          {/* Stat grid (window-driven) */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              {[...Array(4)].map((_, i) => <div key={i} className="rounded-2xl border border-border-default bg-bg-surface h-24 animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              <StatCard label="Win rate" value={winRate != null ? winRate : '—'} suffix={winRate != null ? '%' : ''}
                animate={winRate != null} color="text-green" sub={decisive ? `${stats.wins}W · ${stats.losses}L` : 'no scored moves yet'} />
              <StatCard label="Net P&L" value={fmtUsd(stats.net_hypothetical_pnl_usd)} animate={false}
                color={(stats.net_hypothetical_pnl_usd || 0) >= 0 ? 'text-green' : 'text-red'} sub="$1K per move" />
              <StatCard label="Avg win" value={stats.avg_win_return_pct ?? 0} suffix="%" prefix="+" color="text-green" />
              <StatCard label="On track now" value={marketing?.on_track_count ?? 0} color="text-amber"
                sub={`${marketing?.pending_total ?? 0} moves watching`} />
            </div>
          )}

          {biggest && biggest.return_pct_24h != null && (
            <div className="rounded-2xl border border-green/25 bg-gradient-to-br from-green/[0.10] to-transparent p-5 mb-10 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green/15 border border-green/25 flex items-center justify-center shrink-0">
                <Trophy className="h-5 w-5 text-green" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-green mb-0.5">Biggest detected win</div>
                <div className="text-[15px] font-semibold text-text-primary">{moveLabel(biggest)} · {biggest.trader_label}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-2xl font-bold text-green">+{Number(biggest.return_pct_24h).toFixed(1)}%</div>
                {biggest.tx_hash && (
                  <a href={`https://etherscan.io/tx/${biggest.tx_hash}`} target="_blank" rel="noreferrer"
                    className="text-[10px] text-text-muted hover:text-green inline-flex items-center gap-1">
                    Verify <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          <EquityCurve points={marketing?.equity_curve} />

          {watching.length > 0 && (
            <section className="mb-10">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="h-4 w-4 text-amber" />
                <h2 className="font-display text-[18px] font-semibold text-text-primary">Watching now</h2>
                <span className="text-[11px] text-text-muted">live return · pending 24h score</span>
              </div>
              <div className="rounded-2xl border border-border-default bg-bg-surface overflow-hidden">
                {watching.map((m) => <ScoredRow key={m.tx_hash} move={m} live />)}
              </div>
            </section>
          )}

          {/* Full record — wins AND losses */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-green" />
              <h2 className="font-display text-[18px] font-semibold text-text-primary">Full record</h2>
              <span className="text-[11px] text-text-muted">every scored move — wins and losses</span>
            </div>
            {scored.length === 0 ? (
              <div className="rounded-2xl border border-border-default bg-bg-surface px-5 py-10 text-center">
                <TrendingUp className="h-8 w-8 text-text-muted mx-auto mb-3 opacity-50" />
                <p className="text-[14px] text-text-secondary mb-1">Building the ledger</p>
                <p className="text-[12px] text-text-muted max-w-md mx-auto">
                  Moves are being detected from ranked copy traders. First scored outcomes appear ~24h after detection.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-border-default bg-bg-surface overflow-hidden">
                {scored.map((m) => <ScoredRow key={m.tx_hash} move={m} />)}
              </div>
            )}
          </section>

          <p className="text-[11px] text-text-muted leading-relaxed border-t border-border-subtle pt-6">
            {marketing?.methodology} Past results do not guarantee future performance. Not financial advice.
            Win rate is over decisive (win/loss) outcomes. Updated {marketing?.updated_at ? relTime(marketing.updated_at) : 'live'}.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
