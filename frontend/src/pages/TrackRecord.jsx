import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../lib/apiClient';
import { signalsToCsv, downloadCsv } from '../lib/exportCsv';
import AnimatedCounter from '../components/primitives/AnimatedCounter';
import SignalHistoryTable from '../components/signals/SignalHistoryTable';
import SignalFilters from '../components/trust/SignalFilters';
import SentinelLogo from '../components/ui/SentinelLogo';
import MagneticButton from '../components/primitives/MagneticButton';
import { SkeletonBlock } from '../components/primitives/DataState';

// ─── Exact tagline required by spec ────────────────────────────────────────
export const TAGLINE = 'Every signal was posted publicly before the move. Blockchain verified.';

// ─── Pure helpers (exported for testing) ───────────────────────────────────

/**
 * Filter signals by asset, confidence, period, and outcome.
 * Pure — no side effects.
 *
 * @param {Object[]} signals
 * @param {{ asset?: string, confidence?: string|number, period?: string, outcome?: string }} filters
 * @returns {Object[]}
 */
export function applyFilters(signals, filters = {}) {
  const { asset, confidence, period, outcome } = filters;
  const now = Date.now();

  return signals.filter((s) => {
    // Asset filter
    if (asset && asset !== 'all') {
      if (s.asset !== asset) return false;
    }

    // Confidence filter
    if (confidence && confidence !== 'all') {
      if (s.confidence !== Number(confidence)) return false;
    }

    // Period filter
    if (period && period !== 'all') {
      const created = s.created_at ? new Date(s.created_at).getTime() : 0;
      const msMap = { '24h': 86_400_000, '7d': 7 * 86_400_000, '30d': 30 * 86_400_000 };
      const cutoff = msMap[period];
      if (cutoff && now - created > cutoff) return false;
    }

    // Outcome filter
    if (outcome && outcome !== 'all') {
      if (outcome === 'pending') {
        // pending = not win, not loss
        if (s.status === 'win' || s.status === 'loss') return false;
      } else {
        if (s.status !== outcome) return false;
      }
    }

    return true;
  });
}

/**
 * Compute summary stats from a signal array.
 * Pure — no side effects.
 *
 * Returns:
 *   winRate        number (0-100) | null
 *   bestSignal     Object | null  (highest outcome_return)
 *   worstSignal    Object | null  (lowest outcome_return)
 *   avgByTier      { 1: number|null, 2: number|null, …, 5: number|null }
 *
 * @param {Object[]} signals
 */
export function computeStats(signals) {
  const decisive = signals.filter(
    (s) => (s.status === 'win' || s.status === 'loss') && s.outcome_return != null,
  );
  const wins = decisive.filter((s) => s.status === 'win');

  const winRate = decisive.length > 0 ? (wins.length / decisive.length) * 100 : null;

  const withReturn = signals.filter((s) => s.outcome_return != null);

  let bestSignal = null;
  let worstSignal = null;
  if (withReturn.length > 0) {
    bestSignal = withReturn.reduce(
      (best, s) => (Number(s.outcome_return) > Number(best.outcome_return) ? s : best),
      withReturn[0],
    );
    worstSignal = withReturn.reduce(
      (worst, s) => (Number(s.outcome_return) < Number(worst.outcome_return) ? s : worst),
      withReturn[0],
    );
  }

  // Average outcome_return per confidence tier (1-5), only for signals with outcome_return
  const avgByTier = {};
  for (let tier = 1; tier <= 5; tier++) {
    const tiered = withReturn.filter((s) => s.confidence === tier);
    if (tiered.length === 0) {
      avgByTier[tier] = null;
    } else {
      const sum = tiered.reduce((acc, s) => acc + Number(s.outcome_return), 0);
      avgByTier[tier] = sum / tiered.length;
    }
  }

  return { winRate, bestSignal, worstSignal, avgByTier };
}

// ─── Sub-components ────────────────────────────────────────────────────────

function StatCard({ label, value, suffix = '', prefix = '', decimals = 1, color = 'text-text-primary', sub }) {
  const isNumber = typeof value === 'number' && !Number.isNaN(value);
  return (
    <div className="rounded-2xl border border-border-default bg-bg-surface p-5 flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[1.4px] text-text-muted">{label}</span>
      <span className={`font-display text-3xl font-bold tabular-nums ${color}`}>
        {prefix}
        {isNumber ? (
          <AnimatedCounter value={value} decimals={decimals} />
        ) : (
          value ?? '—'
        )}
        {isNumber ? suffix : ''}
      </span>
      {sub && <span className="text-[11px] text-text-muted">{sub}</span>}
    </div>
  );
}

function TierTable({ avgByTier }) {
  const tiers = [1, 2, 3, 4, 5];
  const hasAny = tiers.some((t) => avgByTier[t] != null);
  if (!hasAny) return null;

  return (
    <div className="rounded-2xl border border-border-default bg-bg-surface overflow-hidden">
      <div className="px-5 py-3 border-b border-border-subtle">
        <span className="text-[11px] uppercase tracking-[1.4px] text-text-muted font-medium">
          Avg return by confidence tier
        </span>
      </div>
      <div className="divide-y divide-border-subtle">
        {tiers.map((tier) => {
          const avg = avgByTier[tier];
          const isPos = avg != null && avg >= 0;
          return (
            <div key={tier} className="flex items-center justify-between px-5 py-3">
              <span className="text-[12px] text-text-secondary">
                {tier} dot{tier !== 1 ? 's' : ''}
              </span>
              <span
                className={`font-mono text-[13px] font-bold ${
                  avg == null ? 'text-text-muted' : isPos ? 'text-signal' : 'text-loss'
                }`}
              >
                {avg == null
                  ? '—'
                  : `${isPos ? '+' : ''}${avg.toFixed(1)}%`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Default filter state ──────────────────────────────────────────────────

const DEFAULT_FILTERS = { asset: 'all', confidence: 'all', period: 'all', outcome: 'all' };

// ─── Page ──────────────────────────────────────────────────────────────────

export default function TrackRecordPage() {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  useEffect(() => {
    document.title = 'Track Record — Hadaleum';
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSignals() {
      try {
        // Try primary endpoint first, fall back to secondary
        let body;
        try {
          body = await apiFetch('/api/signals?limit=500');
        } catch {
          body = await apiFetch('/api/intelligence/signals');
        }
        const rows = body?.data ?? body?.signals ?? body ?? [];
        if (!cancelled) setSignals(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setSignals([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSignals();
    return () => { cancelled = true; };
  }, []);

  // Distinct assets for filter dropdown
  const assets = useMemo(() => {
    const seen = new Set();
    signals.forEach((s) => { if (s.asset) seen.add(s.asset); });
    return [...seen].sort();
  }, [signals]);

  // Apply client-side filters
  const filteredSignals = useMemo(() => applyFilters(signals, filters), [signals, filters]);

  // Compute stats over ALL signals (not filtered) for the headline stats section,
  // but use filteredSignals for best/worst to respect the active filter context.
  const stats = useMemo(() => computeStats(signals), [signals]);
  const filteredStats = useMemo(() => computeStats(filteredSignals), [filteredSignals]);

  function handleFilterChange(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function handleExport() {
    downloadCsv('hadaleum-track-record.csv', signalsToCsv(filteredSignals));
  }

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Minimal public nav */}
      <nav className="border-b border-border-subtle px-6 py-4 flex items-center justify-between max-w-5xl mx-auto">
        <Link to="/" className="flex items-center gap-2 text-text-primary hover:opacity-80 transition-opacity">
          <SentinelLogo size={22} />
          <span className="font-display font-semibold text-[15px]">Hadaleum</span>
        </Link>
        <MagneticButton
          type="button"
          onClick={() => { window.location.href = '/signup'; }}
          className="bg-green text-text-inverse text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-green-bright transition-colors"
        >
          Get started →
        </MagneticButton>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-green/25 bg-green/[0.08] px-3 py-1 mb-6">
            <ShieldCheck className="h-3.5 w-3.5 text-green" />
            <span className="text-[11px] font-medium text-green uppercase tracking-wide">
              Verified public record
            </span>
          </div>

          <h1 className="font-display text-4xl md:text-5xl font-bold text-text-primary tracking-tight mb-3">
            Track Record
          </h1>

          {/* Required tagline — exact string */}
          <p className="text-[15px] text-text-muted max-w-2xl leading-relaxed" data-testid="tagline">
            {TAGLINE}
          </p>
        </div>

        {/* Headline stats */}
        {loading ? (
          <SkeletonBlock rows={2} className="mb-10" />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            <StatCard
              label="Overall win rate"
              value={stats.winRate != null ? stats.winRate : null}
              suffix="%"
              decimals={0}
              color="text-signal"
              sub={`${signals.filter((s) => s.status === 'win').length}W · ${signals.filter((s) => s.status === 'loss').length}L`}
            />
            <StatCard
              label="Total signals"
              value={signals.length}
              decimals={0}
            />
            <StatCard
              label="Best return"
              value={stats.bestSignal?.outcome_return != null ? Number(stats.bestSignal.outcome_return) : null}
              suffix="%"
              prefix={stats.bestSignal?.outcome_return != null && Number(stats.bestSignal.outcome_return) >= 0 ? '+' : ''}
              color="text-signal"
              sub={stats.bestSignal?.asset}
            />
            <StatCard
              label="Worst return"
              value={stats.worstSignal?.outcome_return != null ? Number(stats.worstSignal.outcome_return) : null}
              suffix="%"
              color="text-loss"
              sub={stats.worstSignal?.asset}
            />
          </div>
        )}

        {/* Per-tier table */}
        {!loading && <div className="mb-10"><TierTable avgByTier={stats.avgByTier} /></div>}

        {/* Filters + export */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <SignalFilters
            filters={filters}
            onChange={handleFilterChange}
            assets={assets}
          />
          <button
            type="button"
            onClick={handleExport}
            data-testid="export-csv-button"
            className="flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-1.5 rounded-lg border border-border-default bg-bg-surface hover:bg-bg-elevated transition-colors text-text-secondary"
          >
            <Download className="h-3.5 w-3.5" />
            Export to CSV
          </button>
        </div>

        {/* Signal count for filtered view */}
        {!loading && filters !== DEFAULT_FILTERS && (
          <p className="text-[11px] text-text-muted mb-3">
            Showing {filteredSignals.length} of {signals.length} signals
          </p>
        )}

        {/* Table */}
        <div className="rounded-2xl border border-border-default bg-bg-surface overflow-x-auto mb-12">
          <SignalHistoryTable signals={filteredSignals} loading={loading} />
        </div>

        {/* Footer disclaimer */}
        <p className="text-[11px] text-text-muted leading-relaxed border-t border-border-subtle pt-6">
          All signals were published on-chain before market moves. Past results do not guarantee future
          performance. Not financial advice. Win rate calculated over decisive (win/loss) outcomes only.
        </p>
      </div>
    </div>
  );
}
