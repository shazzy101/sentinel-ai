import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { ExternalLink, Trophy, Eye, TrendingUp, Minus, Copy, Check, Image as ImageIcon } from 'lucide-react';
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
  { key: 'stats_all', label: 'All time' },
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
  const isNeutral = !live && move.outcome_status === 'NEUTRAL';
  const up = (ret ?? 0) >= 0;

  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-border-subtle last:border-0 hover:bg-bg-elevated/30 transition-colors">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        live ? 'bg-amber/10 border border-amber/20'
        : isNeutral ? 'bg-text-muted/10 border border-border-default'
        : isLoss ? 'bg-red/10 border border-red/20'
        : 'bg-green/15 border border-green/25'
      }`}>
        {live ? <Eye className="h-4 w-4 text-amber" />
          : isNeutral ? <Minus className="h-4 w-4 text-text-muted" />
          : isLoss ? <TrendingUp className="h-4 w-4 text-red rotate-180" />
          : <Trophy className="h-4 w-4 text-green" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-text-primary truncate">
          {move.trader_label || 'Ranked copy trader'}
          {move.trader_rank ? <span className="text-text-muted font-normal ml-2">#{move.trader_rank}</span> : null}
          {!live && (
            <span className={`ml-2 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
              isNeutral ? 'bg-text-muted/15 text-text-muted' : isLoss ? 'bg-red/15 text-red' : 'bg-green/15 text-green'
            }`}>
              {isNeutral ? 'Flat' : isLoss ? 'Loss' : 'Win'}
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
          <div className={`font-mono text-[15px] font-bold ${isNeutral ? 'text-text-muted' : up ? 'text-green' : 'text-red'}`}>
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

const BREAKDOWN_GROUPS = [
  { key: 'by_action', title: 'By move type', hint: 'buy · rotate · take-profit' },
  { key: 'by_rank', title: 'By trader rank', hint: 'leaderboard position' },
  { key: 'by_size', title: 'By trade size', hint: 'on-chain notional' },
  { key: 'by_profit_factor', title: 'By profit factor', hint: 'trader edge quality' },
  { key: 'by_hour', title: 'By time of day', hint: 'detection hour (UTC)' },
];

function BreakdownTable({ title, hint, rows }) {
  if (!rows || rows.length === 0) return null;
  // Highlight the best row by P&L-per-move so the winning segment pops.
  const best = rows.reduce((a, b) => ((b.pnl_per_move ?? -1e9) > (a.pnl_per_move ?? -1e9) ? b : a), rows[0]);
  const maxN = Math.max(...rows.map((r) => r.n || 0), 1);
  return (
    <div className="rounded-2xl border border-border-default bg-bg-surface p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[13px] font-semibold text-text-primary">{title}</h3>
        <span className="text-[10px] text-text-muted">{hint}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.map((r) => {
          const wr = r.win_rate_pct;
          const ppm = r.pnl_per_move ?? 0;
          const isBest = r.label === best.label && ppm > 0;
          return (
            <div key={r.label} className={`grid grid-cols-[1fr_auto] gap-x-3 items-center px-2 py-1.5 rounded-lg ${isBest ? 'bg-green/[0.07] border border-green/20' : ''}`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-medium text-text-primary truncate">{r.label}</span>
                  <span className="text-[10px] text-text-muted tabular-nums">n={r.n}</span>
                  {isBest && <span className="text-[8px] font-bold uppercase tracking-wide text-green bg-green/15 px-1 rounded">best</span>}
                </div>
                <div className="mt-1 h-1 rounded-full bg-bg-elevated overflow-hidden">
                  <div className="h-full rounded-full bg-text-muted/40" style={{ width: `${Math.round(((r.n || 0) / maxN) * 100)}%` }} />
                </div>
              </div>
              <div className="text-right tabular-nums">
                <div className={`text-[12px] font-bold font-mono ${wr == null ? 'text-text-muted' : wr >= 50 ? 'text-green' : 'text-red'}`}>
                  {wr == null ? '—' : `${wr.toFixed(0)}%`}
                </div>
                <div className={`text-[10px] font-mono ${ppm >= 0 ? 'text-green/80' : 'text-red/80'}`}>
                  {ppm >= 0 ? '+' : ''}{fmtUsd(ppm)}/mv
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HighConvictionCard({ hc }) {
  if (!hc) return null;
  const wr = hc.win_rate_pct;
  const ppm = hc.pnl_per_move ?? 0;
  const up = (hc.net_pnl_usd ?? 0) >= 0;
  return (
    <div className="rounded-2xl border border-green/25 bg-gradient-to-br from-green/[0.10] to-transparent p-5 mb-4">
      <div className="flex items-center gap-2 mb-1">
        <Trophy className="h-4 w-4 text-green" />
        <span className="text-[10px] uppercase tracking-widest text-green">My high-conviction edge</span>
        <span className="text-[9px] font-bold uppercase tracking-wide text-green bg-green/15 px-1.5 py-0.5 rounded">conviction=high</span>
      </div>
      <div className="font-mono text-[12px] text-text-secondary mb-3">{hc.filter}</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-text-muted">Win rate (this window)</div>
          <div className={`font-display text-2xl font-bold tabular-nums ${wr != null && wr >= 50 ? 'text-green' : 'text-text-primary'}`}>{wr != null ? `${wr.toFixed(0)}%` : '—'}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-text-muted">Net P&L</div>
          <div className={`font-display text-2xl font-bold tabular-nums ${up ? 'text-green' : 'text-red'}`}>{fmtUsd(hc.net_pnl_usd)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-text-muted">Per move</div>
          <div className={`font-display text-2xl font-bold tabular-nums ${ppm >= 0 ? 'text-green' : 'text-red'}`}>{ppm >= 0 ? '+' : ''}{fmtUsd(ppm)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-text-muted">n · robust OOS</div>
          <div className="font-display text-2xl font-bold tabular-nums text-text-primary">{hc.n}<span className="text-[12px] text-text-muted font-normal"> · {hc.robust_win_rate_pct}%</span></div>
        </div>
      </div>
      <p className="text-[10px] text-text-muted mt-3">
        Robust out-of-sample: ~{hc.robust_win_rate_pct}% win · +{hc.expectancy_pct}%/trade (trained on older ledger, tested on unseen recent). This is the profile the <code className="text-green/80">conviction=high</code> picks feed surfaces.
      </p>
    </div>
  );
}

function Breakdowns({ data, windowLabel }) {
  if (!data || !data.decisive_total) return null;
  return (
    <section className="mb-10">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-green" />
        <h2 className="font-display text-[18px] font-semibold text-text-primary">What's winning</h2>
        <span className="text-[11px] text-text-muted">
          {windowLabel ? `${windowLabel} · ` : ''}{data.decisive_total} decisive moves · win% over win/loss · net $ at $1K/move
        </span>
      </div>
      <HighConvictionCard hc={data.high_conviction} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {BREAKDOWN_GROUPS.map((g) => (
          <BreakdownTable key={g.key} title={g.title} hint={g.hint} rows={data[g.key]} />
        ))}
      </div>
      <p className="text-[11px] text-text-muted mt-2">
        Segmented from the resolved ledger for the selected window. Highlighted row = highest P&L per move in that cut.
      </p>
    </section>
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
  const [windowKey, setWindowKey] = useState('stats_all');

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
            <span className="inline-flex rounded-full h-1.5 w-1.5 bg-green/70" />
            <span className="text-[11px] font-medium text-green uppercase tracking-wide">Verified on-chain</span>
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

          <Breakdowns data={marketing?.breakdowns?.[windowKey] || marketing?.breakdowns?.stats_all} windowLabel={WINDOWS.find((w) => w.key === windowKey)?.label} />

          {watching.length > 0 && (
            <section className="mb-10">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="h-4 w-4 text-amber" />
                <h2 className="font-display text-[18px] font-semibold text-text-primary">Watching now</h2>
                <span className="text-[11px] text-text-muted">current return · pending 24h score</span>
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
            Win rate is over decisive (win/loss) outcomes. Updated {marketing?.updated_at ? relTime(marketing.updated_at) : 'recently'}.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
