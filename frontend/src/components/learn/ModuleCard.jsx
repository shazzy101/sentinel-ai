/**
 * ModuleCard — presentational card for a single Learn module.
 *
 * Props:
 *   module     {object}   — a module from LEARN_MODULES
 *   completed  {boolean}  — whether the user has completed this module
 *   onStart    {function} — called when the user clicks Start/Review
 */
export default function ModuleCard({ module, completed = false, onStart }) {
  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-bg-card p-5 transition-colors duration-200 hover:border-white/[0.14]"
      data-testid={`module-card-${module.id}`}
    >
      {/* Module number + completion indicator */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
          Module {module.id}
        </span>
        {completed && (
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full bg-signal/10 text-signal text-xs font-mono"
            aria-label="Completed"
            data-testid="module-completed-indicator"
          >
            ✓
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-text-primary text-[15px] font-semibold leading-snug">
        {module.title}
      </h3>

      {/* Description */}
      <p className="text-text-secondary text-sm leading-relaxed flex-1">
        {module.description}
      </p>

      {/* Unlocks label */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
          Unlocks
        </span>
        <span className="text-[10px] font-mono text-signal tracking-wide">
          {module.unlocksFeature.replace(/_/g, ' ')}
        </span>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={() => onStart?.(module.id)}
        className={
          completed
            ? 'mt-1 rounded-xl border border-signal/30 px-4 py-2 text-sm font-medium text-signal transition-all duration-200 hover:bg-signal/10'
            : 'mt-1 rounded-xl bg-signal px-4 py-2 text-sm font-medium text-text-inverse transition-all duration-200 hover:brightness-110'
        }
        aria-label={completed ? `Review module ${module.id}` : `Start module ${module.id}`}
      >
        {completed ? 'Review' : 'Start'}
      </button>
    </div>
  )
}
