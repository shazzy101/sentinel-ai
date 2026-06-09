import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/apiClient';

const CACHE_KEY = 'sentinel-copy-traders-v2';
const CACHE_TTL_MS = 5 * 60 * 1000;

function readCache(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch { /* quota */ }
}

export function useCopyTraders({
  enabled = true,
  limit = 50,
  sort = 'copy_score',
  qualifiedOnly = true,
  strict = false,
} = {}) {
  const [wallets, setWallets] = useState([]);
  const [totalQualified, setTotalQualified] = useState(0);
  const [totalInDataset, setTotalInDataset] = useState(0);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const cacheKey = `${CACHE_KEY}-${limit}-${sort}-${qualifiedOnly}-${strict}`;

  const refetch = useCallback(async (opts = {}) => {
    if (!enabled) return;
    const silent = opts.silent;
    const cached = readCache(cacheKey);

    if (!silent) setLoading(true);
    setError(null);

    if (cached?.wallets?.length) {
      setWallets(cached.wallets);
      setTotalQualified(cached.total_qualified || 0);
      setTotalInDataset(cached.total_in_dataset || 0);
      if (!silent) setLoading(false);
    }

    try {
      const params = new URLSearchParams({
        limit: String(limit),
        sort,
        qualified_only: String(qualifiedOnly),
        strict: String(strict),
      });
      const body = await apiFetch(`/api/copy-trading/top?${params}`, { timeoutMs: 15000 });
      if (!body.success) {
        throw new Error(body.error?.message || 'Failed to load copy traders');
      }
      const data = body.data || {};
      setWallets(data.wallets || []);
      setTotalQualified(data.total_qualified || 0);
      setTotalInDataset(data.total_in_dataset || 0);
      writeCache(cacheKey, data);
    } catch (e) {
      if (!cached?.wallets?.length) {
        setError(e.message);
        setWallets([]);
      }
    } finally {
      setLoading(false);
    }
  }, [cacheKey, enabled, limit, sort, qualifiedOnly, strict]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    refetch();
  }, [enabled, refetch]);

  return { wallets, totalQualified, totalInDataset, loading, error, refetch };
}
