import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'motion/react';
import { Copy, CheckCircle2, Fish, ArrowRight, Zap, BarChart3, Sparkles } from 'lucide-react';
import MagneticButton from '../primitives/MagneticButton';

const PHASES = [
  { id: 'whale', duration: 3200 },
  { id: 'copy', duration: 2800 },
  { id: 'swap', duration: 3000 },
  { id: 'success', duration: 3200 },
];

const FEATURE_PILLS = [
  { icon: Fish, label: 'Copy whale trades' },
  { icon: BarChart3, label: 'Markets' },
  { icon: Sparkles, label: 'AI intelligence' },
  { icon: Zap, label: 'DEX aggregation' },
];

function MockSwapUI({ phase }) {
  return (
    <div className="absolute inset-0 p-4 flex flex-col">
      {/* Mini topbar */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold text-text-primary">Invest</span>
        <span className="h-1.5 w-1.5 rounded-full bg-green/70" />
      </div>

      <AnimatePresence mode="wait">
        {phase === 'whale' && (
          <motion.div
            key="whale"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex-1 flex flex-col"
          >
            <div className="rounded-xl border border-green/30 bg-green/10 p-3 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <Fish className="h-3.5 w-3.5 text-green" />
                <span className="text-[10px] font-bold uppercase tracking-wide text-green">Whale move detected</span>
              </div>
              <div className="text-xs font-semibold text-text-primary">Wintermute</div>
              <div className="text-[10px] font-mono text-text-muted mt-1">Sent 847.52 ETH · 12m ago</div>
              <div className="mt-2 text-[10px] text-text-secondary">Signal: <span className="text-green font-bold">BULLISH</span></div>
            </div>
            <motion.div
              animate={{ boxShadow: ['0 0 0 0 rgba(0,217,146,0)', '0 0 0 8px rgba(0,217,146,0.15)', '0 0 0 0 rgba(0,217,146,0)'] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="mt-auto rounded-xl bg-green text-text-inverse text-center py-2.5 text-[11px] font-bold flex items-center justify-center gap-1.5"
            >
              <Copy className="h-3 w-3" /> Copy trade
            </motion.div>
          </motion.div>
        )}

        {phase === 'copy' && (
          <motion.div
            key="copy"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 space-y-2"
          >
            <div className="text-[9px] uppercase tracking-widest text-text-muted mb-2">You pay</div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xl font-display font-bold text-text-primary">8.47</div>
              <div className="text-[10px] text-text-muted">ETH · ≈ $28,400</div>
            </div>
            <div className="flex justify-center py-1">
              <motion.div animate={{ rotate: 180 }} transition={{ duration: 0.6 }} className="text-text-muted text-sm">↕</motion.div>
            </div>
            <div className="text-[9px] uppercase tracking-widest text-text-muted mb-2">You receive</div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xl font-display font-bold text-green">8.46</div>
              <div className="text-[10px] text-text-muted">WETH</div>
            </div>
            <div className="mt-2 text-[9px] text-text-muted text-center">Best rate via Uniswap + Curve</div>
          </motion.div>
        )}

        {phase === 'swap' && (
          <motion.div
            key="swap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-14 h-14 rounded-full border-2 border-green/30 border-t-green mb-4"
            />
            <div className="text-sm font-semibold text-text-primary">Confirming in MetaMask</div>
            <div className="text-[10px] text-text-muted mt-1">Routing through 3 DEXs…</div>
            <div className="mt-4 w-full space-y-1.5">
              {['Uniswap V3', 'Curve', 'Balancer'].map((dex, i) => (
                <motion.div
                  key={dex}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.3 }}
                  className="flex items-center gap-2 text-[10px] text-text-secondary"
                >
                  <span className="h-1 w-1 rounded-full bg-green" /> {dex}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {phase === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <CheckCircle2 className="h-12 w-12 text-green mb-3" strokeWidth={1.5} />
            </motion.div>
            <div className="text-sm font-bold text-green">Trade confirmed</div>
            <div className="text-[10px] font-mono text-text-muted mt-2">0x8f3a…2b91</div>
            <div className="mt-4 w-full h-12 rounded-lg overflow-hidden relative">
              <svg viewBox="0 0 200 40" className="w-full h-full" preserveAspectRatio="none">
                <motion.path
                  d="M0 30 Q 50 10, 100 25 T 200 8"
                  fill="none"
                  stroke="#00D992"
                  strokeWidth="2"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.2 }}
                />
                <motion.path
                  d="M0 30 Q 50 10, 100 25 T 200 8 V 40 H 0 Z"
                  fill="url(#sg)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.25 }}
                  transition={{ delay: 0.5 }}
                />
                <defs>
                  <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00D992" />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function InvestShowcase() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const phase = PHASES[phaseIdx].id;

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [8, -8]), { stiffness: 120, damping: 20 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-12, 12]), { stiffness: 120, damping: 20 });

  // Auto-cycle demo phases
  useEffect(() => {
    const t = setTimeout(() => {
      setPhaseIdx((i) => (i + 1) % PHASES.length);
    }, PHASES[phaseIdx].duration);
    return () => clearTimeout(t);
  }, [phaseIdx]);

  // Continuous slow rotation
  const [spin, setSpin] = useState(0);
  useEffect(() => {
    let raf;
    let last = performance.now();
    const tick = (now) => {
      setSpin((s) => s + (now - last) * 0.008);
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onMouseMove = (e) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  return (
    <section className="relative py-28 px-6 overflow-hidden">
      {/* Ambient orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full opacity-20 blur-[100px]" style={{ background: 'radial-gradient(circle, rgba(0,217,146,0.4), transparent 70%)' }} />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full opacity-15 blur-[80px]" style={{ background: 'radial-gradient(circle, rgba(129,140,248,0.35), transparent 70%)' }} />
      </div>

      <div className="relative max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Copy */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-green/25 bg-green/10 px-3 py-1.5 mb-5">
                <Zap className="h-3.5 w-3.5 text-green" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-green">New · Invest</span>
              </div>
              <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-text-primary leading-[1.08] mb-5">
                Copy whale trades.
                <br />
                <span className="gradient-text-accent">Execute in seconds.</span> <span className="text-text-muted text-3xl md:text-4xl font-semibold">(Beta)</span>
              </h2>
              <p className="text-lg text-text-secondary leading-relaxed mb-8 max-w-lg">
                When Wintermute moves 847 ETH, it surfaces in your feed. One click copies the trade at your size — routed through every major DEX, signed in MetaMask. Non-custodial.
              </p>

              <div className="flex flex-wrap gap-2 mb-8">
                {FEATURE_PILLS.map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] text-text-secondary"
                  >
                    <Icon className="h-3 w-3 text-green" strokeWidth={2} />
                    {label}
                  </span>
                ))}
              </div>

              <MagneticButton
                type="button"
                onClick={() => navigate('/invest')}
                className="inline-flex items-center gap-2 bg-green text-text-inverse font-semibold text-base px-8 py-3.5 rounded-2xl shadow-glow hover:bg-green-bright transition-colors"
              >
                Try Invest <ArrowRight className="h-4 w-4" />
              </MagneticButton>
            </motion.div>
          </div>

          {/* 3D rotating device mockup */}
          <div
            ref={containerRef}
            onMouseMove={onMouseMove}
            onMouseLeave={() => { mouseX.set(0); mouseY.set(0); }}
            className="relative flex justify-center perspective-[1200px]"
            style={{ perspective: '1200px' }}
          >
            {/* Orbit ring */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ rotate: spin }}
            >
              <div className="w-[340px] h-[340px] rounded-full border border-dashed border-white/[0.06]" />
            </motion.div>

            <motion.div
              style={{
                rotateX,
                rotateY,
                transformStyle: 'preserve-3d',
              }}
              className="relative w-[280px] md:w-[300px]"
            >
              {/* Device frame */}
              <div className="rounded-[28px] border border-white/[0.12] bg-gradient-to-b from-[#141418] to-[#0a0a0c] shadow-elevated overflow-hidden"
                style={{ boxShadow: '0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06), 0 0 60px rgba(0,217,146,0.08)' }}
              >
                {/* Notch */}
                <div className="h-6 bg-black/40 flex items-center justify-center border-b border-white/[0.04]">
                  <div className="w-16 h-1 rounded-full bg-white/10" />
                </div>
                {/* Screen */}
                <div className="relative h-[380px] bg-bg-base">
                  <MockSwapUI phase={phase} />
                </div>
              </div>

              {/* Phase indicator dots */}
              <div className="flex justify-center gap-2 mt-5">
                {PHASES.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPhaseIdx(i)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === phaseIdx ? 'w-6 bg-green' : 'w-1.5 bg-white/20'
                    }`}
                    aria-label={`Show ${p.id} phase`}
                  />
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
