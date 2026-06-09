import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, getApiBase } from '../lib/apiClient';

const WATCHLIST_CACHE = 'sentinel-watchlist-v3';
const CACHE_TTL_MS = 120 * 1000;

function readWatchlistCache() {
  try {
    const raw = sessionStorage.getItem(WATCHLIST_CACHE);
    if (!raw) return null;
    const { ts, wallets } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return wallets;
  } catch {
    return null;
  }
}

function writeWatchlistCache(wallets) {
  try {
    sessionStorage.setItem(WATCHLIST_CACHE, JSON.stringify({ ts: Date.now(), wallets }));
  } catch { /* quota */ }
}

export function useWatchlist({ enabled = true } = {}) {
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const fetchedRef = useRef(false);

  const refetch = useCallback(async (opts = {}) => {
    if (!enabled) return;
    const silent = opts.silent;
    const cached = readWatchlistCache();

    if (cached?.length && !silent) {
      setWallets(cached);
      setLoading(false);
    } else if (!silent) {
      setLoading(true);
    }
    setError(null);

    try {
      // Fast path: no YTD tx fetch (avoids Supabase timeout). YTD loads on wallet detail open.
      const body = await apiFetch('/api/watchlist?limit=100&include_ytd=false', { timeoutMs: 20000 });
      if (!body.success) {
        throw new Error(body.error?.message || 'Failed to load watchlist');
      }
      const list = body.data?.wallets || [];
      setWallets(list);
      writeWatchlistCache(list);
      fetchedRef.current = true;
    } catch (e) {
      if (!cached?.length) {
        setError(e.message);
        setWallets([]);
      }
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    refetch();
  }, [enabled, refetch]);

  return { wallets, loading, error, refetch, apiBase: getApiBase() };
}

export function useScanWallet() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeAddress, setActiveAddress] = useState(null);
  const [stage, setStage] = useState('idle');

  const scan = async (address, label) => {
    setLoading(true);
    setError(null);
    setActiveAddress(address);
    setStage('fetching_onchain');
    try {
      const body = await apiFetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, label }),
        timeoutMs: 120000,
      });
      setStage('analyzing');
      if (!body.success) throw new Error(body.error?.message || 'Scan failed');
      setStage('complete');
      setResult(body.data);
      return body.data;
    } catch (e) {
      setStage('error');
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
      setTimeout(() => {
        setStage('idle');
        setActiveAddress(null);
      }, 1200);
    }
  };

  return { scan, loading, result, error, activeAddress, stage };
}

export function useIntelligence() {
  const [summary, setSummary] = useState(null);
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [summaryBody, signalsBody] = await Promise.all([
          apiFetch('/api/intelligence/summary', { timeoutMs: 30000 }),
          apiFetch('/api/intelligence/signals', { timeoutMs: 15000 }),
        ]);
        if (!cancelled) {
          setSummary(summaryBody.data?.summary ?? summaryBody.summary);
          setSignals(signalsBody.data?.signals || signalsBody.signals || []);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { summary, signals, loading, error };
}
