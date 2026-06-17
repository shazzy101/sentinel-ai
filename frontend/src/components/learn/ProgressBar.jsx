/**
 * ProgressBar — presentational progress indicator for Learn module screens.
 *
 * Props:
 *   current {number} — 0-based current step (screen index)
 *   total   {number} — total number of steps (screens)
 */
export default function ProgressBar({ current, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0

  return (
    <div
      className="w-full h-1.5 rounded-full bg-white/10"
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`Screen ${current} of ${total}`}
    >
      <div
        className="h-full rounded-full bg-signal transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
