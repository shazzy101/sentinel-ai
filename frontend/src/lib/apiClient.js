/**
 * Shared API client — resolves base URL and enforces timeouts so UI never hangs.
 */

const DEV_API = 'http://127.0.0.1:8000';

export function getApiBase() {
  const env = (import.meta.env.VITE_API_URL || '').trim();
  if (env) return env.replace(/\/$/, '');
  // Dev: use relative URLs so Vite proxy forwards /api → backend
  if (import.meta.env.DEV) return '';
  // Production build without env: try local backend fallback
  return DEV_API;
}

export async function apiFetch(path, options = {}) {
  const { timeoutMs = 15000, ...fetchOpts } = options;
  const base = getApiBase();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...fetchOpts, signal: controller.signal });
    clearTimeout(timer);

    let body;
    try {
      body = await res.json();
    } catch {
      throw new Error(`Invalid JSON from ${path} (${res.status})`);
    }

    if (!res.ok) {
      const msg = body?.error?.message || body?.detail || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return body;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out — is the backend running at ${base || 'localhost:8000'}?`);
    }
    throw err;
  }
}

export async function apiGet(path, timeoutMs = 15000) {
  const body = await apiFetch(path, { timeoutMs });
  if (body.success === false) {
    throw new Error(body.error?.message || 'Request failed');
  }
  return body.data ?? body;
}
