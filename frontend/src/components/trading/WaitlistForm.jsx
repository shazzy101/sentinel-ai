import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { postTrading } from '@/hooks/useTradingData';

export default function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | done | error
  const [count, setCount] = useState(null);

  useEffect(() => {
    apiFetch('/api/trading/waitlist/count').then((r) => setCount(r.count)).catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault();
    setState('sending');
    try {
      const res = await postTrading('/api/trading/waitlist', { email });
      setCount(res.count);
      setState('done');
    } catch {
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
        You're on the list ✓ {count != null && <span className="opacity-70">· {count} signed up</span>}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="mb-2 text-sm font-semibold">Get the signals when this goes live</div>
      <p className="mb-3 text-xs text-text-muted">
        Following a verified, distributed edge — not hype. {count != null && `${count} already waiting.`}
      </p>
      <div className="flex gap-2">
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm outline-none"
        />
        <button type="submit" disabled={state === 'sending'}
                className="rounded-lg bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
          {state === 'sending' ? '…' : 'Join'}
        </button>
      </div>
      {state === 'error' && <div className="mt-2 text-xs text-red-400">Something went wrong — try again.</div>}
    </form>
  );
}
