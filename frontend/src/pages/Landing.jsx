import { useEffect } from 'react';
import { Link } from 'react-router-dom';

function EyeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="stroke-current text-green">
      <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3" strokeWidth="1.5" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="stroke-current text-green">
      <path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z" strokeWidth="1.5" />
      <path d="M19 16L19.9 18.6L22.5 19.5L19.9 20.4L19 23L18.1 20.4L15.5 19.5L18.1 18.6L19 16Z" strokeWidth="1.5" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="stroke-current text-green">
      <path d="M12 3C9.3 3 7.2 5.2 7.2 8V10.2C7.2 11.8 6.6 13.3 5.6 14.4L4.5 15.7H19.5L18.4 14.4C17.4 13.3 16.8 11.8 16.8 10.2V8C16.8 5.2 14.7 3 12 3Z" strokeWidth="1.5" />
      <path d="M9.5 17.5C9.8 18.8 10.8 19.5 12 19.5C13.2 19.5 14.2 18.8 14.5 17.5" strokeWidth="1.5" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="stroke-current text-green">
      <path d="M3 17L8 12L12 15L19 8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 8H19V11" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LightningIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="stroke-current text-green">
      <path d="M13 2L4 14H12L11 22L20 10H12L13 2Z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UnlockIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="stroke-current text-green">
      <rect x="3" y="11" width="18" height="11" rx="2" strokeWidth="1.5" />
      <path d="M7 11V7C7 4.8 8.8 3 11 3H12C14.2 3 16 4.8 16 7" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const FEATURES = [
  {
    icon: <EyeIcon />,
    title: '94 tracked wallets',
    body: 'Every major Ethereum whale, scored and ranked by trading intelligence. Not balance size.',
  },
  {
    icon: <SparkleIcon />,
    title: 'Claude-powered analysis',
    body: 'Every wallet analyzed by Claude AI. Bullish, bearish, or neutral — with the reasoning.',
  },
  {
    icon: <BellIcon />,
    title: 'Instant alerts',
    body: 'Set rules. Get notified the moment a whale changes signal or crosses your score threshold.',
  },
  {
    icon: <ChartIcon />,
    title: '0–100 intelligence score',
    body: 'Proprietary scoring based on activity, success rate, and recency. Not just balance.',
  },
  {
    icon: <LightningIcon />,
    title: 'Daily market brief',
    body: 'AI-generated morning note on what smart money is doing. Updated automatically.',
  },
  {
    icon: <UnlockIcon />,
    title: 'No paywall',
    body: 'Full watchlist, all signals, all alerts. Free while in beta.',
  },
];

const STATS = [
  '94 wallets tracked',
  'Real-time scanning',
  'AI-powered signals',
  'Free to use',
];

export default function LandingPage() {
  useEffect(() => {
    document.title = 'Sentinel AI — Ethereum Whale Intelligence';
  }, []);

  return (
    <div className="min-h-screen bg-bg-base text-text-primary font-body">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <path d="M11 1.6L18.7 6.1V15.9L11 20.4L3.3 15.9V6.1L11 1.6Z" fill="#00D992" />
          </svg>
          <span className="font-display text-[15px] font-bold tracking-[-0.5px] text-text-primary">SENTINEL</span>
          <span className="text-[9px] text-text-muted tracking-[1.5px] uppercase ml-1">AI</span>
        </div>
        <div className="flex items-center gap-6">
          <Link to="/" className="text-[13px] text-text-muted hover:text-text-secondary transition-colors">Watchlist</Link>
          <Link to="/intelligence" className="text-[13px] text-text-muted hover:text-text-secondary transition-colors">Intelligence</Link>
          <Link to="/scoring" className="text-[13px] text-text-muted hover:text-text-secondary transition-colors">Scoring</Link>
          <Link
            to="/"
            className="bg-green text-bg-base font-semibold text-[13px] px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            Open App →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="min-h-[calc(100vh-57px)] flex items-center">
        <div className="max-w-4xl mx-auto px-8 w-full py-20">
          <div className="text-[11px] uppercase tracking-[2px] text-green mb-4">
            Ethereum Whale Intelligence
          </div>
          <h1 className="font-display text-[52px] font-bold leading-[1.1] tracking-[-1px] text-text-primary mb-0">
            Know what smart<br />
            money does next.
          </h1>
          <p className="text-[18px] text-text-secondary leading-relaxed max-w-xl mt-4">
            Sentinel tracks 94 Ethereum whale wallets in real time.
            AI-powered signals, live scoring, and instant alerts —
            before the move happens.
          </p>

          {/* CTA row */}
          <div className="flex gap-3 mt-8">
            <Link
              to="/"
              className="bg-green text-bg-base font-semibold px-6 py-3 rounded-lg hover:opacity-90 transition-opacity text-[15px]"
            >
              View Watchlist →
            </Link>
            <Link
              to="/intelligence"
              className="border border-border-default text-text-secondary px-6 py-3 rounded-lg hover:bg-bg-elevated transition-colors text-[15px]"
            >
              See Intelligence
            </Link>
          </div>

          {/* Live stat strip */}
          <div className="flex gap-8 mt-12 pt-8 border-t border-border-subtle">
            {STATS.map((stat) => (
              <div key={stat} className="flex items-center gap-2 text-[13px] text-text-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-green flex-shrink-0" />
                {stat}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-8 border-t border-border-subtle">
        <div className="max-w-5xl mx-auto">
          <div className="text-[11px] uppercase tracking-widest text-green mb-3">Why Sentinel</div>
          <h2 className="font-display text-[36px] font-bold text-text-primary mb-16">
            Built for serious traders.
          </h2>
          <div className="grid grid-cols-3 gap-8">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="bg-bg-surface border border-border-subtle rounded-xl p-6 hover:border-border-default transition-colors"
              >
                <div className="mb-4">{feature.icon}</div>
                <div className="text-[15px] font-semibold text-text-primary mb-2">{feature.title}</div>
                <p className="text-[13px] text-text-secondary leading-relaxed">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-subtle py-8 px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <path d="M11 1.6L18.7 6.1V15.9L11 20.4L3.3 15.9V6.1L11 1.6Z" fill="#00D992" />
            </svg>
            <span className="font-display text-[13px] font-bold text-text-primary">SENTINEL</span>
            <span className="text-[9px] text-text-muted tracking-[1.5px] uppercase">AI</span>
            <span className="text-[12px] text-text-muted ml-3">
              © 2026 Sentinel AI. Built by Shazaib Amlani.
            </span>
          </div>
          <div className="flex items-center gap-6">
            {[
              { label: 'Watchlist', to: '/' },
              { label: 'Intelligence', to: '/intelligence' },
              { label: 'Scoring', to: '/scoring' },
              { label: 'Alerts', to: '/alerts' },
            ].map((link) => (
              <Link
                key={link.label}
                to={link.to}
                className="text-[12px] text-text-muted hover:text-text-secondary transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
