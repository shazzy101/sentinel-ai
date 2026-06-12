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
    const target = Number(value) || 0;
    if (inView) spring.set(target);
    // Guarantee the counter lands on the real value even if the in-view observer
    // never fires (above-the-fold elements sometimes miss it) — otherwise the
    // stat strip is stuck showing 0, which looks broken.
    const fallback = setTimeout(() => spring.set(target), 900);
    return () => clearTimeout(fallback);
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
