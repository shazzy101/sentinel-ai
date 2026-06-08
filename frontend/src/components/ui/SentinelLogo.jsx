import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

export default function SentinelLogo({ size = 22, className = '', showWordmark = false }) {
  return (
    <Link
      to="/"
      className={`group inline-flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-green/40 ${className}`}
      aria-label="Sentinel AI — back to home"
    >
      <motion.span
        className="relative flex shrink-0 items-center justify-center"
        style={{ width: size, height: size }}
        whileHover={{ scale: 1.08, rotate: 12 }}
        whileTap={{ scale: 0.95, rotate: -6 }}
        transition={{ type: 'spring', stiffness: 400, damping: 18 }}
      >
        {/* Glow ring on hover */}
        <span
          className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ boxShadow: '0 0 24px rgba(0,217,146,0.45)' }}
        />
        <svg width={size} height={size} viewBox="0 0 22 22" fill="none" className="relative z-10">
          <motion.path
            d="M11 1.6L18.7 6.1V15.9L11 20.4L3.3 15.9V6.1L11 1.6Z"
            fill="#00D992"
            initial={false}
            whileHover={{ fill: '#00F5A0' }}
            transition={{ duration: 0.2 }}
          />
          {/* Inner pulse facet */}
          <motion.path
            d="M11 6.5L15.2 9V13L11 15.5L6.8 13V9L11 6.5Z"
            fill="rgba(9,9,11,0.35)"
            animate={{ opacity: [0.25, 0.55, 0.25] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </svg>
      </motion.span>
      {showWordmark && (
        <>
          <span className="font-display text-[15px] font-bold tracking-tight text-text-primary group-hover:text-green transition-colors duration-200">
            Sentinel
          </span>
          <span className="rounded-md bg-green/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-green">
            AI
          </span>
        </>
      )}
    </Link>
  );
}

/** Static hex for contexts that can't use Link (e.g. landing inline) */
export function HexLogo({ size = 22, animated = false }) {
  const Wrapper = animated ? motion.div : 'div';
  const props = animated
    ? { whileHover: { scale: 1.08, rotate: 10 }, transition: { type: 'spring', stiffness: 400, damping: 18 } }
    : {};

  return (
    <Wrapper className="flex-shrink-0" {...props}>
      <svg width={size} height={size} viewBox="0 0 22 22" fill="none">
        <path d="M11 1.6L18.7 6.1V15.9L11 20.4L3.3 15.9V6.1L11 1.6Z" fill="#00D992" />
      </svg>
    </Wrapper>
  );
}
