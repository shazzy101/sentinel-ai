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
import TrustPulse from '../components/trust/TrustPulse';

/* ─── Static mock data for the animated product preview ─── */
const MOCK_ROWS = [
  { name: 'Wintermute',        addr: '0x4f3a…192F', score: 89, signal: 'BULLISH' },
  { name: 'Jump Crypto',       addr: '0x4634…9758', score: 76, signal: 'NEUTRAL' },
  { name: 'Paradigm',          addr: '0x5F51…26Fb', score: 82, signal: 'BULLISH' },
  { name: 'a16z Crypto',       addr: '0x05e7…8019', score: 71, signal: 'NEUTRAL' },
  { name: 'Dragonfly Capital', addr: '0x5642…ACe',  score: 63, signal: 'BEARISH' },
];

const COMPARISON_ROWS = [
  { feature: 'Whale wallet tracking',     sentinel: '✓',            nansenVal: '✓',            nansenGood: true,  arkham: '✓' },
  { feature: 'AI signal analysis',        sentinel: '✓ Claude 4',   nansenVal: '✓ Basic',       nansenGood: true,  arkham: '✗ Basic' },
  { feature: 'Intelligence score 0–100',  sentinel: '✓',            nansenVal: '✗',            nansenGood: false, arkham: '✗' },
  { feature: 'Exchange wallet filtering', sentinel: '✓',            nansenVal: '✗',            nansenGood: false, arkham: '✓' },
  { feature: 'Free tier',                 sentinel: '✓ Full access', nansenVal: '✗ $150/mo',    nansenGood: false, arkham: '✗ Paid' },
  { feature: 'Instant alerts',            sentinel: '✓',            nansenVal: '✓',            nansenGood: true,  arkham: '✓' },
  { feature: 'Daily AI market brief',     sentinel: '✓',            nansenVal: '✗',            nansenGood: false, arkham: '✗' },
  { feature: 'Pure ETH focus',            sentinel: '✓',            nansenVal: '✗ Multi-chain', nansenGood: false, arkham: '✗' },
  { feature: 'Copy whale trades',           sentinel: '✓ One-click',     nansenVal: '✗',            nansenGood: false, arkham: '✗' },
  { feature: 'Non-custodial DEX swaps',     sentinel: '✓ MetaMask',      nansenVal: 'Partial',      nansenGood: true,  arkham: '✗' },
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
    <div className="bg-bg-surface border border-border-default rounded-2xl overflow-hidden">
      {/* Browser chrome */}
      <div className="h-11 bg-bg-overlay border-b border-border-subtle flex items-center px-4 gap-2.5">
        <span className="w-3 h-3 rounded-full bg-red/60 flex-shrink-0" />
        <span className="w-3 h-3 rounded-full bg-amber/60 flex-shrink-0" />
        <span className="w-3 h-3 rounded-full bg-green/60 flex-shrink-0" />
        <div className="flex-1 mx-4 bg-bg-card border border-border-subtle rounded-md px-3 py-1 text-[10px] text-text-muted font-mono text-center select-none flex items-center justify-center gap-1.5">
          <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5"/><path d="M6 3v3.5l2 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          hadaleum.com/watchlist
        </div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[28px_1fr_70px_96px_118px] gap-x-3 px-5 py-2.5 bg-bg-card border-b border-border-default text-[9px] uppercase tracking-[1.4px] text-text-muted font-medium">
        <div>#</div><div>Wallet</div><div>Score</div><div>Signal</div><div>Balance</div>
      </div>

      {/* Rows */}
      {rows.map((row, i) => (
        <div
          key={row.name}
          className={`grid grid-cols-[28px_1fr_70px_96px_118px] gap-x-3 px-5 py-3 border-b border-border-subtle last:border-0 transition-all duration-300 ${
            scanningRow === i ? 'border-l-2 border-l-green bg-green/[0.04]' : 'border-l-2 border-l-transparent'
          }`}
        >
          <div className="text-[10px] text-text-muted font-mono self-center tabular-nums">{i + 1}</div>
          <div className="self-center min-w-0">
            <div className="text-[12px] font-semibold text-text-primary truncate">{row.name}</div>
            <div className="text-[9px] text-text-muted font-mono mt-0.5">{row.addr}</div>
          </div>
          <div className="self-center">
            <div className="h-[2px] bg-bg-elevated rounded-full mb-1.5 overflow-hidden">
              <div
                className={row.score >= 80 ? 'h-full bg-green rounded-full' : row.score >= 60 ? 'h-full bg-amber rounded-full' : 'h-full bg-red rounded-full'}
                style={{ width: loaded ? `${row.score}%` : '0%', transition: `width 1s ease ${i * 0.15}s` }}
              />
            </div>
            <span className={`text-[11px] font-mono font-bold tabular-nums ${row.score >= 80 ? 'text-green' : row.score >= 60 ? 'text-amber' : 'text-red'}`}>
              {row.score}
            </span>
          </div>
          <div className="self-center">
            <SignalChip signal={row.signal} />
          </div>
          <div className="self-center text-[10px] font-mono text-text-secondary tabular-nums">
            {[1247.52, 856.14, 3120, 2450, 445.22][i].toLocaleString(undefined, { minimumFractionDigits: 2 })} ETH
          </div>
        </div>
      ))}

      <div className="px-5 py-2.5 bg-bg-overlay flex items-center gap-2">
        <span className="inline-flex rounded-full h-1.5 w-1.5 flex-shrink-0 bg-green/70" />
        <span className="text-[10px] text-green font-mono">
          {scanningRow >= 0 ? `scanning ${rows[scanningRow]?.name}…` : 'wallets tracked'}
        </span>
      </div>
    </div>
  );
}

/* ─── Animated whale ticker ──────────────────────────── */
const TICKER_WHALES = [
  { name: 'Wintermute',        addr: '0x4f3a…192F', score: 89, signal: 'BULLISH' },
  { name: 'Paradigm',          addr: '0x5F51…26Fb', score: 82, signal: 'BULLISH' },
  { name: 'Jump Crypto',       addr: '0x4634…9758', score: 76, signal: 'BULLISH' },
  { name: 'a16z Crypto',       addr: '0x05e7…8019', score: 71, signal: 'NEUTRAL' },
  { name: 'Dragonfly Capital', addr: '0x5642…ACe',  score: 63, signal: 'BEARISH' },
  { name: 'Vitalik.eth',       addr: '0xd8dA…6045', score: 91, signal: 'BULLISH' },
  { name: 'ETH Foundation',    addr: '0xde0B…BAe',  score: 85, signal: 'BULLISH' },
];

function WhaleTicker() {
  const doubled = [...TICKER_WHALES, ...TICKER_WHALES];
  const sigCls = {
    BULLISH: { chip: 'bg-green-dim border-green-border text-green', dot: 'bg-green' },
    BEARISH: { chip: 'bg-red-dim border-red-border text-red', dot: 'bg-red' },
    NEUTRAL: { chip: 'bg-amber-dim border-amber-border text-amber', dot: 'bg-amber' },
  };
  const scoreColor = { BULLISH: 'text-green', BEARISH: 'text-red', NEUTRAL: 'text-amber' };

  return (
    <div className="py-8 border-y border-border-subtle overflow-hidden">
      <div className="flex items-center justify-center gap-2 mb-5">
        <span className="inline-flex rounded-full h-1.5 w-1.5 bg-green/70" />
        <span className="text-[9px] uppercase tracking-[2.5px] text-green/70 font-mono">On-chain whale intelligence</span>
      </div>
      <div className="relative">
        <div className="flex gap-4" style={{ animation: 'ticker-scroll 36s linear infinite', width: 'max-content' }}>
          {doubled.map((w, i) => (
            <div
              key={i}
              className="flex-shrink-0 bg-bg-card border border-border-default rounded-xl px-5 py-4 min-w-[200px] glow-card transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="text-[12px] font-semibold text-text-primary">{w.name}</div>
                <span className={`text-[13px] font-mono font-bold tabular-nums ${scoreColor[w.signal]}`}>{w.score}</span>
              </div>
              <div className="text-[9px] text-text-muted font-mono mb-3">{w.addr}</div>
              <span className={`inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${sigCls[w.signal].chip}`}>
                <span className={`w-1 h-1 rounded-full ${sigCls[w.signal].dot}`} />
                {w.signal}
              </span>
            </div>
          ))}
        </div>
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-bg-base to-transparent pointer-events-none z-10" />
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-bg-base to-transparent pointer-events-none z-10" />
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
      {[{ name: 'Wintermute', score: 89 }, { name: 'Paradigm', score: 82 }, { name: 'Jump Crypto', score: 76 }, { name: 'a16z Crypto', score: 71 }, { name: 'Dragonfly Capital', score: 63 }]
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
      <div
        className="mx-auto flex h-14 max-w-6xl items-center rounded-2xl px-5"
        style={{
          background: 'rgba(8,8,15,0.72)',
          backdropFilter: 'blur(24px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
          border: '1px solid rgba(130,130,200,0.10)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        <SentinelLogo size={24} showWordmark />
        <div className="hidden md:flex items-center gap-8 mx-auto">
          {[['Watchlist', '/watchlist'], ['Intelligence', '/intelligence'], ['Markets', '/markets'], ['Invest', '/invest']].map(([label, to]) => (
            <Link key={label} to={to} className="text-sm text-text-muted hover:text-text-primary transition-colors duration-200">
              {label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <a href="https://x.com/hadaleum" target="_blank" rel="noopener noreferrer" className="hidden sm:flex items-center justify-center w-8 h-8 rounded-lg text-text-muted hover:text-white transition-colors" aria-label="X / Twitter">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M10.97 1H12.9L8.78 5.71 13.67 13h-3.92L6.7 9.06 3.27 13H1.34l4.41-5.04L.67 1h4.02L7.6 4.6 10.97 1Zm-.67 10.79h1.07L3.75 2.1H2.6l7.7 9.69Z" fill="currentColor"/></svg>
          </a>
          <a href="https://discord.gg/hadaleum" target="_blank" rel="noopener noreferrer" className="hidden sm:flex items-center justify-center w-8 h-8 rounded-lg text-text-muted hover:text-white transition-colors" aria-label="Discord">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M11.61 2.92A11.37 11.37 0 0 0 9.02 2a7.76 7.76 0 0 0-.36.74 10.5 10.5 0 0 0-3.32 0A7.49 7.49 0 0 0 5 2 11.42 11.42 0 0 0 2.38 2.92 12.06 12.06 0 0 0 .5 10.5a11.6 11.6 0 0 0 3.54 1.79c.29-.39.54-.8.76-1.24a7.4 7.4 0 0 1-1.18-.57c.1-.07.2-.15.29-.22a8.27 8.27 0 0 0 7.18 0c.1.08.19.15.29.22-.38.22-.78.41-1.19.57.22.43.47.85.76 1.24a11.55 11.55 0 0 0 3.54-1.79A12.03 12.03 0 0 0 11.61 2.92ZM4.9 8.98c-.72 0-1.3-.66-1.3-1.47S4.17 6.04 4.9 6.04c.72 0 1.31.66 1.3 1.47 0 .81-.58 1.47-1.3 1.47Zm4.2 0c-.71 0-1.3-.66-1.3-1.47S8.38 6.04 9.1 6.04c.72 0 1.31.66 1.3 1.47 0 .81-.58 1.47-1.3 1.47Z" fill="currentColor"/></svg>
          </a>
          <Link to="/institutional" className="hidden sm:block text-sm text-text-muted px-3 py-2 rounded-xl hover:text-text-primary transition-colors">
            Enterprise
          </Link>
          <button type="button" onClick={() => navigate('/login')} className="hidden sm:block text-sm text-text-muted px-3 py-2 rounded-xl hover:text-text-primary transition-colors">
            Sign In
          </button>
          <MagneticButton
            type="button"
            onClick={() => navigate('/signup')}
            className="text-sm font-semibold bg-green text-text-inverse px-4 py-2 rounded-xl shadow-glow hover:bg-green-bright transition-colors"
          >
            Track Whales Free →
          </MagneticButton>
        </div>
      </div>
    </nav>
  );
}

function HeroSection({ walletCount }) {
  const navigate = useNavigate();
  return (
    <section className="min-h-[100dvh] flex flex-col justify-center relative overflow-hidden px-6 pt-28 pb-16 md:px-10 lg:px-12">

      {/* ── ShaderGradient-style mesh blobs (mix-blend-mode: screen) ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ isolation: 'isolate' }}>
        {/* Blob A — green, top-left */}
        <div
          className="mesh-a absolute rounded-full"
          style={{
            width: '90%', height: '70%',
            top: '-25%', left: '-15%',
            background: 'radial-gradient(ellipse at 40% 40%, rgba(0,217,146,0.32) 0%, transparent 60%)',
            filter: 'blur(70px)',
            mixBlendMode: 'screen',
          }}
        />
        {/* Blob B — indigo/violet, right */}
        <div
          className="mesh-b absolute rounded-full"
          style={{
            width: '80%', height: '80%',
            top: '10%', right: '-25%',
            background: 'radial-gradient(ellipse at 60% 50%, rgba(99,102,241,0.28) 0%, transparent 60%)',
            filter: 'blur(80px)',
            mixBlendMode: 'screen',
          }}
        />
        {/* Blob C — teal, bottom center */}
        <div
          className="mesh-c absolute rounded-full"
          style={{
            width: '70%', height: '60%',
            bottom: '-15%', left: '15%',
            background: 'radial-gradient(ellipse at 50% 60%, rgba(0,210,240,0.18) 0%, transparent 60%)',
            filter: 'blur(90px)',
            mixBlendMode: 'screen',
          }}
        />
        {/* Dark vignette — keeps text readable, edges dark */}
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 30%, rgba(5,5,9,0.75) 80%)' }}
        />
        {/* Grain for depth */}
        <div className="noise-overlay absolute inset-0 opacity-[0.035]" />
      </div>

      <div className="max-w-6xl mx-auto w-full grid lg:grid-cols-[1fr_440px] xl:grid-cols-[1fr_480px] gap-12 xl:gap-20 items-center">

        {/* ── Left: editorial text ── */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-green/20 bg-green/[0.08] px-3.5 py-1.5 mb-10"
               style={{ backdropFilter: 'blur(12px)', boxShadow: '0 0 0 1px rgba(0,217,146,0.08) inset' }}>
            <span className="inline-flex h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green/70" />
            <span className="text-xs font-medium tracking-wide text-green">{walletCount.toLocaleString()} wallets tracked</span>
          </div>

          <h1
            className="font-display font-bold leading-[0.92] tracking-tight text-text-primary mb-8"
            style={{ fontSize: 'clamp(54px, 8.5vw, 116px)' }}
          >
            Copy smart<br />
            <span className="gradient-text-accent glow-text-accent">money.</span>
          </h1>

          <p className="text-[17px] text-text-secondary leading-relaxed max-w-[480px] mb-2">
            Hadaleum tracks <strong className="text-text-primary font-semibold">2,796 elite Ethereum wallets</strong> from the depths no one else reaches.
          </p>
          <p className="text-[15px] text-text-muted max-w-[480px] mb-10">
            AI signals · Non-custodial copy trading · Your keys, always.
          </p>

          <div className="flex flex-col sm:flex-row items-start gap-3 mb-3">
            <MagneticButton
              type="button"
              onClick={() => navigate('/watchlist')}
              className="w-full sm:w-auto bg-green text-text-inverse font-semibold text-[15px] px-8 py-4 rounded-2xl hover:bg-green-bright transition-colors"
              style={{ boxShadow: '0 0 0 1px rgba(0,217,146,0.3), 0 4px 24px rgba(0,217,146,0.25), 0 1px 0 rgba(255,255,255,0.15) inset' }}
            >
              Track Whales Free →
            </MagneticButton>
            <button
              type="button"
              onClick={() => navigate('/wins')}
              className="w-full sm:w-auto text-text-secondary text-[15px] px-8 py-4 rounded-xl hover:text-text-primary transition-all"
              style={{
                background: 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(130,130,200,0.12)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              See Today's Signals
            </button>
          </div>
          <p className="text-[12px] text-text-muted mb-14">No credit card · Cancel anytime</p>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 pt-8 border-t border-white/[0.06]">
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
                transition={{ delay: 0.3 + i * 0.08, duration: 0.4 }}
                className="flex flex-col gap-1"
              >
                <span className="font-display font-bold text-3xl text-text-primary tabular-nums">
                  {prefix}<AnimatedCounter value={val} decimals={0} />{suffix}
                </span>
                <span className="text-2xs text-text-muted uppercase tracking-widest">{lbl}</span>
              </motion.div>
            ))}
          </div>
          <TrustPulse variant="compact" />
        </motion.div>

        {/* ── Right: 3D tilted product mockup ── */}
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.85, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="hidden lg:block relative"
          style={{ perspective: '1200px' }}
        >
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{
              transform: 'rotateY(-7deg) rotateX(3deg)',
              transformStyle: 'preserve-3d',
              boxShadow: '0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.06)',
            }}
          >
            <ProductMockup />
          </div>
          {/* Soft glow underneath the mockup */}
          <div
            className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-2/3 h-10 blur-3xl opacity-25 rounded-full pointer-events-none"
            style={{ background: 'rgba(0,217,146,0.5)' }}
          />
        </motion.div>
      </div>

      {/* Mobile product mockup (shows below text, no 3D) */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="lg:hidden max-w-lg mx-auto w-full mt-12"
      >
        <ProductMockup />
      </motion.div>
    </section>
  );
}

function ProductPreviewSection() {
  return (
    <section className="py-24 px-6 md:px-10 bg-bg-base">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="text-[10px] uppercase tracking-[2.5px] text-green mb-3 font-mono">The Product</div>
          <h2 className="font-display text-[36px] md:text-[48px] font-bold text-text-primary leading-[1.05]">
            Everything you need to<br className="hidden md:block" /> follow smart money.
          </h2>
        </div>
        {/* Full-width mockup with depth */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)' }}
        >
          <ProductMockup />
        </div>
      </div>
    </section>
  );
}

function BentoCard({ tag, title, body, cta, ctaPath, Visual, className = '', delay = 0 }) {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`group relative rounded-2xl border border-border-default bg-bg-surface overflow-hidden p-6 flex flex-col gap-4 glow-card transition-all duration-300 ${className}`}
    >
      {/* subtle inset glow on hover */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
           style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }} />

      <div className="text-[9px] uppercase tracking-[2.5px] text-green font-mono">{tag}</div>

      <div className="flex-1">
        <h3 className="font-display text-[20px] font-bold text-text-primary leading-[1.25] mb-2">{title}</h3>
        <p className="text-[13px] text-text-secondary leading-relaxed">{body}</p>
      </div>

      {Visual && (
        <div className="mt-2">
          <Visual />
        </div>
      )}

      {cta && (
        <button
          type="button"
          onClick={() => navigate(ctaPath)}
          className="text-[13px] font-medium text-green hover:text-green-bright transition-colors self-start mt-auto"
        >
          {cta}
        </button>
      )}
    </motion.div>
  );
}

function FeaturesSection() {
  return (
    <section className="py-24 px-6 md:px-10 max-w-6xl mx-auto">
      <div className="text-center mb-14">
        <div className="text-[10px] uppercase tracking-[2.5px] text-green mb-3 font-mono">Features</div>
        <h2 className="font-display text-[36px] md:text-[44px] font-bold text-text-primary leading-[1.05]">
          Built for traders who<br className="hidden md:block" /> want real edge.
        </h2>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-auto">
        {/* Row 1: Watchlist (large) + Intelligence */}
        <BentoCard
          tag="Whale Watchlist"
          title="2,796 wallets. Ranked by intelligence, not balance."
          body="Every major ETH whale scored 0–100 using activity, success rate, recency, and balance weight. Exchange hot wallets filtered out automatically."
          cta="View Watchlist →"
          ctaPath="/watchlist"
          Visual={WatchlistVisual}
          className="xl:col-span-2"
          delay={0}
        />
        <BentoCard
          tag="AI Intelligence"
          title="Claude reads the chain so you don't have to."
          body="Every wallet analyzed by Claude AI. Structured BULLISH / BEARISH / NEUTRAL signal with reasoning, updated every 6 hours."
          cta="See Signals →"
          ctaPath="/intelligence"
          Visual={IntelligenceVisual}
          delay={0.08}
        />

        {/* Row 2: Alerts + Markets + Invest */}
        <BentoCard
          tag="Alerts"
          title="Get the signal the moment it fires."
          body="Set rules: notify me when any wallet goes BULLISH, or when a score crosses 80. Fires instantly — no polling, no lag."
          cta="Set Up Alerts →"
          ctaPath="/alerts"
          Visual={AlertVisual}
          delay={0.12}
        />
        <BentoCard
          tag="Markets"
          title="ETH price, ecosystem tokens, on-chain charts."
          body="Market data from CoinGecko. ETH hero charts, top ecosystem tokens, and whale sentiment derived from your tracked wallets."
          cta="Open Markets →"
          ctaPath="/markets"
          Visual={MarketsVisual}
          delay={0.16}
        />
        <BentoCard
          tag="Invest & Copy"
          title="Mirror whale moves. Execute via MetaMask."
          body="Copy trades at your size via non-custodial MetaMask execution. Best-rate DEX routing via DefiLlama. Hadaleum never holds your keys."
          cta="Start Investing →"
          ctaPath="/invest"
          Visual={InvestVisual}
          delay={0.2}
        />
      </div>
    </section>
  );
}

function ComparisonSection() {
  return (
    <section className="py-24 px-8 max-w-4xl mx-auto text-center">
      <h2 className="font-display text-[36px] md:text-[44px] font-bold text-text-primary mb-4 leading-[1.05]">How Hadaleum compares.</h2>
      <p className="text-text-muted text-[16px] mb-4">The Bloomberg Terminal for DeFi — at 1/100th the price. We built what Nansen should have been.</p>
      <p className="text-text-muted text-[13px] mt-2 mb-12">Pricing as of June 2026. Nansen $150/mo, Arkham free tier available.</p>
      <div className="bg-bg-surface border border-border-default rounded-xl overflow-hidden text-left">
        {/* Header */}
        <div className="grid grid-cols-4 bg-bg-overlay px-6 py-3 border-b border-border-subtle">
          <div className="text-[11px] uppercase tracking-[1.2px] text-text-muted">Feature</div>
          <div className="text-[11px] uppercase tracking-[1.2px] text-green font-bold text-center">Hadaleum</div>
          <div className="text-[11px] uppercase tracking-[1.2px] text-text-muted text-center">Nansen AI</div>
          <div className="text-[11px] uppercase tracking-[1.2px] text-text-muted text-center">Arkham</div>
        </div>
        {COMPARISON_ROWS.map((row, i) => (
          <div key={row.feature} className={`grid grid-cols-4 px-6 py-4 border-b border-border-subtle last:border-0 ${i % 2 === 0 ? 'bg-bg-surface' : 'bg-bg-card'}`}>
            <div className="text-[13px] text-text-secondary self-center">{row.feature}</div>
            <div className="text-[13px] text-green font-medium text-center self-center">{row.sentinel}</div>
            <div className={`text-[13px] font-medium text-center self-center ${row.nansenGood ? 'text-text-secondary' : 'text-red'}`}>
              {row.nansenVal}
            </div>
            <div className={`text-[13px] font-medium text-center self-center ${row.arkham && row.arkham.startsWith('✓') ? 'text-text-secondary' : 'text-red'}`}>
              {row.arkham}
            </div>
          </div>
        ))}
      </div>
      <p className="text-center text-[12px] text-text-muted mt-4">
        View our{' '}
        <a href="/wins" className="text-green hover:underline">detected wins ledger →</a>
        {' '}·{' '}
        <a href="/signals/performance" className="text-green hover:underline">signal accuracy dashboard →</a>
      </p>
    </section>
  );
}

function TrustStrip() {
  const names = ['Wintermute', 'Paradigm', 'Jump Crypto', 'a16z Crypto', 'Dragonfly Capital', 'Cumberland DRW', 'Galaxy Digital', 'Vitalik.eth', 'ETH Foundation'];
  return (
    <div className="py-10 border-y border-border-subtle text-center px-6">
      <p className="text-[9px] text-text-muted mb-6 uppercase tracking-[2.5px] font-mono">
        Tracking on-chain wallets from
      </p>
      <div className="flex items-center justify-center gap-6 flex-wrap max-w-4xl mx-auto">
        {names.map((name) => (
          <span
            key={name}
            className="text-[13px] text-text-muted/70 font-medium hover:text-text-secondary transition-colors cursor-default"
          >
            {name}
          </span>
        ))}
      </div>
      <p className="text-[10px] text-text-muted/50 mt-6">
        Public on-chain addresses · Verifiable on{' '}
        <a href="https://etherscan.io" target="_blank" rel="noopener noreferrer" className="text-green/50 hover:text-green/80 underline underline-offset-2 transition-colors">Etherscan</a>
        {' '}· Not affiliated with or endorsed by these organizations.
      </p>
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
        <div className="flex items-center gap-2">
          <span className="inline-flex rounded-full h-1.5 w-1.5 bg-green/70" />
          <span className="font-display font-bold text-text-primary text-sm">NEW</span>
          <span className="text-text-muted text-sm">Invest · Early access</span>
        </div>
      </div>
    </div>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      num: '01',
      title: 'We monitor the depths',
      desc: '2,796 elite ETH wallets tracked 24/7. Every transaction, every move. Scored 0–100 by our proprietary algorithm.',
    },
    {
      num: '02',
      title: 'Claude AI reads the signals',
      desc: 'Every wallet analyzed by Claude. Get BULLISH / BEARISH / NEUTRAL with reasoning — updated every 6 hours automatically.',
    },
    {
      num: '03',
      title: 'You copy. You keep the keys.',
      desc: 'One click executes the trade at your size via MetaMask. Best-rate DEX routing. You never give us custody.',
    },
  ];

  return (
    <section className="py-24 px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="text-[10px] uppercase tracking-[2.5px] text-green mb-3 font-mono">How It Works</div>
          <h2 className="font-display text-[36px] md:text-[44px] font-bold text-text-primary leading-[1.05]">Three steps to copy<br className="hidden md:block" /> smart money.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {steps.map((s, index) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: index * 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-border-default bg-bg-surface p-8 flex flex-col gap-3 hover:border-border-strong transition-colors"
            >
              <div className="font-display text-[56px] font-bold text-green/[0.15] leading-none tabular-nums">{s.num}</div>
              <h3 className="font-display text-[18px] font-bold text-text-primary">{s.title}</h3>
              <p className="text-[14px] text-text-secondary leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
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
          <div className="rounded-2xl border border-border-default bg-bg-surface p-6 opacity-90">
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
          <div className="rounded-2xl border border-green/30 ring-1 ring-green/10 bg-bg-surface p-6 relative overflow-hidden shadow-[0_0_40px_rgba(0,200,100,0.08)]">
            <div className="absolute top-0 right-0 bg-green text-text-inverse text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-xl">Pro</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-green mb-4">Most Popular</div>
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
            <p className="text-center text-[11px] text-text-muted mt-2">No credit card required · Cancel anytime</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// Honest proof instead of fabricated testimonials. We don't invent quotes —
// the product's credibility is the verifiable on-chain track record.
function TestimonialsSection() {
  const PROOF = [
    { k: 'Every signal logged on-chain', v: 'Wins and losses are recorded the moment a ranked trader moves, then scored 24h later against real DEX prices.' },
    { k: 'Non-custodial by design', v: 'Copy trades execute through your own MetaMask. Hadaleum never holds, moves, or can touch your funds.' },
    { k: 'Ranked by performance, not balance', v: 'Traders are scored on realized + unrealized P&L from Dune dex.trades — not how much ETH they happen to hold.' },
  ];
  return (
    <section className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="text-[11px] uppercase tracking-[2px] text-green mb-3">Verified, not vibes</div>
          <h2 className="font-display text-[30px] font-bold text-text-primary">Proof over promises.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {PROOF.map(({ k, v }) => (
            <div key={k} className="rounded-2xl border border-border-default bg-bg-surface p-5">
              <div className="text-sm font-semibold text-text-primary mb-2">{k}</div>
              <p className="text-[13px] text-text-secondary leading-relaxed">{v}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-[12px] text-text-muted mt-6">
          See the live record — <Link to="/wins" className="text-green hover:underline">detected wins ledger →</Link>
        </p>
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
          <Link to="/wins" className="hover:text-text-secondary">Detected Wins</Link>
          <Link to="/watchlist" className="hover:text-text-secondary">Watchlist</Link>
          <Link to="/intelligence" className="hover:text-text-secondary">Intelligence</Link>
          <Link to="/markets" className="hover:text-text-secondary">Markets</Link>
          <Link to="/privacy" className="hover:text-text-secondary">Privacy</Link>
          <Link to="/terms" className="hover:text-text-secondary">Terms</Link>
          <Link to="/about" className="hover:text-text-secondary">About</Link>
          <Link to="/institutional" className="hover:text-text-secondary">Enterprise</Link>
          <a href="https://x.com/hadaleum" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center text-text-muted hover:text-white transition-colors" aria-label="X / Twitter">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M10.97 1H12.9L8.78 5.71 13.67 13h-3.92L6.7 9.06 3.27 13H1.34l4.41-5.04L.67 1h4.02L7.6 4.6 10.97 1Zm-.67 10.79h1.07L3.75 2.1H2.6l7.7 9.69Z" fill="currentColor"/></svg>
          </a>
          <a href="https://discord.gg/hadaleum" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center text-text-muted hover:text-white transition-colors" aria-label="Discord">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M11.61 2.92A11.37 11.37 0 0 0 9.02 2a7.76 7.76 0 0 0-.36.74 10.5 10.5 0 0 0-3.32 0A7.49 7.49 0 0 0 5 2 11.42 11.42 0 0 0 2.38 2.92 12.06 12.06 0 0 0 .5 10.5a11.6 11.6 0 0 0 3.54 1.79c.29-.39.54-.8.76-1.24a7.4 7.4 0 0 1-1.18-.57c.1-.07.2-.15.29-.22a8.27 8.27 0 0 0 7.18 0c.1.08.19.15.29.22-.38.22-.78.41-1.19.57.22.43.47.85.76 1.24a11.55 11.55 0 0 0 3.54-1.79A12.03 12.03 0 0 0 11.61 2.92ZM4.9 8.98c-.72 0-1.3-.66-1.3-1.47S4.17 6.04 4.9 6.04c.72 0 1.31.66 1.3 1.47 0 .81-.58 1.47-1.3 1.47Zm4.2 0c-.71 0-1.3-.66-1.3-1.47S8.38 6.04 9.1 6.04c.72 0 1.31.66 1.3 1.47 0 .81-.58 1.47-1.3 1.47Z" fill="currentColor"/></svg>
          </a>
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
      <WhaleTicker />
      <SocialProofBar />
      <TrustStrip />
      <InvestShowcase />
      <ProductPreviewSection />
      <HowItWorksSection />
      <FeaturesSection />
      <ComparisonSection />
      <PricingSection />
      <TestimonialsSection />

      {/* Final CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto rounded-3xl border border-green/20 bg-bg-surface relative overflow-hidden px-8 py-16"
             style={{ boxShadow: '0 0 80px rgba(0,217,146,0.07), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
          {/* Background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 blur-3xl opacity-[0.15] pointer-events-none rounded-full"
               style={{ background: 'rgba(0,217,146,0.6)' }} />
          <div className="relative">
          <div className="text-[10px] uppercase tracking-[2.5px] text-green mb-4 font-mono">Start today</div>
          <h2 className="font-display text-[40px] md:text-[52px] font-bold text-text-primary leading-[0.96] mb-5">
            The deepest layer of<br />Ethereum intelligence.
          </h2>
          <p className="text-[15px] text-text-secondary leading-relaxed max-w-lg mx-auto mb-10">
            Full 2,796-wallet watchlist, unlimited AI signals, non-custodial copy trading, and instant alerts.
            Start free — upgrade to Pro when you're ready.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <MagneticButton
              type="button"
              onClick={() => navigate('/signup')}
              className="w-full sm:w-auto bg-green text-text-inverse font-semibold text-base px-8 py-4 rounded-2xl shadow-glow hover:bg-green-bright transition-colors"
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
        </div>
      </section>

      <Footer />
    </div>
  );
}
