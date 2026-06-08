/** Apple-inspired motion tokens — fast, intentional, never bouncy */
export const motionTokens = {
  spring: { type: 'spring', stiffness: 380, damping: 32, mass: 0.8 },
  springSoft: { type: 'spring', stiffness: 260, damping: 28, mass: 0.9 },
  easeOut: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
  easeInOut: { duration: 0.32, ease: [0.65, 0, 0.35, 1] },
  stagger: 0.04,
  page: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
};

export const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
};
