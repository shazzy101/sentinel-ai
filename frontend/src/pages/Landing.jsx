import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

/* ─── Static mock data for the animated product preview ─── */
const MOCK_ROWS = [
  { name: 'Wintermute',   addr: '0x3f5c…d60', score: 89, signal: 'BULLISH' },
  { name: 'Jump Trading', addr: '0x28c6…a28', score: 76, signal: 'NEUTRAL' },
  { name: 'Paradigm',     addr: '0xd551…4ff', score: 82, signal: 'BULLISH' },
  { name: 'a16z Crypto',  addr: '0x4e9c…a67', score: 71, signal: 'NEUTRAL' },
  { name: 'Dragonfly',    addr: '0x564…ced', score: 63, signal: 'BEARISH' },
];

const COMPARISON_ROWS = [
  { feature: 'Whale wallet tracking',     sentinel: '✓',            nansenVal: '✓',            nansenGood: true },
  { feature: 'AI signal analysis',        sentinel: '✓ Claude 4',   nansenVal: '✓ Basic',       nansenGood: true },
  { feature: 'Intelligence score 0–100',  sentinel: '✓',            nansenVal: '✗',            nansenGood: false },
  { feature: 'Exchange wallet filtering', sentinel: '✓',            nansenVal: '✗',            nansenGood: false },
  { feature: 'Free tier',                 sentinel: '✓ Full access', nansenVal: '✗ $150/mo',    nansenGood: false },
  { feature: 'Real-time alerts',          sentinel: '✓',            nansenVal: '✓',            nansenGood: true },
  { feature: 'Daily AI market brief',     sentinel: '✓',            nansenVal: '✗',            nansenGood: false },
  { feature: 'Pure ETH focus',            sentinel: '✓',            nansenVal: '✗ Multi-chain', nansenGood: false },
  { feature: 'No ads, no upsells',        sentinel: '✓',            nansenVal: '✗',            nansenGood: false },
];

/* ─── Helpers ─────────────────────────────────────────── */
function SignalChip({ signal }) {
  const cls = {
    BULLISH: 'bg-green-dim border-green-border text-green',
    BEARISH: 'bg-red-dim border-red-border text-red',
    NEUTRAL: 'bg-amber-dim border-amber-border text-amber',
  }[signal] || 'bg-amber-dim border-amber-border text-amber';
  const dot = { BULLISH: 'bg-green', BEARISH: 'bg-red', NEUTRAL: 'bg-amber' }[signal] || 'bg-amber';
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${cls}`}>
      <span className={`w-1 h-1 rounded-full ${dot}`} />
      {signal}
    </span>
  );
}

function HexLogo({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" className="flex-shrink-0">
      <path d="M11 1.6L18.7 6.1V15.9L11 20.4L3.3 15.9V6.1L11 1.6Z" fill="#00D992" />
    </svg>
  );
}

/* ─── Animated browser mockup ─────────────────────────── */
function ProductMockup() {
  const [loaded, setLoaded] = useState(false);
  const [row2Signal, setRow2Signal] = useState('NEUTRAL');
  const [scanningRow, setScanningRow] = useState(-1);

  useEffect(() => {
    const t1 = setTimeout(() => setLoaded(true), 200);
    const t2 = setTimeout(() => setRow2Signal('BULLISH'), 3000);
    let idx = 0;
    const iv = setInterval(() => { setScanningRow(idx % 5); idx++; }, 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearInterval(iv); };
  }, []);

  const rows = MOCK_ROWS.map((r, i) => ({
    ...r,
    signal: i === 1 ? row2Signal : r.signal,
  }));

  return (
    <div className="max-w-5xl mx-auto bg-bg-surface border border-border-default rounded-2xl overflow-hidden">
      {/* Browser bar */}
      <div className="h-10 bg-bg-overlay border-b border-border-subtle flex items-center px-4 gap-2">
        <span className="w-3 h-3 rounded-full bg-red/70" />
        <span className="w-3 h-3 rounded-full bg-amber/70" />
        <span className="w-3 h-3 rounded-full bg-green/70" />
        <div className="flex-1 mx-4 bg-bg-elevated rounded px-3 py-1 text-[11px] text-text-muted font-mono text-center select-none">
          sentinel-ai.pages.dev/watchlist
        </div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[28px_1fr_64px_88px_110px] gap-x-3 px-4 py-2 bg-bg-surface border-b border-border-default text-[9px] uppercase tracking-[1.2px] text-text-muted">
        <div>#</div><div>Wallet</div><div>Score</div><div>Signal</div><div>Balance</div>
      </div>

      {/* Rows */}
      {rows.map((row, i) => (
        <div
          key={row.name}
          className={`grid grid-cols-[28px_1fr_64px_88px_110px] gap-x-3 px-4 py-2.5 border-b border-border-subtle last:border-0 transition-all duration-300 ${
            scanningRow === i ? 'border-l-2 border-l-green bg-green/5' : 'border-l-2 border-l-transparent'
          }`}
        >
          <div className="text-[10px] text-text-muted font-mono self-center">{i + 1}</div>
          <div className="self-center min-w-0">
            <div className="text-[12px] font-medium text-text-primary truncate">{row.name}</div>
            <div className="text-[9px] text-text-muted font-mono">{row.addr}</div>
          </div>
          <div className="self-center">
            <div className="h-[2px] bg-bg-elevated rounded-full mb-1 overflow-hidden">
              <div
                className={row.score >= 80 ? 'h-full bg-green rounded-full' : row.score >= 60 ? 'h-full bg-amber rounded-full' : 'h-full bg-red rounded-full'}
                style={{ width: loaded ? `${row.score}%` : '0%', transition: `width 0.9s ease ${i * 0.15}s` }}
              />
            </div>
            <span className={`text-[11px] font-mono font-bold ${row.score >= 80 ? 'text-green' : row.score >= 60 ? 'text-amber' : 'text-red'}`}>
              {row.score}
            </span>
          </div>
          <div className="self-center">
            <SignalChip signal={row.signal} />
          </div>
          <div className="self-center text-[10px] font-mono text-text-secondary">
            {[1247.52, 856.14, 3120, 2450, 445.22][i].toLocaleString(undefined, { minimumFractionDigits: 2 })} ETH
          </div>
        </div>
      ))}

      <div className="px-4 py-2 bg-bg-overlay flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
        <span className="text-[10px] text-text-muted font-mono">
          {scanningRow >= 0 ? `scanning ${rows[scanningRow]?.name}...` : 'live • 94 wallets tracked'}
        </span>
      </div>
    </div>
  );
}

/* ─── Feature block visuals ───────────────────────────── */
function WatchlistVisual() {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setLoaded(true); }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="bg-bg-surface border border-border-default rounded-xl overflow-hidden">
      {[{ name: 'Wintermute', score: 89 }, { name: 'Paradigm', score: 82 }, { name: 'Jump Trading', score: 76 }, { name: 'a16z Crypto', score: 71 }, { name: 'Dragonfly', score: 63 }]
        .map((w, i) => (
          <div key={w.name} className="flex items-center gap-3 px-4 py-2.5 border-b border-border-subtle last:border-0">
            <div className="text-[10px] text-text-muted font-mono w-4">{i + 1}</div>
            <div className="flex-1 min-w-0 text-[12px] font-medium text-text-primary truncate">{w.name}</div>
            <div className="flex items-center gap-2 w-24">
              <div className="flex-1 h-[2px] bg-bg-elevated rounded-full overflow-hidden">
                <div
                  className={w.score >= 80 ? 'h-full bg-green rounded-full' : 'h-full bg-amber rounded-full'}
                  style={{ width: loaded ? `${w.score}%` : '0%', transition: `width 0.8s ease ${i * 0.12}s` }}
                />
              </div>
              <span className={`text-[11px] font-mono font-bold flex-shrink-0 ${w.score >= 80 ? 'text-green' : 'text-amber'}`}>{w.score}</span>
            </div>
          </div>
        ))}
    </div>
  );
}

function IntelligenceVisual() {
  const [signal, setSignal] = useState('NEUTRAL');
  const [typedText, setTypedText] = useState('');
  const fullText = 'Significant accumulation detected across 3 correlated whale wallets. High conviction positioning ahead of macro event.';
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        setTimeout(() => setSignal('BULLISH'), 1200);
        let i = 0;
        const iv = setInterval(() => {
          i++;
          setTypedText(fullText.slice(0, i));
          if (i >= fullText.length) clearInterval(iv);
        }, 28);
      }
    }, { threshold: 0.4 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="bg-bg-surface border border-border-default rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-[1.2px] text-text-muted">Wintermute</span>
        <SignalChip signal={signal} />
      </div>
      <p className="text-[12px] text-text-secondary leading-relaxed min-h-[48px]">
        {typedText}<span className="animate-pulse">|</span>
      </p>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[10px] text-text-muted">Risk:</span>
        <span className="text-[10px] font-bold text-green uppercase">LOW</span>
        <span className="text-[10px] text-text-muted ml-auto">Score: 89</span>
      </div>
    </div>
  );
}

function AlertVisual() {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setTimeout(() => setVisible(true), 600);
    }, { threshold: 0.4 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="bg-bg-surface border border-border-default rounded-xl p-4">
        <div className="text-[10px] uppercase tracking-[1.2px] text-text-muted mb-3">Alert rules</div>
        {[
          { label: 'Any whale → BULLISH', active: true },
          { label: 'Score crosses 80', active: true },
          { label: 'Wintermute changes signal', active: false },
        ].map((r) => (
          <div key={r.label} className="flex items-center gap-2.5 py-2 border-b border-border-subtle last:border-0">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.active ? 'bg-green' : 'bg-border-strong'}`} />
            <span className="text-[12px] text-text-secondary">{r.label}</span>
          </div>
        ))}
      </div>
      {/* Toast notification */}
      <div
        className={`absolute -top-2 right-0 bg-bg-elevated border border-border-strong rounded-lg px-3 py-2 shadow-lg flex items-center gap-2.5 transition-all duration-500 ${
          visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-green flex-shrink-0" />
        <div>
          <div className="text-[11px] font-medium text-text-primary">Alert fired</div>
          <div className="text-[10px] text-text-muted">Wintermute → BULLISH</div>
        </div>
      </div>
    </div>
  );
}

/* ─── Page sections ───────────────────────────────────── */
function Navbar() {
  const navigate = useNavigate();
  return (
    <nav className="fixed top-0 left-0 right-0 h-14 bg-bg-base/80 backdrop-blur-md border-b border-border-subtle z-50 flex items-center px-6">
      <div className="flex items-center gap-2">
        <HexLogo size={22} />
        <span className="font-display font-bold text-[15px] text-text-primary tracking-[-0.5px]">SENTINEL</span>
        <span className="text-[9px] text-text-muted">AI</span>
      </div>
      <div className="hidden md:flex items-center gap-6 mx-auto">
        {[['Watchlist', '/watchlist'], ['Intelligence', '/intelligence'], ['Scoring', '/scoring'], ['Alerts', '/alerts']].map(([label, to]) => (
          <Link key={label} to={to} className="text-[13px] text-text-muted hover:text-text-primary transition-colors">
            {label}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <button type="button" onClick={() => navigate('/watchlist')} className="text-[13px] text-text-muted px-4 py-2 rounded-lg hover:text-text-primary transition-colors">
          Sign in
        </button>
        <button
          type="button"
          onClick={() => navigate('/watchlist')}
          className="text-[13px] font-semibold bg-green text-bg-base px-4 py-2 rounded-lg hover:opacity-90 active:scale-[0.98] transition-all"
        >
          Launch App →
        </button>
      </div>
    </nav>
  );
}

function HeroSection() {
  const navigate = useNavigate();
  return (
    <section className="min-h-screen flex flex-col items-center justify-center bg-bg-base relative overflow-hidden px-8 pt-14">
      {/* Animated grid background */}
      <div className="hero-grid absolute inset-0 pointer-events-none" />
      {/* Green radial glow — hero only */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-[0.06] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, #00D992 0%, transparent 70%)' }}
      />
      {/* Content */}
      <div className="relative z-10 text-center max-w-4xl">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 bg-green/10 border border-green/20 rounded-full px-3 py-1.5 mb-6">
          <div className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
          <span className="text-[11px] text-green font-medium tracking-wide">94 wallets tracked live</span>
        </div>
        {/* Headline */}
        <h1 className="font-display font-bold text-[52px] md:text-[64px] leading-[1.05] tracking-[-2px] text-text-primary mb-6">
          Know what smart money<br />does before you do.
        </h1>
        {/* Subhead */}
        <p className="text-[18px] text-text-secondary leading-relaxed max-w-2xl mx-auto mb-10">
          Sentinel tracks 94 Ethereum whale wallets in real time. AI-powered signals, live scoring, and instant alerts — see the move before it happens.
        </p>
        {/* CTAs */}
        <div className="flex items-center justify-center gap-4 mb-16">
          <button
            type="button"
            onClick={() => navigate('/watchlist')}
            className="bg-green text-bg-base font-semibold text-[15px] px-8 py-3.5 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all"
          >
            Launch App →
          </button>
          <button
            type="button"
            onClick={() => navigate('/intelligence')}
            className="border border-border-default text-text-secondary text-[15px] px-8 py-3.5 rounded-xl hover:bg-bg-elevated hover:text-text-primary transition-all"
          >
            See Intelligence
          </button>
        </div>
        {/* Stats strip */}
        <div className="flex justify-center gap-8 md:gap-12 pt-8 border-t border-border-subtle">
          {[['94', 'Wallets Tracked'], ['6hr', 'Scan Cycle'], ['100%', 'Ethereum'], ['Free', 'During Beta']].map(([val, lbl]) => (
            <div key={lbl} className="flex flex-col items-center gap-1">
              <span className="font-display font-bold text-[28px] text-text-primary">{val}</span>
              <span className="text-[11px] text-text-muted uppercase tracking-wider">{lbl}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductPreviewSection() {
  return (
    <section className="py-24 px-8 bg-bg-base">
      <div className="text-center mb-12">
        <div className="text-[11px] uppercase tracking-[2px] text-green mb-3">The Product</div>
        <h2 className="font-display text-[40px] font-bold text-text-primary">
          Everything you need to follow smart money.
        </h2>
      </div>
      <ProductMockup />
    </section>
  );
}

function FeaturesSection() {
  const navigate = useNavigate();
  const blocks = [
    {
      tag: 'Whale Watchlist',
      title: '94 wallets. Ranked by intelligence, not balance.',
      body: 'Every major Ethereum whale scored 0–100 using our proprietary methodology: activity, success rate, recency, and balance weight. Exchange hot wallets automatically filtered out.',
      cta: 'View Watchlist →',
      ctaPath: '/watchlist',
      Visual: WatchlistVisual,
      flip: false,
    },
    {
      tag: 'AI Intelligence',
      title: "Claude reads the chain so you don't have to.",
      body: 'Every wallet analyzed by Claude AI. Get a structured signal (BULLISH/BEARISH/NEUTRAL), activity summary, key insight, and risk level — updated automatically every 6 hours.',
      cta: 'See Intelligence →',
      ctaPath: '/intelligence',
      Visual: IntelligenceVisual,
      flip: true,
    },
    {
      tag: 'Live Alerts',
      title: 'Get the signal the moment it fires.',
      body: 'Set rules: notify me when any wallet goes BULLISH, when a score crosses 80, or when a specific whale changes direction. Alerts fire instantly — no polling, no lag.',
      cta: 'Set Up Alerts →',
      ctaPath: '/alerts',
      Visual: AlertVisual,
      flip: false,
    },
  ];

  return (
    <section className="py-24 px-8 max-w-6xl mx-auto">
      <div className="flex flex-col gap-24">
        {blocks.map(({ tag, title, body, cta, ctaPath, Visual, flip }) => (
          <div key={tag} className={`flex flex-col md:flex-row items-center gap-12 md:gap-16 ${flip ? 'md:flex-row-reverse' : ''}`}>
            <div className="flex-1 max-w-lg">
              <div className="text-[11px] uppercase tracking-[2px] text-green mb-3">{tag}</div>
              <h3 className="font-display text-[28px] font-bold text-text-primary leading-[1.2] mb-4">{title}</h3>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-5">{body}</p>
              <button
                type="button"
                onClick={() => navigate(ctaPath)}
                className="text-[14px] font-medium text-green hover:underline"
              >
                {cta}
              </button>
            </div>
            <div className="flex-1 w-full max-w-md">
              <Visual />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ComparisonSection() {
  return (
    <section className="py-24 px-8 max-w-4xl mx-auto text-center">
      <h2 className="font-display text-[36px] font-bold text-text-primary mb-4">How Sentinel compares.</h2>
      <p className="text-text-muted text-[16px] mb-16">We built what Nansen should have been.</p>
      <div className="bg-bg-surface border border-border-default rounded-xl overflow-hidden text-left">
        {/* Header */}
        <div className="grid grid-cols-3 bg-bg-overlay px-6 py-3 border-b border-border-subtle">
          <div className="text-[11px] uppercase tracking-[1.2px] text-text-muted">Feature</div>
          <div className="text-[11px] uppercase tracking-[1.2px] text-green font-bold text-center">Sentinel AI</div>
          <div className="text-[11px] uppercase tracking-[1.2px] text-text-muted text-center">Nansen AI</div>
        </div>
        {COMPARISON_ROWS.map((row, i) => (
          <div key={row.feature} className={`grid grid-cols-3 px-6 py-4 border-b border-border-subtle last:border-0 ${i % 2 === 0 ? 'bg-bg-surface' : 'bg-bg-card'}`}>
            <div className="text-[13px] text-text-secondary self-center">{row.feature}</div>
            <div className="text-[13px] text-green font-medium text-center self-center">{row.sentinel}</div>
            <div className={`text-[13px] font-medium text-center self-center ${row.nansenGood ? 'text-text-secondary' : 'text-red'}`}>
              {row.nansenVal}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-bg-surface border-t border-border-subtle">
      <div className="max-w-6xl mx-auto py-12 px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <HexLogo size={20} />
              <span className="font-display font-bold text-[14px] text-text-primary tracking-[-0.5px]">SENTINEL AI</span>
            </div>
            <p className="text-[13px] text-text-muted mt-2">Ethereum whale intelligence.</p>
            <p className="text-[12px] text-text-muted mt-1">Built by Shazaib Amlani</p>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[1.5px] text-text-muted mb-3">Product</div>
            {[['Watchlist', '/watchlist'], ['Intelligence', '/intelligence'], ['Scoring', '/scoring'], ['Alerts', '/alerts']].map(([label, to]) => (
              <Link key={label} to={to} className="text-[13px] text-text-muted hover:text-text-secondary block mb-2 transition-colors">
                {label}
              </Link>
            ))}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[1.5px] text-text-muted mb-3">Sentinel</div>
            {['Free during beta', 'Ethereum only', '94 wallets tracked', 'Powered by Claude AI'].map((item) => (
              <span key={item} className="text-[13px] text-text-muted block mb-2">{item}</span>
            ))}
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-border-subtle flex justify-between text-[11px] text-text-muted">
          <span>© 2026 Sentinel AI</span>
          <span>Not financial advice.</span>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  useEffect(() => {
    document.title = 'Sentinel AI — Ethereum Whale Intelligence';
  }, []);

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <Navbar />
      <HeroSection />
      <ProductPreviewSection />
      <FeaturesSection />
      <ComparisonSection />
      <Footer />
    </div>
  );
}
