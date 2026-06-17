import { motion } from 'motion/react';
import { useRecentSignals } from '../../hooks/useRecentSignals';

/* ─── Direction arrow ─────────────────────────────────── */
function DirectionArrow({ direction }) {
  if (direction === 'long') return <span className="text-signal font-mono" aria-label="long">↑</span>;
  if (direction === 'short') return <span className="text-loss font-mono" aria-label="short">↓</span>;
  return <span className="text-text-muted font-mono" aria-label="neutral">—</span>;
}

/* ─── Outcome badge ───────────────────────────────────── */
function OutcomeBadge({ status }) {
  const cfg = {
    win:            { label: 'WIN',     cls: 'bg-signal/10 text-signal border-signal/20' },
    loss:           { label: 'LOSS',    cls: 'bg-loss/10 text-loss border-loss/20' },
    active:         { label: 'ACTIVE',  cls: 'bg-text-muted/10 text-text-muted border-text-muted/20' },
    pending_review: { label: 'PENDING', cls: 'bg-text-muted/10 text-text-muted border-text-muted/20' },
  };
  const { label, cls } = cfg[status] ?? cfg.pending_review;
  return (
    <span
      className={`inline-flex items-center text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${cls}`}
      data-status={status}
    >
      {label}
    </span>
  );
}

/* ─── Single ticker card ──────────────────────────────── */
function TickerItem({ asset, direction, status }) {
  return (
    <div className="flex-shrink-0 flex items-center gap-2.5 bg-bg-card border border-border-subtle rounded-xl px-4 py-2.5 min-w-[160px]">
      <span className="text-[13px] font-semibold text-text-primary font-mono tabular-nums">{asset}</span>
      <DirectionArrow direction={direction} />
      <OutcomeBadge status={status} />
    </div>
  );
}

/* ─── Skeleton card ───────────────────────────────────── */
function SkeletonItem() {
  return (
    <div
      className="flex-shrink-0 flex items-center gap-2.5 bg-bg-card border border-border-subtle rounded-xl px-4 py-2.5 min-w-[160px] animate-pulse"
      aria-hidden="true"
      data-testid="signal-skeleton"
    >
      <div className="h-3 w-20 rounded bg-bg-elevated" />
      <div className="h-3 w-4 rounded bg-bg-elevated" />
      <div className="h-3 w-12 rounded bg-bg-elevated" />
    </div>
  );
}

/* ─── Presentational ticker (accepts props — testable) ── */
export function SignalTickerDisplay({ signals, loading }) {
  const items = loading
    ? Array.from({ length: 5 })
    : signals;

  // Duplicate for seamless loop
  const doubled = [...items, ...items];

  return (
    <div
      className="w-full overflow-hidden border-b border-border-subtle bg-bg-base py-2.5"
      aria-label="Live signal ticker"
      role="region"
    >
      <div className="flex items-center justify-center gap-2 mb-2">
        <span className="inline-flex rounded-full h-1.5 w-1.5 bg-signal/70 flex-shrink-0" />
        <span className="text-[9px] uppercase tracking-[2.5px] text-signal/70 font-mono">Live signals</span>
      </div>

      <div className="relative">
        <div
          className="flex gap-3"
          style={{ animation: 'ticker-scroll 28s linear infinite', width: 'max-content' }}
        >
          {doubled.map((item, i) =>
            loading ? (
              <SkeletonItem key={i} />
            ) : (
              <TickerItem
                key={`${item?.id ?? i}-${i}`}
                asset={item.asset}
                direction={item.direction}
                status={item.status}
              />
            )
          )}
        </div>
        {/* Fade edges */}
        <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-bg-base to-transparent pointer-events-none z-10" />
        <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-bg-base to-transparent pointer-events-none z-10" />
      </div>
    </div>
  );
}

/* ─── Container: wires hook → display ────────────────── */
export default function SignalTicker() {
  const { signals, loading } = useRecentSignals(5);
  return <SignalTickerDisplay signals={signals} loading={loading} />;
}
