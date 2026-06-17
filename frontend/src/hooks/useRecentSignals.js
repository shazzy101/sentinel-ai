import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/apiClient';

/**
 * Normalise a raw signal object from either endpoint into a consistent shape.
 */
function normaliseSignal(raw) {
  // /api/signals shape (future endpoint)
  if (raw.direction !== undefined) {
    return {
      id: raw.id ?? raw.signal_id ?? `${raw.asset}-${raw.created_at}`,
      asset: raw.asset ?? raw.symbol ?? '???',
      direction: raw.direction, // 'long' | 'short' | 'neutral'
      status: raw.status ?? 'pending_review',
    };
  }

  // /api/intelligence/signals shape — BULLISH/BEARISH/NEUTRAL signal field
  const signalMap = { BULLISH: 'long', BEARISH: 'short', NEUTRAL: 'neutral' };
  const direction = signalMap[raw.signal] ?? raw.signal?.toLowerCase() ?? 'neutral';

  // Map active/pending/win/loss status from various field shapes
  let status = raw.status ?? 'pending_review';
  if (!status || status === 'unknown') {
    // Some shapes expose outcome directly
    if (raw.outcome === 'win') status = 'win';
    else if (raw.outcome === 'loss') status = 'loss';
    else if (raw.signal === 'BULLISH' || raw.signal === 'BEARISH') status = 'active';
    else status = 'pending_review';
  }

  return {
    id: raw.id ?? raw.wallet_address ?? raw.address ?? `${raw.asset ?? raw.name}-${raw.updated_at}`,
    asset: raw.asset ?? raw.name ?? raw.wallet_address ?? '???',
    direction,
    status,
  };
}

/**
 * Fetches the most recent N signals.
 * Tries GET /api/signals?limit=<n> first; falls back to GET /api/intelligence/signals
 * on any 404 or network error.
 *
 * Returns { signals, loading, error }
 */
export function useRecentSignals(limit = 5) {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      let raw = [];
      try {
        // Primary: dedicated signals endpoint (built in a later task)
        const body = await apiFetch(`/api/signals?limit=${limit}`, { timeoutMs: 8000 });
        raw = body.data?.signals ?? body.signals ?? [];
      } catch {
        // Fallback: intelligence signals endpoint (always available)
        try {
          const body = await apiFetch('/api/intelligence/signals', { timeoutMs: 15000 });
          raw = body.data?.signals ?? body.signals ?? [];
        } catch (e) {
          if (!cancelled) setError(e.message);
        }
      }

      if (!cancelled) {
        setSignals(raw.slice(0, limit).map(normaliseSignal));
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [limit]);

  return { signals, loading, error };
}
