import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';

/**
 * Poll a /api/trading endpoint on an interval. Returns { data, error, loading,
 * stale, lastUpdated, refresh }. `stale` flips true if no successful fetch in 2min.
 */
export function useTradingData(path, { intervalMs = 30000, enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const timer = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const body = await apiFetch(path, { timeoutMs: 12000 });
      setData(body);
      setError(null);
      setLastUpdated(Date.now());
    } catch (err) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    if (intervalMs > 0) {
      timer.current = setInterval(refresh, intervalMs);
      return () => clearInterval(timer.current);
    }
    return undefined;
  }, [refresh, intervalMs, enabled]);

  const stale = lastUpdated ? Date.now() - lastUpdated > 120000 : false;
  return { data, error, loading, stale, lastUpdated, refresh };
}

export async function postTrading(path, body) {
  return apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: 30000,
  });
}
