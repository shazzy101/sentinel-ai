/**
 * Shared API client — resolves base URL and enforces timeouts so UI never hangs.
 */

import { formatApiError, getAuthHeaders } from './authHeaders';
import { getApiBase } from './apiBase';

export { getApiBase, apiUrl } from './apiBase';

export async function apiFetch(path, options = {}) {
  const { timeoutMs = 15000, auth = false, ...fetchOpts } = options;
  const base = getApiBase();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = auth
    ? await getAuthHeaders(fetchOpts.headers || {})
    : { ...(fetchOpts.headers || {}) };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...fetchOpts, headers, signal: controller.signal });
    clearTimeout(timer);

    let body;
    try {
      body = await res.json();
    } catch {
      throw new Error(`Invalid JSON from ${path} (${res.status})`);
    }

    if (!res.ok || body.success === false) {
      const msg = formatApiError(body, body?.detail || `Request failed (${res.status})`);
      const err = new Error(msg);
      err.code = body?.error?.code;
      err.details = body?.error?.details;
      err.requestId = body?.request_id || body?.error?.details?.request_id;
      throw err;
    }
    return body;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out — is the backend running at ${base || 'localhost:8000'}?`);
    }
    if (err.message === 'Failed to fetch') {
      throw new Error(
        `Can't reach Hadaleum API${base ? ` (${base})` : ''}. Check your connection or try again in a moment.`,
      );
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
