/** Supabase auth redirect — must match URLs allowlisted in Supabase Auth settings. */
export function authCallbackUrl(next = '/watchlist') {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://hadaleum.com';
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}
