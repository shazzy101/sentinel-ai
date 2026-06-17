import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/apiClient';
import { normaliseSignal } from './useSignals';

/**
 * useSignal(id) — fetches a single signal by ID.
 *
 * GETs /api/signals/:id via apiFetch.
 * The endpoint is built in a later task; 404 / network errors are handled
 * gracefully — signal is set to null and error is populated.
 *
 * Returns { signal, loading, error }
 *   signal — normalised full signal shape, or null
 *   loading — boolean
 *   error   — error message string, or null
 */
export function useSignal(id) {
  const [signal, setSignal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('No signal ID provided');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSignal(null);

    apiFetch(`/api/signals/${id}`, { timeoutMs: 10000 })
      .then((body) => {
        if (cancelled) return;
        const raw = body.data ?? body;
        // Normalise: augment with on-chain fields that normaliseSignal may not carry
        const base = normaliseSignal(raw);
        setSignal({
          ...base,
          whale_wallets: raw.whale_wallets ?? [],
          tx_hashes: raw.tx_hashes ?? [],
          pattern_type: raw.pattern_type ?? null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message ?? 'Failed to load signal');
        setSignal(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return { signal, loading, error };
}
