import { motion, useScroll, useTransform } from 'motion/react';

/**
 * Page-wide SVG network — paths draw in as user scrolls (Nansen-style).
 */
export default function ScrollWhalePaths({ className = '' }) {
  const { scrollYProgress } = useScroll();

  const draw1 = useTransform(scrollYProgress, [0, 0.25], [0, 1]);
  const draw2 = useTransform(scrollYProgress, [0.08, 0.4], [0, 1]);
  const draw3 = useTransform(scrollYProgress, [0.15, 0.55], [0, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.1, 0.7, 1], [0.2, 0.6, 0.5, 0.25]);
  const yShift = useTransform(scrollYProgress, [0, 1], ['0%', '22%']);

  const paths = [
    { id: 'p1', d: 'M80 420 C 200 280, 340 520, 480 360 S 720 180, 920 320', draw: draw1 },
    { id: 'p2', d: 'M120 680 C 280 540, 400 760, 560 580 S 840 420, 1100 560', draw: draw2 },
    { id: 'p3', d: 'M60 900 C 220 780, 380 980, 520 820 S 780 640, 980 780', draw: draw3 },
    { id: 'p4', d: 'M900 120 C 760 260, 640 80, 520 220 S 280 380, 140 240', draw: draw2 },
    { id: 'p5', d: 'M1000 480 C 860 620, 720 440, 580 580 S 340 720, 200 560', draw: draw3 },
  ];

  const nodes = [
    { cx: 480, cy: 360, r: 5 },
    { cx: 920, cy: 320, r: 4 },
    { cx: 560, cy: 580, r: 5 },
    { cx: 520, cy: 820, r: 4 },
    { cx: 520, cy: 220, r: 5 },
    { cx: 340, cy: 720, r: 4 },
  ];

  return (
    <div className={`pointer-events-none fixed inset-0 overflow-hidden z-0 ${className}`} aria-hidden="true">
      <motion.div style={{ y: yShift, opacity }} className="absolute inset-0">
        <svg
          className="absolute right-[-8%] top-[5%] h-[90vh] w-[80vw] max-w-[960px]"
          viewBox="0 0 1200 1000"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="sentinel-path-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00D992" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#627EEA" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#00D992" stopOpacity="0.15" />
            </linearGradient>
            <filter id="sentinel-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {paths.map(({ id, d, draw }) => (
            <motion.path
              key={id}
              d={d}
              stroke="url(#sentinel-path-grad)"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
              filter="url(#sentinel-glow)"
              style={{ pathLength: draw }}
            />
          ))}

          {nodes.map(({ cx, cy, r }, i) => (
            <motion.circle
              key={`node-${i}`}
              cx={cx}
              cy={cy}
              r={r}
              fill="#00D992"
              style={{ opacity: draw2 }}
            />
          ))}
        </svg>
      </motion.div>

      <motion.div
        style={{ opacity: useTransform(scrollYProgress, [0, 0.35], [0.04, 0.1]) }}
        className="absolute inset-0 bg-[linear-gradient(rgba(0,217,146,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(0,217,146,0.07)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_80%_60%_at_70%_30%,black,transparent)]"
      />
    </div>
  );
}
