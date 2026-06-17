import { useState } from 'react';
import { cn } from '@/lib/utils';
import ConfidenceDots from './ConfidenceDots';
import OutcomeBadge from './OutcomeBadge';
import { TableSkeleton } from '@/components/primitives/DataState';

/** Direction arrow + label */
function DirectionCell({ direction }) {
  if (direction === 'long') {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="text-signal font-mono">↑</span>
        <span className="text-signal text-xs font-semibold">Long</span>
      </span>
    );
  }
  if (direction === 'short') {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="text-loss font-mono">↓</span>
        <span className="text-loss text-xs font-semibold">Short</span>
      </span>
    );
  }
  return <span className="text-text-muted text-xs">—</span>;
}

/** Format a numeric value; fall back to "—" */
function mono(value) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

/** Format ISO date to short locale string */
function shortDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

const COLUMNS = [
  { key: 'asset', label: 'Asset', sortable: false },
  { key: 'direction', label: 'Direction', sortable: false },
  { key: 'confidence', label: 'Confidence', sortable: true },
  { key: 'entry', label: 'Entry zone', sortable: false },
  { key: 'target', label: 'Target', sortable: false },
  { key: 'stop_loss', label: 'Stop', sortable: false },
  { key: 'status', label: 'Status', sortable: false },
  { key: 'outcome_return', label: 'Return', sortable: false },
  { key: 'created_at', label: 'Date', sortable: true },
];

function SortIcon({ active, dir }) {
  if (!active) return <span className="text-text-muted opacity-30 ml-0.5">↕</span>;
  return <span className="text-text-primary ml-0.5">{dir === 'asc' ? '↑' : '↓'}</span>;
}

/**
 * SignalHistoryTable — presentational table of past signals.
 * Accepts { signals, loading } props — no data fetching.
 * Sortable by `confidence` and `created_at`.
 */
export default function SignalHistoryTable({ signals = [], loading = false }) {
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  function handleSort(key) {
    if (!COLUMNS.find((c) => c.key === key)?.sortable) return;
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sorted = [...signals].sort((a, b) => {
    let av, bv;
    if (sortKey === 'confidence') {
      av = a.confidence ?? 0;
      bv = b.confidence ?? 0;
    } else {
      // created_at — compare timestamps
      av = a.created_at ? new Date(a.created_at).getTime() : 0;
      bv = b.created_at ? new Date(b.created_at).getTime() : 0;
    }
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  if (loading) {
    return <TableSkeleton rows={8} cols={9} />;
  }

  if (sorted.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-text-muted">No signal history yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse" data-testid="signal-history-table">
        <thead>
          <tr className="border-b border-border-subtle">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'py-2.5 px-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted whitespace-nowrap',
                  col.sortable && 'cursor-pointer select-none hover:text-text-secondary transition-colors',
                )}
                onClick={() => col.sortable && handleSort(col.key)}
                aria-sort={
                  sortKey === col.key
                    ? sortDir === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
              >
                {col.label}
                {col.sortable && (
                  <SortIcon active={sortKey === col.key} dir={sortDir} />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((signal) => (
            <tr
              key={signal.id}
              className="border-b border-border-subtle last:border-0 hover:bg-bg-elevated/40 transition-colors"
              data-signal-id={signal.id}
            >
              <td className="py-3 px-3 font-mono font-bold text-text-primary text-xs whitespace-nowrap">
                {mono(signal.asset)}
              </td>
              <td className="py-3 px-3 whitespace-nowrap">
                <DirectionCell direction={signal.direction} />
              </td>
              <td className="py-3 px-3">
                {signal.confidence != null ? (
                  <ConfidenceDots score={signal.confidence} />
                ) : (
                  <span className="text-text-muted text-xs">—</span>
                )}
              </td>
              <td className="py-3 px-3 font-mono text-xs text-text-secondary whitespace-nowrap">
                {signal.entry_low != null && signal.entry_high != null
                  ? `${mono(signal.entry_low)}–${mono(signal.entry_high)}`
                  : signal.entry_low != null
                    ? mono(signal.entry_low)
                    : '—'}
              </td>
              <td className="py-3 px-3 font-mono text-xs text-signal whitespace-nowrap">
                {mono(signal.target)}
              </td>
              <td className="py-3 px-3 font-mono text-xs text-loss whitespace-nowrap">
                {mono(signal.stop_loss)}
              </td>
              <td className="py-3 px-3 whitespace-nowrap">
                <OutcomeBadge status={signal.status} />
              </td>
              <td className="py-3 px-3 font-mono text-xs whitespace-nowrap">
                {signal.outcome_return != null ? (
                  <span className={Number(signal.outcome_return) >= 0 ? 'text-signal' : 'text-loss'}>
                    {Number(signal.outcome_return) >= 0 ? '+' : ''}
                    {signal.outcome_return}%
                  </span>
                ) : (
                  <span className="text-text-muted">—</span>
                )}
              </td>
              <td className="py-3 px-3 text-xs text-text-muted whitespace-nowrap">
                {shortDate(signal.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
