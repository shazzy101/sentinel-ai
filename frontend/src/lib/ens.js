import { useEffect, useState } from 'react';

// Reverse-resolves an Ethereum address to its ENS name using a public,
// key-less endpoint. Results are cached in-memory and in localStorage so
// we never hammer the API and names persist across sessions.

const DISK_KEY = 'hadaleum-ens-v1';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const memCache = new Map(); // address(lower) -> { name, ts }
const inflight = new Map(); // address(lower) -> Promise

function loadDisk() {
  try {
    const raw = localStorage.getItem(DISK_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDisk(map) {
  try { localStorage.setItem(DISK_KEY, JSON.stringify(map)); } catch { /* quota */ }
}

function cachedName(addr) {
  const key = addr.toLowerCase();
  if (memCache.has(key)) {
    const e = memCache.get(key);
    if (Date.now() - e.ts < TTL_MS) return e.name;
  }
  const disk = loadDisk();
  const e = disk[key];
  if (e && Date.now() - e.ts < TTL_MS) {
    memCache.set(key, e);
    return e.name;
  }
  return undefined; // undefined = unknown / not yet resolved
}

export function shortAddress(a) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—';
}

const GENERIC_LABEL = /^(dune\s+)?dex trader/i;
const GENERIC_LABEL_2 = /^(copy )?trader\s*#?/i;

/** True when a label is a generic placeholder we should not show to users. */
export function isGenericLabel(label) {
  const l = (label || '').trim().toLowerCase();
  if (!l) return true;
  if (l === 'unnamed wallet' || l === 'whale') return true;
  if (/^whale\s/i.test(l)) return true;
  return GENERIC_LABEL.test(l) || GENERIC_LABEL_2.test(l);
}

/**
 * Best display name for a trader/wallet:
 *  1. a resolved ENS name, else
 *  2. a real (non-placeholder) label from the backend, else
 *  3. a clean truncated address.
 */
export function traderDisplayName(wallet, ensName) {
  if (ensName) return ensName;
  const label = wallet?.label || '';
  if (!isGenericLabel(label)) return label;
  return shortAddress(wallet?.address);
}

export async function resolveEns(address) {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) return null;
  const key = address.toLowerCase();

  const cached = cachedName(key);
  if (cached !== undefined) return cached;

  if (inflight.has(key)) return inflight.get(key);

  const p = (async () => {
    try {
      const res = await fetch(`https://api.ensideas.com/ens/resolve/${key}`);
      if (!res.ok) throw new Error('ens lookup failed');
      const data = await res.json();
      const name = data?.name || null; // null = no reverse record
      const entry = { name, ts: Date.now() };
      memCache.set(key, entry);
      const disk = loadDisk();
      disk[key] = entry;
      saveDisk(disk);
      return name;
    } catch {
      // Cache a short-lived null so we don't retry on every render.
      memCache.set(key, { name: null, ts: Date.now() });
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}

/** React hook: returns the ENS name for an address (or null), resolving lazily. */
export function useEnsName(address) {
  const [name, setName] = useState(() => {
    if (!address) return null;
    const c = cachedName(address.toLowerCase());
    return c === undefined ? null : c;
  });

  useEffect(() => {
    let cancelled = false;
    if (!address) { setName(null); return; }
    const c = cachedName(address.toLowerCase());
    if (c !== undefined) { setName(c); return; }
    resolveEns(address).then((n) => { if (!cancelled) setName(n); });
    return () => { cancelled = true; };
  }, [address]);

  return name;
}
