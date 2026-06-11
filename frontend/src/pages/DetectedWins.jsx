import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ExternalLink, Trophy, Eye, TrendingUp, Copy, Check } from 'lucide-react';
import { api } from '../lib/api';
import AnimatedCounter from '../components/primitives/AnimatedCounter';
import SentinelLogo from '../components/ui/SentinelLogo';
import MagneticButton from '../components/primitives/MagneticButton';

function fmtUsd(n) {
  const x = Number(n ?? 0);
  if (Math.abs(x) >= 1e6) return `$${(x / 1e6).toFixed(2)}M`;
  if (Math.abs(x) >= 1e3) return `$${(x / 1e3).toFixed(1)}K`;
  return `$${x.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
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

function StatCard({ label, value, sub, color = 'text-text-primary', prefix = '', suffix = '', animate = true }) {
  return (
    <div className="rounded-2xl border border-border-default bg-bg-surface p-5 flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[1.4px] text-text-muted">{label}</span>
      <span className={`font-display text-3xl font-bold tabular-nums ${color}`}>
        {prefix}
        {animate && typeof value === 'number' ? (
          <AnimatedCounter value={value} decimals={suffix === '%' ? 1 : 0} />
        ) : value}
        {suffix}
      </span>
      {sub && <span className="text-[11px] text-text-muted">{sub}</span>}
    </div>
  );
}

function WinRow({ move, live = false }) {
  const ret = live ? move.live_return_pct : move.return_pct_24h;
  const pnl = live ? move.hypothetical_pnl_live_usd : move.hypothetical_pnl_usd;
  const isWin = live ? move.projected_outcome === 'WIN' : true;

  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-border-subtle last:border-0 hover:bg-bg-elevated/30 transition-colors">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isWin ? 'bg-green/15 border border-green/25' : 'bg-amber/10 border border-amber/20'}`}>
        {live ? <Eye className="h-4 w-4 text-amber" /> : <Trophy className="h-4 w-4 text-green" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-text-primary truncate">
          {move.trader_label || 'Ranked copy trader'}
          {move.trader_rank ? <span className="text-text-muted font-normal ml-2">#{move.trader_rank}</span> : null}
        </div>
        <div className="text-[12px] text-text-secondary mt-0.5">{moveLabel(move)}</div>
        <div className="text-[10px] text-text-muted mt-1 flex flex-wrap gap-x-2">
          <span>{relTime(move.detected_at)}</span>
          {move.amount_usd > 0 && <span>· {fmtUsd(move.amount_usd)} on-chain</span>}
          {live && move.hours_until_score != null && (
            <span>· scores in ~{move.hours_until_score}h</span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        {ret != null && (
          <div className={`font-mono text-[15px] font-bold ${ret >= 0 ? 'text-green' : 'text-red'}`}>
            {ret >= 0 ? '+' : ''}{Number(ret).toFixed(1)}%
          </div>
        )}
        {pnl != null && pnl > 0 && (
          <div className="text-[10px] text-text-muted font-mono">+{fmtUsd(pnl)} on $1K</div>
        )}
      </div>
      {move.tx_hash && (
        <a
          href={`https://etherscan.io/tx/${move.tx_hash}`}
          target="_blank"
          rel="noreferrer"
          className="p-2 rounded-lg text-text-muted hover:text-green hover:bg-green/10 transition-colors shrink-0"
          title="Verify on Etherscan"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}

export default function DetectedWinsPage() {
  const [marketing, setMarketing] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Detected Wins — Hadaleum';
  }, []);

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

  const d24 = marketing?.stats_24h || {};
  const d7 = marketing?.stats_7d || {};
  const wins = marketing?.recent_wins || [];
  const watching = marketing?.watching || [];

  return (
    <div className="min-h-screen bg-bg-base">
      <nav className="border-b border-border-subtle px-6 py-4 flex items-center justify-between max-w-5xl mx-auto">
        <Link to="/" className="flex items-center gap-2 text-text-primary hover:opacity-80 transition-opacity">
          <SentinelLogo size={22} />
          <span className="font-display font-semibold text-[15px]">Hadaleum</span>
        </Link>
        <MagneticButton
          type="button"
          onClick={() => window.location.href = '/signup'}
          className="bg-green text-text-inverse text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-green-bright transition-colors"
        >
          Track whales free →
        </MagneticButton>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-green/25 bg-green/[0.08] px-3 py-1 mb-6">
            <span className="relative h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green" />
            </span>
            <span className="text-[11px] font-medium text-green uppercase tracking-wide">Live · Verified on-chain</span>
          </div>

          <h1 className="font-display text-4xl md:text-5xl font-bold text-text-primary tracking-tight mb-4">
            Detected Wins
          </h1>
          <p className="text-[15px] text-text-muted max-w-2xl leading-relaxed mb-8">
            Every move below was logged when Hadaleum detected a ranked copy trader swapping on Ethereum.
            Wins are scored 24 hours later using CoinGecko — fully verifiable via Etherscan.
          </p>

          {marketing?.headline && (
            <div className="rounded-2xl border border-green/20 bg-green/[0.06] p-5 mb-10 flex flex-col sm:flex-row sm:items-center gap-4">
              <p className="text-[15px] text-text-primary leading-snug flex-1 font-medium">
                {marketing.headline}
              </p>
              <button
                type="button"
                onClick={copyHeadline}
                className="flex items-center gap-2 shrink-0 text-[12px] font-semibold px-4 py-2 rounded-xl border border-border-default bg-bg-surface hover:bg-bg-elevated transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy for pitch'}
              </button>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-border-default bg-bg-surface h-24 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              <StatCard label="Wins · 24h" value={d24.wins ?? 0} color="text-green" sub="Scored outcomes" />
              <StatCard
                label="Hypo P&L · 24h"
                value={fmtUsd(d24.total_hypothetical_pnl_usd)}
                animate={false}
                color="text-green"
                sub="$1K per move"
              />
              <StatCard
                label="Avg win · 24h"
                value={d24.avg_win_return_pct ?? 0}
                suffix="%"
                prefix="+"
                color="text-green"
              />
              <StatCard
                label="On track now"
                value={marketing?.on_track_count ?? 0}
                color="text-amber"
                sub={`${marketing?.pending_total ?? 0} moves watching`}
              />
            </div>
          )}

          {watching.length > 0 && (
            <section className="mb-10">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="h-4 w-4 text-amber" />
                <h2 className="font-display text-[18px] font-semibold text-text-primary">Watching now</h2>
                <span className="text-[11px] text-text-muted">Live return · pending 24h score</span>
              </div>
              <div className="rounded-2xl border border-border-default bg-bg-surface overflow-hidden">
                {watching.map((m) => (
                  <WinRow key={m.tx_hash} move={m} live />
                ))}
              </div>
            </section>
          )}

          <section className="mb-10">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-green" />
              <h2 className="font-display text-[18px] font-semibold text-text-primary">Verified wins</h2>
              <span className="text-[11px] text-text-muted">{d7.wins ?? 0} in last 7 days</span>
            </div>
            {wins.length === 0 ? (
              <div className="rounded-2xl border border-border-default bg-bg-surface px-5 py-10 text-center">
                <TrendingUp className="h-8 w-8 text-text-muted mx-auto mb-3 opacity-50" />
                <p className="text-[14px] text-text-secondary mb-1">Building the win ledger</p>
                <p className="text-[12px] text-text-muted max-w-md mx-auto">
                  Moves are being detected from ranked copy traders. First scored wins appear ~24h after detection.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-border-default bg-bg-surface overflow-hidden">
                {wins.map((m) => (
                  <WinRow key={m.tx_hash} move={m} />
                ))}
              </div>
            )}
          </section>

          <p className="text-[11px] text-text-muted leading-relaxed border-t border-border-subtle pt-6">
            {marketing?.methodology} Past results do not guarantee future performance. Not financial advice.
            Updated {marketing?.updated_at ? relTime(marketing.updated_at) : 'live'}.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
