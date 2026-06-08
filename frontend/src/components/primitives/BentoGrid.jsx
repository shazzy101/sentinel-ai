import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { motionTokens } from '@/design/motion';

export function BentoGrid({ children, className, cols = 4 }) {
  const colClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
  }[cols] || 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4';

  return (
    <div className={cn('grid gap-3', colClass, className)}>
      {children}
    </div>
  );
}

export function BentoItem({
  children,
  className,
  span = 1,
  delay = 0,
}) {
  const spanClass = span === 2 ? 'sm:col-span-2' : span === 3 ? 'sm:col-span-2 lg:col-span-3' : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...motionTokens.easeOut, delay }}
      className={cn(spanClass, className)}
    >
      {children}
    </motion.div>
  );
}
