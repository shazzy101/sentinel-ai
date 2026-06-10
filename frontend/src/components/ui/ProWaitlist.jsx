import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X, Check } from 'lucide-react';
import { api } from '../../lib/api';

// Session-scoped so the "joined" state resets when the tab/window is fully
// closed — a fresh visit shows the waitlist CTA again (re-submits are safe,
// the backend upserts by unique email).
const JOINED_KEY = 'sentinel_pro_waitlist_joined';

const PRO_PERKS = [
  'Real-time AI signals on all 2,796 wallets',
  'Unlimited copy-trading & one-click execution',
  'Instant alerts (email + push)',
  'Full network intelligence + whale moves',
  'Priority AI chat with deeper analysis',
];

function WaitlistModal({ source, onClose, joined, onJoined }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(joined ? 'success' : 'idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const onEsc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      setStatus('error');
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await api.joinWaitlist(value, source || 'app');
      if (res?.success) {
        sessionStorage.setItem(JOINED_KEY, value);
        setStatus('success');
        onJoined?.();
      } else {
        setStatus('error');
        setErrorMsg(res?.error?.message || 'Something went wrong. Please try again.');
      }
    } catch {
      setStatus('error');
      setErrorMsg('Could not reach the server. Please try again.');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-bg-surface border border-border-default rounded-2xl shadow-2xl overflow-hidden">
        <button type="button" onClick={onClose} aria-label="Close"
          className="absolute right-3 top-3 text-text-muted hover:text-text-secondary">
          <X className="h-4 w-4" />
        </button>

        {status === 'success' ? (
          <div className="px-6 py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green/15 border border-green/30 mb-4">
              <Check className="h-6 w-6 text-green" />
            </div>
            <h3 className="font-display text-[18px] font-bold text-text-primary">You're on the list 🎉</h3>
            <p className="text-[13px] text-text-secondary mt-2 leading-relaxed">
              We'll email you the moment Hadaleum Pro opens. Early members get launch pricing.
            </p>
            <button type="button" onClick={onClose}
              className="mt-6 text-[12px] text-text-muted hover:text-text-secondary">Close</button>
          </div>
        ) : (
          <div className="px-6 py-6">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-green" />
              <span className="text-[11px] uppercase tracking-[1.5px] text-green font-semibold">Hadaleum Pro</span>
            </div>
            <h3 className="font-display text-[20px] font-bold text-text-primary leading-tight">
              Get early access to Pro
            </h3>
            <p className="text-[13px] text-text-muted mt-1.5">
              Join the waitlist for launch pricing. No card required.
            </p>

            <ul className="mt-4 space-y-2">
              {PRO_PERKS.map((perk) => (
                <li key={perk} className="flex items-start gap-2 text-[13px] text-text-secondary">
                  <Check className="h-4 w-4 text-green shrink-0 mt-0.5" />
                  {perk}
                </li>
              ))}
            </ul>

            <form onSubmit={submit} className="mt-5">
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (status === 'error') setStatus('idle'); }}
                placeholder="you@email.com"
                autoFocus
                className="w-full bg-bg-elevated border border-border-default rounded-xl px-3.5 py-3 text-[14px] text-text-primary placeholder:text-text-muted outline-none focus:border-border-focus transition-colors"
              />
              {status === 'error' && (
                <p className="text-[12px] text-red mt-2">{errorMsg}</p>
              )}
              <button
                type="submit"
                disabled={status === 'loading'}
                className="mt-3 w-full rounded-xl bg-green text-text-inverse font-semibold text-[14px] py-3 hover:bg-green-bright transition-colors disabled:opacity-60"
              >
                {status === 'loading' ? 'Joining…' : 'Join the waitlist →'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Pro waitlist trigger + modal. Variants:
 *  - 'sidebar' : compact upgrade button for the sidebar
 *  - 'button'  : standalone pill button
 *  - 'hero'    : large landing CTA button
 */
export default function ProWaitlist({ variant = 'button', source = 'app', className = '' }) {
  const [open, setOpen] = useState(false);
  const [joined, setJoined] = useState(() => !!sessionStorage.getItem(JOINED_KEY));

  const label = joined ? '✓ On the Pro waitlist' : 'Upgrade to Pro';

  const trigger = (() => {
    if (variant === 'sidebar') {
      return (
        <button type="button" onClick={() => setOpen(true)}
          className={`w-full flex items-center justify-center gap-1.5 rounded-xl border border-green/30 bg-green/10 px-3 py-2 text-[11px] font-semibold text-green hover:bg-green/15 transition-colors ${className}`}>
          <Sparkles className="h-3.5 w-3.5" />
          {joined ? 'Pro waitlist ✓' : 'Upgrade to Pro'}
        </button>
      );
    }
    if (variant === 'hero') {
      return (
        <button type="button" onClick={() => setOpen(true)}
          className={`inline-flex items-center gap-2 rounded-2xl bg-green text-text-inverse font-semibold text-base px-8 py-3.5 shadow-glow hover:bg-green-bright transition-colors ${className}`}>
          <Sparkles className="h-4 w-4" />
          {joined ? "You're on the Pro waitlist" : 'Get early access to Pro'}
        </button>
      );
    }
    return (
      <button type="button" onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-xl border border-green/30 bg-green/10 px-3 py-1.5 text-[12px] font-semibold text-green hover:bg-green/15 transition-colors ${className}`}>
        <Sparkles className="h-3.5 w-3.5" />
        {label}
      </button>
    );
  })();

  return (
    <>
      {trigger}
      {open && (
        <WaitlistModal
          source={source}
          joined={joined}
          onClose={() => setOpen(false)}
          onJoined={() => setJoined(true)}
        />
      )}
    </>
  );
}
