import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import ConfidenceDots from './ConfidenceDots';
import OutcomeBadge from './OutcomeBadge';

/** Relative time formatter — no external dep required. */
function relativeTime(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (Number.isNaN(diff)) return '—';
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/** Format a numeric field — falls back to "—" for null/undefined. */
function fmt(value) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

/** Direction label + arrow. */
function DirectionLabel({ direction }) {
  if (direction === 'long') {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="text-signal font-mono" aria-label="long">↑</span>
        <span className="text-signal text-sm font-semibold">Long</span>
      </span>
    );
  }
  if (direction === 'short') {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="text-loss font-mono" aria-label="short">↓</span>
        <span className="text-loss text-sm font-semibold">Short</span>
      </span>
    );
  }
  return <span className="text-text-muted text-sm font-semibold">—</span>;
}

/**
 * SignalCard — full-detail card for a single trading signal.
 * Links to /signal/:id via react-router Link.
 * Border glow: win → signal green, loss → loss red, otherwise neutral.
 */
export default function SignalCard({ signal = {} }) {
  const {
    id,
    asset,
    direction,
    confidence,
    entry_low,
    entry_high,
    target,
    stop_loss,
    explanation,
    created_at,
    status,
  } = signal;

  const borderClass =
    status === 'win'
      ? 'border-signal/30 shadow-glow-signal'
      : status === 'loss'
        ? 'border-loss/30 shadow-glow-loss'
        : 'border-border-subtle';

  return (
    <Link
      to={`/signal/${id ?? ''}`}
      className={cn(
        'block rounded-2xl bg-bg-card border p-5 transition-shadow duration-300',
        'hover:shadow-card-hover',
        borderClass,
      )}
      data-signal-id={id}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-text-primary font-mono">{fmt(asset)}</span>
          <DirectionLabel direction={direction} />
        </div>
        <OutcomeBadge status={status} />
      </div>

      {/* Confidence */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[11px] text-text-muted uppercase tracking-wider">Confidence</span>
        <ConfidenceDots score={confidence} />
      </div>

      {/* Price levels */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Entry zone</p>
          <p className="text-sm font-mono text-text-primary">
            <span>{fmt(entry_low)}</span>
            {entry_low !== null && entry_low !== undefined && entry_high !== null && entry_high !== undefined
              ? <span className="text-text-muted mx-0.5">–</span>
              : null}
            <span>{fmt(entry_high)}</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Target</p>
          <p className="text-sm font-mono text-signal">{fmt(target)}</p>
        </div>
        <div>
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Stop loss</p>
          <p className="text-sm font-mono text-loss">{fmt(stop_loss)}</p>
        </div>
      </div>

      {/* Explanation */}
      {explanation ? (
        <p className="text-sm text-text-secondary leading-relaxed mb-3 line-clamp-3">{explanation}</p>
      ) : (
        <p className="text-sm text-text-muted mb-3">—</p>
      )}

      {/* Timestamp */}
      <p className="text-[11px] text-text-muted">{relativeTime(created_at)}</p>
    </Link>
  );
}
