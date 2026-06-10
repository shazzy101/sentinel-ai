import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { TextureButton } from '@/components/ui/texture-button';
import TextShimmer from '@/components/ui/text-shimmer';

const LINES = ['Surface', 'The', 'Signal'];

export default function NansenHero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });

  const headlineY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const headlineOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const subOpacity = useTransform(scrollYProgress, [0, 0.4], [1, 0]);

  return (
    <section ref={ref} className="relative min-h-[100vh] flex items-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bg-base/40 to-bg-base pointer-events-none" />

      <motion.div
        style={{ y: headlineY, opacity: headlineOpacity }}
        className="relative z-10 max-w-6xl mx-auto px-6 py-28 w-full"
      >
        <div className="max-w-4xl">
          {LINES.map((line, i) => (
            <motion.div
              key={line}
              initial={{ opacity: 0, y: 40, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{
                delay: 0.12 + i * 0.14,
                duration: 0.7,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="overflow-hidden"
            >
              <h1
                className={`font-display font-bold leading-[0.92] tracking-[-0.03em] ${
                  i === LINES.length - 1
                    ? 'text-[clamp(3.5rem,11vw,7.5rem)] text-green'
                    : 'text-[clamp(3rem,10vw,6.5rem)] text-text-primary'
                }`}
              >
                {i === LINES.length - 1 ? (
                  <TextShimmer as="span" className="font-display font-bold">
                    {line}
                  </TextShimmer>
                ) : (
                  line
                )}
              </h1>
            </motion.div>
          ))}

          <motion.p
            style={{ opacity: subOpacity }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.6 }}
            className="mt-8 text-[clamp(1.1rem,2.5vw,1.5rem)] text-text-secondary max-w-xl leading-relaxed font-light"
          >
            Trade everything onchain with clarity — powered by{' '}
            <span className="text-text-primary font-medium">Smart Money</span> intelligence.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="mt-10 flex flex-wrap items-center gap-4"
          >
            <Link to="/">
              <TextureButton variant="primary" size="lg" className="!w-auto min-w-[200px]">
                <span className="flex items-center justify-center gap-2 px-3 text-green font-semibold text-[15px]">
                  Start Tracking <ArrowRight className="h-4 w-4" />
                </span>
              </TextureButton>
            </Link>
            <span className="text-[13px] text-text-muted font-mono">800+ wallets · Claude AI · Free beta</span>
          </motion.div>
        </div>

        {/* Scroll cue */}
        <motion.div
          style={{ opacity: useTransform(scrollYProgress, [0, 0.15], [1, 0]) }}
          className="absolute bottom-8 left-6 flex flex-col items-center gap-2 text-text-muted"
        >
          <span className="text-[10px] uppercase tracking-[2px] font-mono">Scroll</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-px h-8 bg-gradient-to-b from-green/80 to-transparent"
          />
        </motion.div>
      </motion.div>
    </section>
  );
}
