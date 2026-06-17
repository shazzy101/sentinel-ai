/**
 * SignalFilters — presentational filter controls for the track record page.
 * Controlled component: all state lives in the parent.
 *
 * Props:
 *   filters  { asset, confidence, period, outcome }
 *   onChange (key, value) => void
 *   assets   string[]  — distinct asset names for the dropdown
 */

const PERIODS = [
  { value: 'all', label: 'All time' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
];

const OUTCOMES = [
  { value: 'all', label: 'All outcomes' },
  { value: 'win', label: 'Wins' },
  { value: 'loss', label: 'Losses' },
  { value: 'pending', label: 'Pending' },
];

const BASE_SELECT =
  'h-8 rounded-lg border border-border-default bg-bg-surface px-2.5 py-0 text-[12px] text-text-primary focus:outline-none focus:ring-1 focus:ring-green/40 cursor-pointer';

export default function SignalFilters({ filters = {}, onChange, assets = [] }) {
  function handle(key) {
    return (e) => onChange(key, e.target.value);
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="signal-filters">
      {/* Asset */}
      <select
        className={BASE_SELECT}
        value={filters.asset ?? 'all'}
        onChange={handle('asset')}
        aria-label="Filter by asset"
      >
        <option value="all">All assets</option>
        {assets.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>

      {/* Confidence */}
      <select
        className={BASE_SELECT}
        value={filters.confidence ?? 'all'}
        onChange={handle('confidence')}
        aria-label="Filter by confidence"
      >
        <option value="all">Any confidence</option>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>{n} dot{n !== 1 ? 's' : ''}</option>
        ))}
      </select>

      {/* Period */}
      <div className="flex gap-0.5 p-0.5 rounded-lg bg-bg-elevated border border-border-subtle">
        {PERIODS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange('period', value)}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors ${
              (filters.period ?? 'all') === value
                ? 'bg-green text-text-inverse'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Outcome */}
      <select
        className={BASE_SELECT}
        value={filters.outcome ?? 'all'}
        onChange={handle('outcome')}
        aria-label="Filter by outcome"
      >
        {OUTCOMES.map(({ value, label }) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
    </div>
  );
}
