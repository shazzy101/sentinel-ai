import { useEffect } from 'react';
import { Link } from 'react-router-dom';

function EyeIcon() {
  return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00D992" strokeWidth="1.5">
      <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00D992" strokeWidth="1.5">
      <path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z" />
      <path d="M19 16L19.9 18.6L22.5 19.5L19.9 20.4L19 23L18.1 20.4L15.5 19.5L18.1 18.6L19 16Z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00D992" strokeWidth="1.5">
      <path d="M12 3C9.3 3 7.2 5.2 7.2 8V10.2C7.2 11.8 6.6 13.3 5.6 14.4L4.5 15.7H19.5L18.4 14.4C17.4 13.3 16.8 11.8 16.8 10.2V8C16.8 5.2 14.7 3 12 3Z" />
      <path d="M9.5 17.5C9.8 18.8 10.8 19.5 12 19.5C13.2 19.5 14.2 18.8 14.5 17.5" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00D992" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17L8 12L12 15L19 8" />
      <path d="M16 8H19V11" />
    </svg>
  );
}

function LightningIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00D992" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L4 14H12L11 22L20 10H12L13 2Z" />
    </svg>
  );
}

function UnlockIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00D992" strokeWidth="1.5">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7C7 4.8 8.8 3 11 3H12C14.2 3 16 4.8 16 7" strokeLinecap="round" />
    </svg>
  );
}

const STATS = ['94 wallets tracked', 'Real-time scanning', 'AI-powered signals', 'Free to use'];

const NAV_LINKS = [
  { label: 'Watchlist', to: '/' },
  { label: 'Intelligence', to: '/intelligence' },
  { label: 'Scoring', to: '/scoring' },
  { label: 'Alerts', to: '/alerts' },
];

export default function LandingPage() {
  useEffect(() => {
    document.title = 'Sentinel AI — Ethereum Whale Intelligence';
  }, []);

  const features = [
    { Icon: EyeIcon, title: '94 tracked wallets', body: 'Every major Ethereum whale, scored and ranked by trading intelligence. Not balance size.' },
    { Icon: SparkleIcon, title: 'Claude-powered analysis', body: 'Every wallet analyzed by Claude AI. Bullish, bearish, or neutral — with the reasoning.' },
    { Icon: BellIcon, title: 'Instant alerts', body: 'Set rules. Get notified the moment a whale changes signal or crosses your score threshold.' },
    { Icon: ChartIcon, title: '0–100 intelligence score', body: 'Proprietary scoring based on activity, success rate, and recency. Not just balance.' },
    { Icon: LightningIcon, title: 'Daily market brief', body: 'AI-generated morning note on what smart money is doing. Updated automatically.' },
    { Icon: UnlockIcon, title: 'No paywall', body: 'Full watchlist, all signals, all alerts. Free while in beta.' },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#09090B', color: '#EEEDF0', fontFamily: 'Inter, sans-serif' }}>

      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', borderBottom: '1px solid #1E1E26' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M11 1.6L18.7 6.1V15.9L11 20.4L3.3 15.9V6.1L11 1.6Z" fill="#00D992" />
          </svg>
          <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: 700, letterSpacing: '-0.5px', color: '#EEEDF0' }}>SENTINEL</span>
          <span style={{ fontSize: '9px', color: '#4A4A5E', letterSpacing: '1.5px', textTransform: 'uppercase', marginLeft: '4px' }}>AI</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {NAV_LINKS.map((l) => (
            <Link key={l.label} to={l.to} style={{ fontSize: '13px', color: '#4A4A5E', textDecoration: 'none' }}>{l.label}</Link>
          ))}
          <Link to="/" style={{ background: '#00D992', color: '#09090B', fontWeight: 600, fontSize: '13px', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none' }}>
            Open App →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ minHeight: 'calc(100vh - 57px)', display: 'flex', alignItems: 'center' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '80px 32px', width: '100%' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px', color: '#00D992', marginBottom: '16px' }}>
            Ethereum Whale Intelligence
          </div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '52px', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-1px', color: '#EEEDF0', margin: 0 }}>
            Know what smart<br />money does next.
          </h1>
          <p style={{ fontSize: '18px', color: '#8B8A9B', lineHeight: 1.7, maxWidth: '520px', marginTop: '16px' }}>
            Sentinel tracks 94 Ethereum whale wallets in real time.
            AI-powered signals, live scoring, and instant alerts —
            before the move happens.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
            <Link to="/" style={{ background: '#00D992', color: '#09090B', fontWeight: 600, fontSize: '15px', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', display: 'inline-block' }}>
              View Watchlist →
            </Link>
            <Link to="/intelligence" style={{ border: '1px solid #28283A', color: '#8B8A9B', fontSize: '15px', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', display: 'inline-block' }}>
              See Intelligence
            </Link>
          </div>

          {/* Stats strip */}
          <div style={{ display: 'flex', gap: '32px', marginTop: '48px', paddingTop: '32px', borderTop: '1px solid #1E1E26' }}>
            {STATS.map((stat) => (
              <div key={stat} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#4A4A5E' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00D992', flexShrink: 0, display: 'inline-block' }} />
                {stat}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section style={{ padding: '96px 32px', borderTop: '1px solid #1E1E26' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '4px', color: '#00D992', marginBottom: '12px' }}>Why Sentinel</div>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '36px', fontWeight: 700, color: '#EEEDF0', marginBottom: '64px', marginTop: 0 }}>
            Built for serious traders.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px' }}>
            {features.map(({ Icon, title, body }) => (
              <div key={title} style={{ background: '#0F0F12', border: '1px solid #1E1E26', borderRadius: '12px', padding: '24px' }}>
                <div style={{ marginBottom: '16px' }}><Icon /></div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#EEEDF0', marginBottom: '8px' }}>{title}</div>
                <p style={{ fontSize: '13px', color: '#8B8A9B', lineHeight: 1.6, margin: 0 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #1E1E26', padding: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
            <path d="M11 1.6L18.7 6.1V15.9L11 20.4L3.3 15.9V6.1L11 1.6Z" fill="#00D992" />
          </svg>
          <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '13px', fontWeight: 700, color: '#EEEDF0' }}>SENTINEL</span>
          <span style={{ fontSize: '9px', color: '#4A4A5E', letterSpacing: '1.5px', textTransform: 'uppercase' }}>AI</span>
          <span style={{ fontSize: '12px', color: '#4A4A5E', marginLeft: '12px' }}>© 2026 Sentinel AI. Built by Shazaib Amlani.</span>
        </div>
        <div style={{ display: 'flex', gap: '24px' }}>
          {NAV_LINKS.map((l) => (
            <Link key={l.label} to={l.to} style={{ fontSize: '12px', color: '#4A4A5E', textDecoration: 'none' }}>{l.label}</Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
