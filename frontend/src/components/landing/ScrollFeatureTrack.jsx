import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { TextureCard, TextureCardContent, TextureCardTitle, TextureCardDescription } from '@/components/ui/texture-card';

const STEPS = [
  {
    num: '01',
    title: 'Discover',
    body: 'Surface the signal by tracking 94 labelled Ethereum whale wallets — exchange hot wallets filtered out.',
  },
  {
    num: '02',
    title: 'Score',
    body: 'Every wallet gets a 0–100 intelligence score from activity, success rate, balance tier, and recency.',
  },
  {
    num: '03',
    title: 'Alert',
    body: 'Set rules on signal changes and score thresholds. Get notified the moment smart money moves.',
  },
  {
    num: '04',
    title: 'Intelligence',
    body: 'Daily AI market brief, flow state, and bullish/bearish signal feed — powered by Claude.',
  },
];

const SPINE_HEIGHT = 720;

function StepCard({ step, index, progress }) {
  const start = 0.08 + index * 0.16;
  const opacity = useTransform(progress, [start, start + 0.1], [0.25, 1]);
  const x = useTransform(progress, [start, start + 0.12], [48, 0]);

  return (
    <motion.div style={{ opacity, x }}>
      <TextureCard className="h-full">
        <TextureCardContent className="p-6 md:p-8">
          <span className="text-[11px] font-mono text-green tracking-widest">{step.num}</span>
          <TextureCardTitle className="text-text-primary pl-0 text-2xl md:text-3xl font-display font-bold mt-2 mb-3">
            {step.title}
          </TextureCardTitle>
          <TextureCardDescription className="pl-0 text-text-secondary text-[15px] leading-relaxed max-w-md">
            {step.body}
          </TextureCardDescription>
        </TextureCardContent>
      </TextureCard>
    </motion.div>
  );
}

export default function ScrollFeatureTrack() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.8', 'end 0.2'] });
  const lineOffset = useTransform(scrollYProgress, [0, 1], [SPINE_HEIGHT, 0]);

  return (
    <section ref={ref} className="relative py-32 border-t border-border-subtle">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-20 max-w-2xl"
        >
          <p className="text-[11px] uppercase tracking-[4px] text-green font-mono mb-4">How it works</p>
          <h2 className="font-display text-[clamp(2rem,5vw,3.5rem)] font-bold leading-tight tracking-tight">
            Surface the signal.
            <br />
            <span className="text-text-secondary">Create winners.</span>
          </h2>
        </motion.div>

        <div className="relative grid md:grid-cols-[56px_1fr] gap-x-10 gap-y-12">
          <div className="hidden md:flex justify-center">
            <svg width="32" height={SPINE_HEIGHT} viewBox={`0 0 32 ${SPINE_HEIGHT}`} className="overflow-visible" aria-hidden="true">
              <line x1="16" y1="0" x2="16" y2={SPINE_HEIGHT} stroke="#28283A" strokeWidth="2" />
              <motion.line
                x1="16"
                y1="0"
                x2="16"
                y2={SPINE_HEIGHT}
                stroke="#00D992"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={SPINE_HEIGHT}
                style={{ strokeDashoffset: lineOffset }}
              />
              {STEPS.map((_, i) => {
                const cy = 40 + i * ((SPINE_HEIGHT - 80) / (STEPS.length - 1));
                return (
                  <motion.circle
                    key={i}
                    cx="16"
                    cy={cy}
                    r="7"
                    fill="#09090B"
                    stroke="#00D992"
                    strokeWidth="2"
                    style={{
                      opacity: useTransform(scrollYProgress, [i * 0.2, i * 0.2 + 0.15], [0.25, 1]),
                    }}
                  />
                );
              })}
            </svg>
          </div>

          <div className="flex flex-col gap-10 md:gap-14">
            {STEPS.map((step, i) => (
              <StepCard key={step.title} step={step} index={i} progress={scrollYProgress} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
