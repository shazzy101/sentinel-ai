import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { HexLogo } from '@/components/ui/SentinelLogo';

/**
 * Handles Supabase email confirmation + OAuth redirects.
 * Must stay public (not behind AuthGuard) so tokens in the URL can be exchanged.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [message, setMessage] = useState('Confirming your account…');
  const [error, setError] = useState('');

  useEffect(() => { document.title = 'Confirming — Hadaleum'; }, []);

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      if (!supabase) {
        setError('Auth is not configured.');
        return;
      }

      const next = params.get('next') || '/watchlist';
      const hash = window.location.hash?.startsWith('#') ? window.location.hash.slice(1) : '';
      const hashParams = new URLSearchParams(hash);

      const hashError = hashParams.get('error_description') || hashParams.get('error');
      if (hashError) {
        setError(decodeURIComponent(hashError.replace(/\+/g, ' ')));
        return;
      }

      const code = params.get('code');
      if (code) {
        setMessage('Completing sign-in…');
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }
        navigate(next, { replace: true });
        return;
      }

      // Implicit / hash flow — detectSessionInUrl handles hash on init; give it a beat.
      await new Promise((r) => setTimeout(r, 400));
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (cancelled) return;
      if (sessionError) {
        setError(sessionError.message);
        return;
      }
      if (session) {
        navigate(next, { replace: true });
        return;
      }

      setError(
        'This confirmation link was already used or expired. Sign in with your email and password — your account may already be active.',
      );
    }

    finish();
    return () => { cancelled = true; };
  }, [navigate, params]);

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-4"><HexLogo size={36} /></div>
        {error ? (
          <>
            <h1 className="font-display text-xl font-bold text-text-primary mb-2">Couldn&apos;t confirm email</h1>
            <p className="text-[13px] text-red bg-red/10 border border-red/20 rounded-xl px-4 py-3 mb-4 leading-relaxed">
              {error}
            </p>
            <p className="text-[12px] text-text-muted mb-4 leading-relaxed">
              Email scanners sometimes open links once before you do — that uses the token.
              If you already confirmed, just sign in.
            </p>
            <Link to="/login" className="text-green text-sm font-medium hover:underline">
              Go to sign in →
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-display text-xl font-bold text-text-primary mb-2">Almost there</h1>
            <p className="text-[13px] text-text-muted">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}
