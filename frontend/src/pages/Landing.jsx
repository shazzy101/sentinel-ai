import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import ScrollWhalePaths from '../components/landing/ScrollWhalePaths';
import InvestShowcase from '../components/landing/InvestShowcase';
import AppBackground from '../components/primitives/AppBackground';
import MagneticButton from '../components/primitives/MagneticButton';
import AnimatedCounter from '../components/primitives/AnimatedCounter';
import SentinelLogo from '../components/ui/SentinelLogo';
import ProWaitlist from '../components/ui/ProWaitlist';

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
  { feature: 'Copy whale trades',           sentinel: '✓ One-click',     nansenVal: '✗',            nansenGood: false },
  { feature: 'Non-custodial DEX swaps',     sentinel: '✓ MetaMask',      nansenVal: 'Partial',      nansenGood: true },
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
          hadaleum.com/watchlist
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

      <div className="px-4 py-2 bg-bg-overlay flex items-center gap-2 overflow-hidden">
        <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse flex-shrink-0" />
        <span className="text-[10px] text-text-muted font-mono truncate max-w-[180px] text-green">
          {scanningRow >= 0 ? `scanning ${rows[scanningRow]?.name}...` : 'live • wallets tracked'}
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

function MarketsVisual() {
  const [price, setPrice] = useState(3842);
  const ref = useRef(null);

  useEffect(() => {
    let iv;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !iv) {
        iv = setInterval(() => {
          setPrice((p) => Math.round(p + (Math.random() - 0.48) * 12));
        }, 800);
      }
    }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => { obs.disconnect(); if (iv) clearInterval(iv); };
  }, []);

  return (
    <div ref={ref} className="glass-border rounded-2xl p-4 overflow-hidden">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-bold text-text-primary">ETH / USD</span>
        <span className="text-sm font-mono font-bold text-green">${price.toLocaleString()}</span>
      </div>
      <svg viewBox="0 0 280 80" className="w-full h-20">
        <defs>
          <linearGradient id="mvGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00D992" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#00D992" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 60 Q40 20, 80 45 T160 30 T280 15 V80 H0 Z" fill="url(#mvGrad)" />
        <path d="M0 60 Q40 20, 80 45 T160 30 T280 15" fill="none" stroke="#00D992" strokeWidth="2" />
      </svg>
      <div className="grid grid-cols-3 gap-2 mt-3">
        {['UNI', 'LINK', 'AAVE'].map((sym, i) => (
          <div key={sym} className="rounded-lg bg-white/[0.03] px-2 py-1.5 text-center">
            <div className="text-[10px] text-text-muted">{sym}</div>
            <div className={`text-[11px] font-mono font-bold ${i !== 2 ? 'text-green' : 'text-red'}`}>
              {i !== 2 ? '+' : ''}{i === 0 ? '2.4' : i === 1 ? '1.1' : '-0.8'}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InvestVisual() {
  const [step, setStep] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    let iv;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !iv) {
        iv = setInterval(() => setStep((s) => (s + 1) % 3), 2200);
      }
    }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => { obs.disconnect(); if (iv) clearInterval(iv); };
  }, []);

  const labels = ['Whale move detected', 'Copy trade prefilled', 'Confirmed on-chain'];

  return (
    <div ref={ref} className="glass-border rounded-2xl p-4">
      <div className="rounded-xl border border-green/25 bg-green/10 p-3 mb-3">
        <div className="text-[10px] uppercase tracking-widest text-green font-bold mb-1">Wintermute</div>
        <div className="text-xs font-mono text-text-primary">Sent 847.52 ETH</div>
      </div>
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-4"
      >
        <div className="text-sm font-semibold text-text-primary mb-1">{labels[step]}</div>
        {step === 1 && (
          <div className="text-xs font-mono text-green mt-2">8.47 ETH → WETH</div>
        )}
        {step === 2 && (
          <div className="text-xs text-green mt-2 flex items-center justify-center gap-1">
            ✓ View on Etherscan
          </div>
        )}
      </motion.div>
      <div className="flex gap-1.5 justify-center mt-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-1 rounded-full transition-all ${i === step ? 'w-4 bg-green' : 'w-1 bg-white/20'}`} />
        ))}
      </div>
    </div>
  );
}

/* ─── Page sections ───────────────────────────────────── */
function Navbar() {
  const navigate = useNavigate();
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-4 pt-4 md:px-6">
      <div className="glass-surface mx-auto flex h-14 max-w-6xl items-center rounded-2xl px-5 shadow-card">
        <SentinelLogo size={24} showWordmark />
        <div className="hidden md:flex items-center gap-8 mx-auto">
          {[['Watchlist', '/watchlist'], ['Intelligence', '/intelligence'], ['Markets', '/markets'], ['Invest', '/invest']].map(([label, to]) => (
            <Link key={label} to={to} className="text-sm text-text-muted hover:text-text-primary transition-colors duration-200">
              {label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button type="button" onClick={() => navigate('/login')} className="hidden sm:block text-sm text-text-muted px-3 py-2 rounded-xl hover:text-text-primary transition-colors">
            Sign in
          </button>
          <MagneticButton
            type="button"
            onClick={() => navigate('/signup')}
            className="text-sm font-semibold bg-green text-text-inverse px-4 py-2 rounded-xl shadow-glow hover:bg-green-bright transition-colors"
          >
            Start Free Trial →
          </MagneticButton>
        </div>
      </div>
    </nav>
  );
}

function HeroSection({ walletCount }) {
  const navigate = useNavigate();
  return (
    <section className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-6 pt-28 pb-16 md:px-8">
      <div className="hero-grid absolute inset-0 pointer-events-none opacity-60" />
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[480px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(0,217,146,0.14) 0%, transparent 65%)' }}
      />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 text-center max-w-4xl"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-green/20 bg-green/10 px-3.5 py-1.5 mb-8">
          <span className="relative h-1.5 w-1.5 rounded-full bg-green pulse-dot" />
          <span className="text-xs font-medium tracking-wide text-green">{walletCount} wallets tracked live</span>
        </div>
        <h1 className="font-display font-bold text-4xl md:text-6xl lg:text-7xl leading-[1.05] tracking-tight text-text-primary mb-6">
          Copy smart money.
          <br />
          <span className="gradient-text-accent">Keep your keys.</span>
        </h1>
        <p className="text-lg text-text-secondary leading-relaxed max-w-2xl mx-auto mb-10">
          Hadaleum tracks 2,796 elite Ethereum wallets from the depths no one else reaches. AI signals. Non-custodial copy trading. Your keys, always.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
          <MagneticButton
            type="button"
            onClick={() => navigate('/watchlist')}
            className="w-full sm:w-auto bg-green text-text-inverse font-semibold text-base px-8 py-3.5 rounded-2xl shadow-glow hover:bg-green-bright transition-colors"
          >
            Start Free Trial →
          </MagneticButton>
          <button
            type="button"
            onClick={() => navigate('/intelligence')}
            className="w-full sm:w-auto border border-border-default text-text-secondary text-[15px] px-8 py-3.5 rounded-xl hover:bg-bg-elevated hover:text-text-primary hover:border-border-strong transition-all"
          >
            See Live Signals
          </button>
        </div>
        <div className="flex flex-col items-center mt-6 animate-bounce">
          <svg className="w-5 h-5 text-text-muted" viewBox="0 0 20 20" fill="none">
            <path d="M10 4v12M6 12l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10 pt-10 border-t border-white/[0.06] max-w-3xl mx-auto">
          {[
            { val: walletCount, lbl: 'Wallets Tracked', suffix: '' },
            { val: 6, lbl: 'Hour Scan Cycle', suffix: 'hr' },
            { val: 100, lbl: 'Ethereum Focus', suffix: '%' },
            { val: 19, lbl: 'Pro Plan / Month', prefix: '$' },
          ].map(({ val, lbl, suffix, prefix }, i) => (
            <motion.div
              key={lbl}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.08, duration: 0.4 }}
              className="flex flex-col items-center gap-1"
            >
              <span className="font-display font-bold text-3xl text-text-primary">
                <>
                    {prefix}
                    <AnimatedCounter value={val} decimals={0} />
                    {suffix}
                  </>
              </span>
              <span className="text-2xs text-text-muted uppercase tracking-widest">{lbl}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
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
      title: '2,796 wallets. Ranked by intelligence, not balance.',
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
      tag: 'Live Markets',
      title: 'ETH price, ecosystem tokens, live charts.',
      body: 'Real-time market data from CoinGecko. ETH hero charts, top ecosystem tokens, volume sparklines, and whale sentiment derived from your tracked wallets.',
      cta: 'Open Markets →',
      ctaPath: '/markets',
      Visual: MarketsVisual,
      flip: true,
    },
    {
      tag: 'Invest & Copy',
      title: 'Mirror whale moves. Execute via MetaMask.',
      body: 'When a tracked whale makes a significant move, copy the trade at your size. Best-rate routing across all DEXs via DefiLlama — Hadaleum never holds your keys.',
      cta: 'Start Investing →',
      ctaPath: '/invest',
      Visual: InvestVisual,
      flip: false,
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
      <h2 className="font-display text-[36px] font-bold text-text-primary mb-4">How Hadaleum compares.</h2>
      <p className="text-text-muted text-[16px] mb-16">We built what Nansen should have been.</p>
      <div className="bg-bg-surface border border-border-default rounded-xl overflow-hidden text-left">
        {/* Header */}
        <div className="grid grid-cols-3 bg-bg-overlay px-6 py-3 border-b border-border-subtle">
          <div className="text-[11px] uppercase tracking-[1.2px] text-text-muted">Feature</div>
          <div className="text-[11px] uppercase tracking-[1.2px] text-green font-bold text-center">Hadaleum</div>
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

function TrustStrip() {
  return (
    <div className="py-8 border-y border-border-subtle text-center">
      <p className="text-[12px] text-text-muted mb-4 uppercase tracking-widest">
        Tracking wallets from
      </p>
      <div className="flex items-center justify-center gap-8 flex-wrap px-6">
        {['Paradigm', 'a16z Crypto', 'Jump Trading', 'Wintermute', 'Dragonfly', 'Vitalik.eth'].map((name) => (
          <span key={name} className="text-[13px] text-text-muted font-medium">{name}</span>
        ))}
      </div>
    </div>
  );
}

function SocialProofBar() {
  return (
    <div className="py-5 border-y border-border-subtle bg-bg-base">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 px-6 text-center">
        {[
          { val: '2,796', label: 'whale wallets tracked' },
          { val: '$0', label: 'in user funds ever held' },
          { val: 'Claude AI', label: 'signal intelligence' },
        ].map(({ val, label }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="font-display font-bold text-text-primary text-sm">{val}</span>
            <span className="text-text-muted text-sm">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PricingSection() {
  const navigate = useNavigate();
  const FREE_FEATURES = ['Top 10 whale watchlist', '1 AI signal per day', 'ETH Markets', 'News Intelligence'];
  const PRO_FEATURES = ['Full 2,796 wallet watchlist', 'Unlimited AI signals', 'Non-custodial copy trading', 'Signal history & accuracy', 'Email alerts on signal flips'];

  return (
    <section id="pricing" className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="text-[11px] uppercase tracking-[2px] text-green mb-3">Pricing</div>
          <h2 className="font-display text-[36px] font-bold text-text-primary mb-3">Simple, transparent pricing.</h2>
          <p className="text-text-muted text-[15px]">Start free. Upgrade when you need the edge.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* Free */}
          <div className="rounded-2xl border border-border-default bg-bg-surface p-6">
            <h3 className="font-display text-xl font-bold text-text-primary mb-1">Free</h3>
            <div className="mb-4"><span className="text-3xl font-bold text-text-primary">$0</span><span className="text-text-muted text-sm">/forever</span></div>
            <ul className="space-y-2.5 mb-6">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-text-secondary">
                  <span className="text-green text-xs">✓</span>{f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => navigate('/signup')}
              className="w-full rounded-xl border border-border-default px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-elevated transition-colors"
            >
              Get started free
            </button>
          </div>
          {/* Pro */}
          <div className="rounded-2xl border-2 border-green/40 bg-bg-surface p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-green text-text-inverse text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-xl">Pro</div>
            <h3 className="font-display text-xl font-bold text-text-primary mb-1">Pro</h3>
            <div className="mb-4">
              <span className="text-3xl font-bold text-text-primary">$19</span>
              <span className="text-text-muted text-sm">/month</span>
              <span className="ml-2 text-[11px] text-green">or $190/year</span>
            </div>
            <ul className="space-y-2.5 mb-6">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-text-secondary">
                  <span className="text-green text-xs">✓</span>{f}
                </li>
              ))}
            </ul>
            <MagneticButton
              type="button"
              onClick={() => navigate('/signup')}
              className="w-full rounded-xl bg-green px-4 py-3 text-sm font-semibold text-text-inverse shadow-glow hover:bg-green-bright transition-colors"
            >
              Start 7-day free trial
            </MagneticButton>
            <p className="text-center text-[11px] text-text-muted mt-2">No credit card required</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border-subtle py-10 px-8">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <HexLogo size={20} />
          <span className="font-display font-bold text-[14px]">HADALEUM</span>
          <span className="text-[12px] text-text-muted ml-4">© 2026 Hadaleum · Not financial advice.</span>
        </div>
        <div className="flex flex-wrap items-center gap-6 text-[13px] text-text-muted">
          <Link to="/watchlist" className="hover:text-text-secondary">Watchlist</Link>
          <Link to="/intelligence" className="hover:text-text-secondary">Intelligence</Link>
          <Link to="/markets" className="hover:text-text-secondary">Markets</Link>
          <Link to="/privacy" className="hover:text-text-secondary">Privacy</Link>
          <Link to="/terms" className="hover:text-text-secondary">Terms</Link>
          <Link to="/about" className="hover:text-text-secondary">About</Link>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  // Hardcoded to full Dune dataset size — consistent with all other copy on the page
  const walletCount = 2796;

  useEffect(() => {
    document.title = 'Hadaleum — Ethereum Whale Intelligence';
  }, []);

  return (
    <div className="force-dark min-h-screen bg-bg-base text-text-primary relative">
      <AppBackground variant="landing" />
      <ScrollWhalePaths />
      <Navbar />
      <HeroSection walletCount={walletCount} />
      <SocialProofBar />
      <InvestShowcase />
      <ProductPreviewSection />
      <FeaturesSection />
      <ComparisonSection />
      <PricingSection />

      {/* Final CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto rounded-3xl border border-green/20 bg-green/[0.04] px-8 py-14">
          <div className="text-[11px] uppercase tracking-[2px] text-green mb-3">Start today</div>
          <h2 className="font-display text-[34px] md:text-[40px] font-bold text-text-primary leading-tight mb-4">
            The deepest layer of Ethereum intelligence.
          </h2>
          <p className="text-[15px] text-text-secondary leading-relaxed max-w-lg mx-auto mb-8">
            Full 2,796-wallet watchlist, unlimited AI signals, non-custodial copy trading, and instant alerts.
            Start free — upgrade to Pro when you're ready.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <MagneticButton
              type="button"
              onClick={() => navigate('/signup')}
              className="w-full sm:w-auto bg-green text-text-inverse font-semibold text-base px-8 py-3.5 rounded-2xl shadow-glow hover:bg-green-bright transition-colors"
            >
              Start 7-day free trial →
            </MagneticButton>
            <button
              type="button"
              onClick={() => navigate('/upgrade')}
              className="w-full sm:w-auto border border-border-default text-text-secondary text-[15px] px-8 py-3.5 rounded-xl hover:bg-bg-elevated hover:text-text-primary hover:border-border-strong transition-all"
            >
              View pricing
            </button>
          </div>
          <p className="text-[12px] text-text-muted mt-4">No credit card required · Cancel anytime</p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
