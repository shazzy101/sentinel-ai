import { supabase } from './supabase';

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

