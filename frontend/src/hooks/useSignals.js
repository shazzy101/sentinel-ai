import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../lib/apiClient';
import { supabase } from '../lib/supabase';

/**
 * Normalise a raw signal from either the future /api/signals endpoint or
 * the legacy /api/intelligence/signals endpoint into a full signal shape.
 */
export function normaliseSignal(raw) {
  // Future /api/signals shape — has direction field
  if (raw.direction !== undefined) {
    return {
      id: raw.id ?? raw.signal_id ?? `${raw.asset}-${raw.created_at}`,
      signal_number: raw.signal_number ?? null,
      asset: raw.asset ?? raw.symbol ?? '???',
      direction: raw.direction, // 'long' | 'short' | 'neutral'
      confidence: raw.confidence ?? null,
      entry_low: raw.entry_low ?? null,
      entry_high: raw.entry_high ?? null,
      target: raw.target ?? null,
      stop_loss: raw.stop_loss ?? null,
      explanation: raw.explanation ?? null,
      status: raw.status ?? 'pending_review',
      outcome_return: raw.outcome_return ?? null,
      created_at: raw.created_at ?? null,
    };
  }

  // Legacy /api/intelligence/signals shape — uses BULLISH/BEARISH/NEUTRAL
  const signalMap = { BULLISH: 'long', BEARISH: 'short', NEUTRAL: 'neutral' };
  const direction = signalMap[raw.signal] ?? raw.signal?.toLowerCase() ?? 'neutral';

  let status = raw.status ?? 'pending_review';
  if (!status || status === 'unknown') {
    if (raw.outcome === 'win') status = 'win';
    else if (raw.outcome === 'loss') status = 'loss';
    else if (raw.signal === 'BULLISH' || raw.signal === 'BEARISH') status = 'active';
    else status = 'pending_review';
  }

  return {
    id: raw.id ?? raw.wallet_address ?? raw.address ?? `${raw.asset ?? raw.name}-${raw.updated_at}`,
    signal_number: raw.signal_number ?? null,
    asset: raw.asset ?? raw.name ?? raw.wallet_address ?? '???',
    direction,
    confidence: raw.confidence ?? null,
    entry_low: raw.entry_low ?? null,
    entry_high: raw.entry_high ?? null,
    target: raw.target ?? null,
    stop_loss: raw.stop_loss ?? null,
    explanation: raw.signal_reason ?? raw.explanation ?? null,
    status,
    outcome_return: raw.outcome_return ?? null,
    created_at: raw.created_at ?? raw.generated_at ?? null,
  };
}

/**
 * useSignals — fetches all signals and subscribes to Supabase realtime for live updates.
 *
 * Strategy:
 *  1. Fetch from GET /api/signals (future endpoint); on 404/error fall back to
 *     GET /api/intelligence/signals (always available).
 *  2. Subscribe to Supabase realtime channel on the `signals` table for INSERT/UPDATE.
 *     If Supabase is unavailable, fall back to polling every 30 s.
 *  3. Cleans up subscription + polling interval on unmount.
 *
 * Returns { signals, loading, error }
 */
export function useSignals() {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollTimerRef = useRef(null);
  const channelRef = useRef(null);

  async function fetchSignals(silent = false) {
    if (!silent) setLoading(true);
    setError(null);

    let raw = [];
    try {
      const body = await apiFetch('/api/signals', { timeoutMs: 8000 });
      raw = body.data?.signals ?? body.signals ?? [];
    } catch {
      // Fallback to intelligence signals endpoint
      try {
        const body = await apiFetch('/api/intelligence/signals', { timeoutMs: 15000 });
        raw = body.data?.signals ?? body.signals ?? [];
      } catch (e) {
        setError(e.message);
        if (!silent) setLoading(false);
        return;
      }
    }

    setSignals(raw.map(normaliseSignal));
    if (!silent) setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    async function init() {
      await fetchSignals(false);
      if (cancelled) return;

      if (supabase) {
        // Attempt Supabase realtime subscription
        try {
          const channel = supabase
            .channel('signals-live')
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'signals' },
              (payload) => {
                if (cancelled) return;
                if (payload.eventType === 'INSERT') {
                  setSignals((prev) => {
                    const normalised = normaliseSignal(payload.new);
                    // De-duplicate by id
                    const exists = prev.some((s) => s.id === normalised.id);
                    if (exists) return prev;
                    return [normalised, ...prev];
                  });
                } else if (payload.eventType === 'UPDATE') {
                  setSignals((prev) =>
                    prev.map((s) =>
                      s.id === payload.new.id ? normaliseSignal(payload.new) : s,
                    ),
                  );
                }
              },
            )
            .subscribe((status) => {
              if (status === 'CHANNEL_ERROR' && !cancelled) {
                // Realtime failed — fall back to polling
                startPolling();
              }
            });

          channelRef.current = channel;
        } catch {
          startPolling();
        }
      } else {
        // No Supabase client — poll every 30 s
        startPolling();
      }
    }

    function startPolling() {
      if (pollTimerRef.current) return; // already polling
      pollTimerRef.current = setInterval(() => {
        if (!cancelled) fetchSignals(true);
      }, 30_000);
    }

    init();

    return () => {
      cancelled = true;
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { signals, loading, error };
}
