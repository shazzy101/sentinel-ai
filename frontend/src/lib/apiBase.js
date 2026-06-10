const DEV_API = 'http://127.0.0.1:8000';
const PROD_API = 'https://backend-production-250bf.up.railway.app';

/** Resolve backend base URL — never localhost in production builds. */
export function getApiBase() {
  const env = (import.meta.env.VITE_API_URL || '').trim();
  if (env) return env.replace(/\/$/, '');
  if (import.meta.env.DEV) return '';
  return PROD_API;
}

export function apiUrl(path) {
  return `${getApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
}
