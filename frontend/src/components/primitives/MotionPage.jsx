import { motion } from 'motion/react';
import { fadeUp, motionTokens } from '@/design/motion';

export default function MotionPage({ children, className = '' }) {
  return (
    <motion.div
      initial={fadeUp.initial}
      animate={fadeUp.animate}
      exit={fadeUp.exit}
      transition={motionTokens.page}
      className={className}
    >
      {children}
    </motion.div>
  );
}
