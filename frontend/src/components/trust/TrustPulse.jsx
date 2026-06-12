import { useEffect, useState } from 'react';
import { ExternalLink, TrendingUp, Trophy } from 'lucide-react';
import { api } from '../../lib/api';
import AnimatedCounter from '../primitives/AnimatedCounter';
import { SkeletonLine } from '../primitives/DataState';

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

function moveLabel(win) {
  const action = win.action || 'buy';
  if (action === 'take_profit' && win.token_sold) return `Profit on ${win.token_sold}`;
  if (win.token_bought) return `Bought ${win.token_bought}`;
  return 'On-chain move';
}

function CompactBanner({ pulse }) {
  const d = pulse.last_24h || {};
  const wins = d.wins ?? 0;
  const pnl = d.total_hypothetical_pnl_usd ?? 0;
  const avg = d.avg_win_return_pct ?? 0;

  if (!wins && !pulse.pending_scoring) return null;

  return (
    <div
      className="mt-6 rounded-xl border border-green/20 bg-green/[0.06] px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
      style={{ backdropFilter: 'blur(8px)' }}
    >
      <div className="flex items-center gap-2 shrink-0">
        <Trophy className="h-4 w-4 text-green" />
        <span className="text-[11px] uppercase tracking-[1.2px] text-green font-semibold">Detected wins · 24h</span>
      </div>
      <p className="text-[13px] text-text-secondary leading-snug">
        {wins > 0 ? (
          <>
            Hadaleum flagged{' '}
            <span className="font-semibold text-text-primary">{wins} winning move{wins !== 1 ? 's' : ''}</span>
            {avg > 0 && (
              <> averaging <span className="font-mono text-green">+{avg.toFixed(1)}%</span></>
            )}
            {pnl > 0 && (
              <> — a <span className="font-mono text-green">{fmtUsd(pnl)}</span> hypothetical gain on $1K copies</>
            )}
          </>
        ) : (
          <>
            <span className="font-semibold text-text-primary">{pulse.pending_scoring || 0} moves</span> detected — scoring in ~24h
          </>
        )}
      </p>
    </div>
  );
}

function FullCard({ pulse }) {
  const d24 = pulse.last_24h || {};
  const d7 = pulse.last_7d || {};
  const wins = pulse.recent_wins || [];

  return (
    <div className="rounded-2xl border border-border-default bg-bg-surface overflow-hidden">
      <div className="px-5 py-4 border-b border-border-subtle flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-green" />
            <span className="text-[11px] uppercase tracking-[1.5px] text-text-muted font-medium">
              Trust Pulse · On-chain detections
            </span>
          </div>
          <p className="text-[12px] text-text-muted max-w-xl">
            Moves from ranked copy traders logged at detection, scored 24h later via CoinGecko.
          </p>
        </div>
        {pulse.pending_scoring > 0 && (
          <span className="text-[10px] px-2 py-1 rounded-full border border-amber/30 bg-amber/10 text-amber font-medium">
            {pulse.pending_scoring} pending score
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border-subtle">
        {[
          { label: 'Wins (24h)', value: d24.wins ?? 0, suffix: '', color: 'text-green' },
          { label: 'Hypo P&L (24h)', value: fmtUsd(d24.total_hypothetical_pnl_usd), raw: true, color: 'text-green' },
          { label: 'Avg win (24h)', value: d24.avg_win_return_pct ?? 0, suffix: '%', prefix: '+', color: 'text-green' },
          { label: 'Wins (7d)', value: d7.wins ?? 0, suffix: '', color: 'text-text-primary' },
        ].map(({ label, value, suffix = '', prefix = '', raw, color }) => (
          <div key={label} className="bg-bg-surface px-4 py-4">
            <div className="text-[10px] uppercase tracking-widest text-text-muted mb-2">{label}</div>
            <div className={`font-display text-2xl font-bold tabular-nums ${color}`}>
              {raw ? value : (
                <>
                  {prefix}
                  {typeof value === 'number' ? <AnimatedCounter value={value} decimals={suffix === '%' ? 1 : 0} /> : value}
                  {suffix}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {wins.length > 0 && (
        <div className="border-t border-border-subtle">
          <div className="px-5 py-2.5 text-[10px] uppercase tracking-widest text-text-muted bg-bg-overlay">
            Recent wins
          </div>
          {wins.slice(0, 6).map((win) => (
            <div
              key={win.tx_hash}
              className="flex items-center gap-3 px-5 py-3 border-b border-border-subtle last:border-0 hover:bg-bg-elevated/40 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-green shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-text-primary font-medium truncate">
                  {win.trader_label || 'Copy trader'} · {moveLabel(win)}
                </div>
                <div className="text-[10px] text-text-muted mt-0.5">
                  {relTime(win.detected_at)}
                  {win.amount_usd > 0 && <> · {fmtUsd(win.amount_usd)} move</>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-[13px] font-bold text-green">
                  +{Number(win.return_pct_24h ?? 0).toFixed(1)}%
                </div>
                {win.hypothetical_pnl_usd > 0 && (
                  <div className="text-[10px] text-text-muted font-mono">+{fmtUsd(win.hypothetical_pnl_usd)}</div>
                )}
              </div>
              {win.tx_hash && (
                <a
                  href={`https://etherscan.io/tx/${win.tx_hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors shrink-0"
                  aria-label="View on Etherscan"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="px-5 py-3 text-[10px] text-text-muted leading-relaxed border-t border-border-subtle">
        {pulse.methodology} Past results do not guarantee future performance. Not financial advice.
      </p>
    </div>
  );
}

export default function TrustPulse({ variant = 'full' }) {
  const [pulse, setPulse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api.getTrustPulse()
        .then((d) => { if (!cancelled) setPulse(d); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    load();
    const iv = setInterval(load, 60_000); // keep the ledger live, not mount-only
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  if (loading) {
    if (variant === 'compact') return null;
    return (
      <div className="rounded-2xl border border-border-default bg-bg-surface p-5 space-y-3">
        <SkeletonLine className="h-3 w-40" />
        <SkeletonLine className="h-8 w-full" />
      </div>
    );
  }

  if (!pulse) return null;

  const hasActivity =
    (pulse.last_24h?.detections ?? 0) > 0 ||
    (pulse.last_7d?.detections ?? 0) > 0 ||
    (pulse.pending_scoring ?? 0) > 0 ||
    (pulse.recent_wins?.length ?? 0) > 0;

  if (!hasActivity) {
    if (variant === 'compact') return null;
    return (
      <div className="rounded-2xl border border-border-default bg-bg-surface px-5 py-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-green" />
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-muted font-medium">
            Trust Pulse · Starting up
          </span>
        </div>
        <p className="text-[12px] text-text-muted leading-relaxed">
          Hadaleum is logging on-chain moves from ranked copy traders. Win stats appear here ~24h after each detection.
        </p>
      </div>
    );
  }

  if (variant === 'compact') return <CompactBanner pulse={pulse} />;
  return <FullCard pulse={pulse} />;
}
