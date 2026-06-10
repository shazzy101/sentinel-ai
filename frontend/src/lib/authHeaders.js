import { supabase } from './supabase';
import { getApiBase } from './apiBase';

/** Headers for authenticated API calls (optional Bearer JWT). */
export async function getAuthHeaders(extra = {}) {
  const headers = { ...extra };
  if (!headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
  }
  return headers;
}

/** Parse Sentinel API error payloads into a user-facing message. */
export function formatApiError(body, fallback = 'Something went wrong') {
  if (!body) return fallback;
  const err = body.error || body;
  const code = err.code || err.error_code;
  const message = err.message || body.detail || fallback;
  const details = err.details || {};
  const retry = details.retry_after_seconds;
  if (code === 'USER_ASK_LIMIT' || code === 'USER_TOKEN_LIMIT') {
    return `${message}${retry ? ` Try again in ${Math.ceil(retry / 60)} min.` : ''}`;
  }
  if (code === 'GLOBAL_AI_BUDGET') {
    return message;
  }
  if (code === 'RATE_LIMITED') {
    return `${message}${retry ? ` Retry in ${retry}s.` : ''}`;
  }
  return message;
}

/**
 * Stream Ask AI via SSE. Calls onDelta(text), onDone(payload), onError(message).
 */
export async function streamAskAi({ message, history, onDelta, onDone, onError, signal }) {
  const base = getApiBase();
  const url = `${base}/api/ask/stream`;
  const headers = await getAuthHeaders();

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message, history }),
    signal,
  });

  if (!res.ok) {
    let body;
    try {
      body = await res.json();
    } catch {
      throw new Error(`Ask AI failed (${res.status})`);
    }
    throw new Error(formatApiError(body));
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('Streaming not supported in this browser');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data:')) continue;
      let evt;
      try {
        evt = JSON.parse(line.slice(5).trim());
      } catch {
        continue;
      }
      if (evt.type === 'delta' && evt.text) onDelta?.(evt.text);
      if (evt.type === 'done') onDone?.(evt);
      if (evt.type === 'error') onError?.(evt.message || 'Stream error');
    }
  }
}
