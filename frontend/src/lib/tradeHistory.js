const STORAGE_KEY = 'sentinel-trade-history';

export function loadTradeHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveTrade(record) {
  const history = loadTradeHistory();
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    status: 'pending',
    ...record,
  };
  const next = [entry, ...history].slice(0, 50);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('sentinel-trade-updated', { detail: entry }));
  return entry;
}

export function updateTrade(id, patch) {
  const history = loadTradeHistory();
  const next = history.map((t) => (t.id === id ? { ...t, ...patch } : t));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('sentinel-trade-updated'));
  return next;
}

export function getTradeByHash(txHash) {
  return loadTradeHistory().find((t) => t.txHash === txHash);
}
