import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { motionTokens } from '@/design/motion';

/**
 * Premium surface card — glass depth, spotlight hover, subtle elevation.
 * Stripe/Linear-inspired: restrained glow, never flashy.
 */
export default function GlassCard({
  children,
  className,
  hover = true,
  spotlight = true,
  padding = true,
  as: Component = motion.div,
  ...props
}) {
  const ref = useRef(null);
  const [spot, setSpot] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMove = (e) => {
    if (!spotlight || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setSpot({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
      opacity: 1,
    });
  };

  return (
    <Component
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={() => setSpot((s) => ({ ...s, opacity: 0 }))}
      whileHover={hover ? { y: -1 } : undefined}
      transition={motionTokens.springSoft}
      className={cn(
        'relative overflow-hidden rounded-2xl',
        'border border-white/[0.06]',
        'bg-gradient-to-b from-white/[0.04] to-transparent',
        'shadow-card backdrop-blur-xl',
        'before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl',
        'before:bg-gradient-to-b before:from-white/[0.03] before:to-transparent',
        hover && 'transition-shadow duration-300 hover:shadow-card-hover hover:border-white/[0.09]',
        className,
      )}
      {...props}
    >
      {spotlight && (
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-500"
          style={{
            opacity: spot.opacity,
            background: `radial-gradient(600px circle at ${spot.x}% ${spot.y}%, rgba(0,217,146,0.07), transparent 40%)`,
          }}
        />
      )}
      <div className={cn('relative', padding && 'p-5')}>{children}</div>
    </Component>
  );
}
