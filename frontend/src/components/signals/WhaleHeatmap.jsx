import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';

/* ─── Pure helper ─────────────────────────────────────────── */

/**
 * bucketMoves — groups an array of move objects into a 2-D
 * hour (0-23) × asset grid and computes per-cell USD volume + the max.
 *
 * Accepts flexible field names to tolerate both endpoints:
 *   - asset: move.asset | move.bought | move.token | move.symbol
 *   - timestamp: move.timestamp | move.time | move.created_at
 *   - usdValue: move.usdValue | move.amount_usd | move.usd_value | move.value_usd
 *
 * Returns:
 *   {
 *     assets: string[],         // sorted unique asset symbols
 *     cells: { [asset]: { [hour]: number } },   // usd total per cell
 *     max: number,              // highest single-cell value (for scaling)
 *   }
 */
export function bucketMoves(moves) {
  if (!Array.isArray(moves) || moves.length === 0) {
    return { assets: [], cells: {}, max: 0 };
  }

  const cells = {};
  const assetSet = new Set();

  for (const move of moves) {
    // resolve asset
    const asset =
      move.asset || move.bought || move.token || move.symbol || 'UNKNOWN';

    // resolve timestamp → hour (0–23)
    const ts = move.timestamp || move.time || move.created_at;
    let hour = null;
    if (ts != null) {
      if (typeof ts === 'number') {
        // unix seconds vs ms: if < 1e12 it's seconds
        const ms = ts > 1e12 ? ts : ts * 1000;
        hour = new Date(ms).getUTCHours();
      } else {
        const d = new Date(ts);
        if (!Number.isNaN(d.getTime())) hour = d.getUTCHours();
      }
    }
    // explicit hour field overrides
    if (move.hour != null && hour === null) {
      hour = Number(move.hour);
    }
    if (hour === null || hour < 0 || hour > 23) continue;

    // resolve usd value
    const usd = Number(
      move.usdValue ?? move.amount_usd ?? move.usd_value ?? move.value_usd ?? 0,
    );
    if (!Number.isFinite(usd) || usd <= 0) continue;

    assetSet.add(asset);
    if (!cells[asset]) cells[asset] = {};
    cells[asset][hour] = (cells[asset][hour] || 0) + usd;
  }

  let max = 0;
  for (const assetCells of Object.values(cells)) {
    for (const v of Object.values(assetCells)) {
      if (v > max) max = v;
    }
  }

  const assets = [...assetSet].sort();
  return { assets, cells, max };
}

/* ─── Presentational grid ─────────────────────────────────── */

const HOURS = Array.from({ length: 24 }, (_, i) => i);

/** Format a USD volume compactly for the legend */
function fmtUsd(v) {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

/** Compute cell background color: signal green at varying opacity */
function cellStyle(value, max) {
  if (!value || max === 0) return {};
  // Clamp intensity 0.08–1.0 so even small values are faintly visible
  const t = Math.min(value / max, 1);
  const opacity = 0.08 + t * 0.92;
  return {
    backgroundColor: `rgba(0, 255, 136, ${opacity.toFixed(3)})`,
    // Brighter cells get a subtle text shadow for readability
    boxShadow: t > 0.5 ? '0 0 6px rgba(0, 255, 136, 0.35)' : undefined,
  };
}

/**
 * WhaleHeatmapGrid — fully presentational.
 *
 * Props:
 *   assets  string[]
 *   cells   { [asset]: { [hour]: number } }
 *   max     number
 */
export function WhaleHeatmapGrid({ assets, cells, max }) {
  if (assets.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <div
        style={{
          display: 'grid',
          // col 0 = asset label, col 1-24 = hourly buckets
          gridTemplateColumns: `56px repeat(24, minmax(22px, 1fr))`,
          gap: '2px',
        }}
        role="grid"
        aria-label="Whale activity heatmap"
      >
        {/* Header row — hour labels */}
        <div style={{ gridColumn: '1' }} />
        {HOURS.map((h) => (
          <div
            key={h}
            className="text-[9px] font-mono text-text-muted text-center leading-none pb-1"
            style={{ gridColumn: `${h + 2}` }}
            role="columnheader"
          >
            {String(h).padStart(2, '0')}
          </div>
        ))}

        {/* Asset rows */}
        {assets.map((asset) => (
          <div key={asset} style={{ display: 'contents' }}>
            {/* Asset label */}
            <div
              className="text-[10px] font-mono text-text-secondary flex items-center pr-1 truncate"
              style={{ gridColumn: '1' }}
              role="rowheader"
            >
              {asset}
            </div>

            {/* Hour cells */}
            {HOURS.map((h) => {
              const val = cells[asset]?.[h] || 0;
              return (
                <div
                  key={h}
                  className="rounded-[3px] cursor-default transition-opacity"
                  style={{
                    gridColumn: `${h + 2}`,
                    height: '20px',
                    backgroundColor: val > 0
                      ? cellStyle(val, max).backgroundColor
                      : 'rgba(255, 255, 255, 0.04)',
                    boxShadow: val > 0 ? cellStyle(val, max).boxShadow : undefined,
                  }}
                  title={val > 0 ? `${asset} ${String(h).padStart(2, '0')}:00 UTC — ${fmtUsd(val)}` : undefined}
                  data-testid={`cell-${asset}-${h}`}
                  role="gridcell"
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Skeleton ────────────────────────────────────────────── */
function HeatmapSkeleton() {
  return (
    <div className="space-y-2 px-1" data-testid="whale-heatmap-skeleton">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className="h-3 w-12 rounded animate-pulse bg-white/[0.06]" />
          <div className="flex-1 h-5 rounded animate-pulse bg-white/[0.06]" />
        </div>
      ))}
    </div>
  );
}

/* ─── Legend ──────────────────────────────────────────────── */
function HeatmapLegend({ max }) {
  if (max === 0) return null;
  const stops = [0.08, 0.3, 0.55, 0.8, 1.0];
  return (
    <div className="flex items-center gap-2 mt-3">
      <span className="text-[9px] text-text-muted uppercase tracking-wider">Volume</span>
      <div className="flex items-center gap-0.5">
        {stops.map((t) => (
          <div
            key={t}
            className="h-3 w-5 rounded-sm"
            style={{ backgroundColor: `rgba(0,255,136,${(0.08 + t * 0.92).toFixed(2)})` }}
          />
        ))}
      </div>
      <span className="text-[9px] font-mono text-text-muted">{fmtUsd(max)}</span>
    </div>
  );
}

/* ─── Normalize API response → moves array ────────────────── */
function normalizeLargeTrades(body) {
  const data = body?.data ?? body;
  // /api/network/large-trades → { trades: [...] }
  // /api/copy-trading/recent-moves → { moves: [...] }
  const raw = data?.trades || data?.moves || [];
  return raw;
}

/* ─── Container with data fetching ───────────────────────── */
function useWhaleMoves() {
  const [moves, setMoves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const body = await apiFetch('/api/network/large-trades', { timeoutMs: 10000 });
        if (!cancelled) setMoves(normalizeLargeTrades(body));
      } catch {
        // Fallback to recent-moves
        try {
          const body = await apiFetch('/api/copy-trading/recent-moves?limit=50', {
            timeoutMs: 10000,
          });
          if (!cancelled) setMoves(normalizeLargeTrades(body));
        } catch {
          // Silently fail — empty state handles it
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { moves, loading };
}

/* ─── Public component ────────────────────────────────────── */

/**
 * WhaleHeatmap
 *
 * Self-contained: fetches from /api/network/large-trades (falls back to
 * /api/copy-trading/recent-moves), buckets into hour × asset, renders grid.
 *
 * Also accepts explicit props to skip fetching:
 *   moves   - raw moves array (bypasses fetch when provided)
 *   loading - loading state (used when moves is provided externally)
 */
export default function WhaleHeatmap({ moves: movesProp, loading: loadingProp } = {}) {
  const fetched = useWhaleMoves();

  // If caller passes moves prop, use that; otherwise use fetched
  const moves = movesProp !== undefined ? movesProp : fetched.moves;
  const loading = loadingProp !== undefined ? loadingProp : fetched.loading;

  const { assets, cells, max } = bucketMoves(moves);
  const isEmpty = !loading && assets.length === 0;

  return (
    <div
      className="rounded-2xl bg-bg-card border border-border-subtle p-4"
      data-testid="whale-heatmap"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[13px] font-semibold text-text-primary">Whale Activity</h3>
          <p className="text-[10px] text-text-muted mt-0.5">
            Large wallet moves · last 24 h · UTC hours
          </p>
        </div>
      </div>

      {loading ? (
        <HeatmapSkeleton />
      ) : isEmpty ? (
        <div
          className="py-10 text-center text-[12px] text-text-muted leading-relaxed"
          data-testid="whale-heatmap-empty"
        >
          No large whale moves detected in the last 24 hours.
        </div>
      ) : (
        <>
          <WhaleHeatmapGrid assets={assets} cells={cells} max={max} />
          <HeatmapLegend max={max} />
        </>
      )}
    </div>
  );
}
