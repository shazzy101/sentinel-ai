import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moon, Sun, LogOut, Star, Mail, Shield, Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { useTheme } from '@/context/ThemeProvider';
import { useWallet } from '@/hooks/useWallet';
import { formatWalletAddress } from '@/lib/web3';
import Button from '../components/ui/Button';

const ALERT_PREF_KEY = 'hadaleum-pref-email-alerts';

function Section({ title, description, children }) {
  return (
    <section className="rounded-2xl border border-border-default bg-bg-surface/60 p-5">
      <div className="mb-4">
        <h2 className="font-display text-[15px] font-semibold text-text-primary">{title}</h2>
        {description && <p className="text-[12px] text-text-muted mt-0.5">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ icon: Icon, label, sub, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-bg-elevated text-text-secondary">
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </span>
        )}
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-text-primary truncate">{label}</div>
          {sub && <div className="text-[11px] text-text-muted truncate">{sub}</div>}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-green' : 'bg-bg-elevated border border-border-default'
      }`}
    >
      <span
        className={`inline-block transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
        style={{ height: 18, width: 18 }}
      />
    </button>
  );
}

export default function SettingsPage() {
  const auth = useAuth();
  const wallet = useWallet();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [emailAlerts, setEmailAlerts] = useState(() => {
    try { return localStorage.getItem(ALERT_PREF_KEY) !== 'off'; } catch { return true; }
  });

  useEffect(() => { document.title = 'Settings — Hadaleum'; }, []);

  useEffect(() => {
    try { localStorage.setItem(ALERT_PREF_KEY, emailAlerts ? 'on' : 'off'); } catch { /* ignore */ }
  }, [emailAlerts]);

  const planLabel = auth?.isPro
    ? 'Pro'
    : auth?.isTrialing
      ? `Trial · ${auth.trialDaysLeft}d left`
      : auth?.user ? 'Free' : 'Not signed in';

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-5 py-6 space-y-5">

        {/* Account */}
        <Section title="Account" description="Your Hadaleum profile and plan.">
          <div className="divide-y divide-border-subtle">
            <Row icon={Mail} label={auth?.user?.email || 'Guest session'} sub={auth?.user ? 'Signed in' : 'Sign in to sync your watchlist'}>
              <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
                auth?.isPro ? 'border-green/30 bg-green/10 text-green' : 'border-border-default bg-bg-elevated text-text-secondary'
              }`}>
                {planLabel}
              </span>
            </Row>
            <Row icon={Shield} label="Wallet" sub={wallet.isConnected ? 'Connected via MetaMask' : 'Not connected — non-custodial'}>
              {wallet.isConnected ? (
                <span className="font-mono text-[11px] text-text-secondary">{formatWalletAddress(wallet.address)}</span>
              ) : (
                <button
                  type="button"
                  onClick={wallet.connectWallet}
                  disabled={wallet.connecting}
                  className="text-[11px] text-green hover:underline disabled:opacity-50"
                >
                  {wallet.connecting ? 'Connecting…' : 'Connect'}
                </button>
              )}
            </Row>
          </div>
          {!auth?.isPro && auth?.user && (
            <Button variant="primary" className="mt-4 w-full" onClick={() => navigate('/upgrade')}>
              <Star className="h-3.5 w-3.5 mr-1.5" /> Upgrade to Pro
            </Button>
          )}
        </Section>

        {/* Appearance */}
        <Section title="Appearance" description="Choose how Hadaleum looks on this device.">
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { key: 'dark', label: 'Dark', icon: Moon },
              { key: 'light', label: 'Light', icon: Sun },
            ].map(({ key, label, icon: Icon }) => {
              const active = theme === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTheme(key)}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                    active
                      ? 'border-green/40 bg-green/10 text-text-primary'
                      : 'border-border-default bg-bg-elevated/50 text-text-secondary hover:border-border-strong'
                  }`}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? 'bg-green/15 text-green' : 'bg-bg-elevated text-text-muted'}`}>
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <span className="text-[13px] font-medium">{label}</span>
                  {active && <span className="ml-auto text-green text-[12px]">✓</span>}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Notifications */}
        <Section title="Notifications" description="Control how you hear about whale moves.">
          <div className="divide-y divide-border-subtle">
            <Row icon={Bell} label="Email alerts on signal flips" sub="Get notified when a tracked wallet changes direction">
              <Toggle checked={emailAlerts} onChange={setEmailAlerts} ariaLabel="Toggle email alerts" />
            </Row>
          </div>
        </Section>

        {/* Session */}
        {auth?.user ? (
          <Section title="Session">
            <button
              type="button"
              onClick={() => auth.signOut().then(() => navigate('/login'))}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red/25 bg-red/5 px-4 py-3 text-[13px] font-medium text-red hover:bg-red/10 transition-colors"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
              Sign out
            </button>
          </Section>
        ) : (
          <Section title="Session">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-green/25 bg-green/5 px-4 py-3 text-[13px] font-medium text-green hover:bg-green/10 transition-colors"
            >
              Sign in
            </button>
          </Section>
        )}

        <p className="text-center text-[11px] text-text-muted pt-2">
          Hadaleum · Not financial advice · <a href="/privacy" className="hover:text-text-secondary">Privacy</a> · <a href="/terms" className="hover:text-text-secondary">Terms</a>
        </p>
      </div>
    </div>
  );
}
