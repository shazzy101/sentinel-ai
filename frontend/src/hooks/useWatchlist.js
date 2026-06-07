import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function parseResponse(res) {
  const body = await res.json();
  if (!body.success) {
    const msg = body.error?.message || 'Request failed';
    throw new Error(msg);
  }
  return body.data;
}

export function useWatchlist() {
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/watchlist`);
      const data = await parseResponse(res);
      setWallets(data.wallets || []);
    } catch (e) {
      setError(e.message);
      setWallets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { wallets, loading, error, refetch };
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
      const res = await fetch(`${API_BASE}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, label }),
      });
      setStage('analyzing');
      const data = await parseResponse(res);
      setStage('complete');
      setResult(data);
      return data;
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
        const [summaryRes, signalsRes] = await Promise.all([
          fetch(`${API_BASE}/api/intelligence/summary`),
          fetch(`${API_BASE}/api/intelligence/signals`),
        ]);
        const summaryData = await parseResponse(summaryRes);
        const signalsData = await parseResponse(signalsRes);
        if (!cancelled) {
          setSummary(summaryData.summary);
          setSignals(signalsData.signals || []);
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
