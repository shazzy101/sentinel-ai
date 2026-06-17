/**
 * OutcomeBadge — maps signal status to a labelled badge.
 * win        → "Win"     signal green + shadow-glow-signal
 * loss       → "Loss"    loss red     + shadow-glow-loss
 * active / pending_review / pending → "Active" / "Pending" muted
 */
const STATUS_MAP = {
  win: {
    label: 'Win',
    cls: 'bg-signal/10 text-signal border-signal/20 shadow-glow-signal',
  },
  loss: {
    label: 'Loss',
    cls: 'bg-loss/10 text-loss border-loss/20 shadow-glow-loss',
  },
  active: {
    label: 'Active',
    cls: 'bg-text-muted/10 text-text-muted border-text-muted/20',
  },
  pending_review: {
    label: 'Pending',
    cls: 'bg-text-muted/10 text-text-muted border-text-muted/20',
  },
  pending: {
    label: 'Pending',
    cls: 'bg-text-muted/10 text-text-muted border-text-muted/20',
  },
};

export default function OutcomeBadge({ status }) {
  const { label, cls } = STATUS_MAP[status] ?? STATUS_MAP.pending_review;

  return (
    <span
      className={`inline-flex items-center text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${cls}`}
      data-status={status}
    >
      {label}
    </span>
  );
}
