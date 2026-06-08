import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

/** Animated shimmer headline — Cult-style text effect */
export default function TextShimmer({
  children,
  className,
  as: Tag = 'span',
}) {
  return (
    <Tag className={cn('relative inline-block', className)}>
      <motion.span
        className="bg-gradient-to-r from-green via-green-bright to-green bg-[length:200%_100%] bg-clip-text text-transparent"
        animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        style={{ backgroundSize: '200% 100%' }}
      >
        {children}
      </motion.span>
    </Tag>
  );
}
