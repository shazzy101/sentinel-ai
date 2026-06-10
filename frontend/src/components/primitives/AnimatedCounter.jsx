import { useEffect, useRef, useState } from 'react';
import { useInView, motion, useSpring, useTransform } from 'motion/react';

export default function AnimatedCounter({
  value,
  duration = 1.2,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '0px' });
  const spring = useSpring(0, { stiffness: 300, damping: 30, restDelta: 0.5, restSpeed: 0.5 });
  const display = useTransform(spring, (v) =>
    `${prefix}${v.toFixed(decimals)}${suffix}`,
  );
  const [text, setText] = useState(`${prefix}0${suffix}`);

  useEffect(() => {
    if (inView) spring.set(Number(value) || 0);
  }, [inView, value, spring]);

  useEffect(() => {
    const unsub = display.on('change', (v) => setText(v));
    return unsub;
  }, [display]);

  return (
    <motion.span ref={ref} className={className}>
      {text}
    </motion.span>
  );
}
