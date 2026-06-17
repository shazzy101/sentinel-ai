/**
 * PendingSignalRow — presentational row for one pending signal in the admin queue.
 * Props:
 *   signal  — the signal object
 *   onApprove(id) — called when Approve is clicked
 *   onReject(id)  — called when Reject is clicked
 */
import ConfidenceDots from '../signals/ConfidenceDots';

export default function PendingSignalRow({ signal, onApprove, onReject }) {
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
    pattern_type,
    created_at,
  } = signal;

  const dirColor = direction === 'long' ? 'text-signal' : 'text-loss';
  const dirLabel = direction === 'long' ? 'Long' : 'Short';

  const fmt = (v) =>
    v != null ? <span className="font-mono">{Number(v).toLocaleString()}</span> : <span className="text-text-muted">—</span>;

  const dateStr = created_at
    ? new Date(created_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
    : '—';

  return (
    <div
      className="border border-white/10 rounded-lg p-4 bg-white/5 space-y-3"
      data-testid={`pending-row-${id}`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-white text-sm">{asset}</span>
          <span className={`text-xs font-semibold uppercase ${dirColor}`}>{dirLabel}</span>
          <ConfidenceDots score={confidence} />
          {pattern_type && (
            <span className="text-xs text-text-muted border border-white/10 rounded px-1.5 py-0.5">
              {pattern_type}
            </span>
          )}
        </div>
        <span className="text-xs text-text-muted">{dateStr}</span>
      </div>

      {/* Price levels */}
      <div className="flex flex-wrap gap-4 text-xs">
        <div>
          <span className="text-text-muted">Entry: </span>
          {fmt(entry_low)}–{fmt(entry_high)}
        </div>
        <div>
          <span className="text-text-muted">Target: </span>
          {fmt(target)}
        </div>
        <div>
          <span className="text-text-muted">Stop: </span>
          {fmt(stop_loss)}
        </div>
      </div>

      {/* Explanation */}
      {explanation && (
        <p className="text-xs text-text-muted leading-relaxed">{explanation}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          data-testid={`approve-btn-${id}`}
          onClick={() => onApprove(id)}
          className="px-4 py-1.5 text-xs font-semibold rounded bg-signal/20 text-signal border border-signal/40 hover:bg-signal/30 transition-colors"
        >
          Approve
        </button>
        <button
          data-testid={`reject-btn-${id}`}
          onClick={() => onReject(id)}
          className="px-4 py-1.5 text-xs font-semibold rounded bg-loss/10 text-loss border border-loss/30 hover:bg-loss/20 transition-colors"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
