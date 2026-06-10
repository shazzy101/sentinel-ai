import { motion } from 'motion/react';

const SIGNAL_CLASSES = {
  BULLISH: 'bg-green-dim border border-green-border text-green',
  BEARISH: 'bg-red-dim border border-red-border text-red',
  NEUTRAL: 'bg-amber-dim border border-amber-border text-amber',
};

const GRADE_CLASSES = {
  S: 'bg-green/20 text-green border border-green/30',
  A: 'bg-green/10 text-green border border-green/20',
  B: 'bg-amber/20 text-amber border border-amber/30',
  C: 'bg-amber/10 text-amber border border-amber/20',
  D: 'bg-red/15 text-red border border-red/25',
  F: 'bg-red/25 text-red border border-red/40',
};

const RISK_CLASSES = {
  LOW: 'text-green bg-green-dim border border-green-border',
  MEDIUM: 'text-amber bg-amber-dim border border-amber-border',
  HIGH: 'text-red bg-red-dim border border-red-border',
};

const SIGNAL_ARROW = {
  BULLISH: '↑',
  BEARISH: '↓',
  NEUTRAL: '—',
};

export function SignalPill({ signal }) {
  const normalized = (signal || 'NEUTRAL').toUpperCase();
  const classes = SIGNAL_CLASSES[normalized] || SIGNAL_CLASSES.NEUTRAL;
  const arrow = SIGNAL_ARROW[normalized] || SIGNAL_ARROW.NEUTRAL;

  return (
    <motion.span
      key={normalized}
      initial={{ opacity: 0, scale: 0.8, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 4 }}
      transition={{ duration: 0.2 }}
      className={`text-[10px] font-bold uppercase tracking-[0.8px] px-2 py-[3px] rounded-[4px] inline-flex items-center gap-1 transition-all duration-200 hover:scale-105 active:scale-95 ${classes}`.trim()}
    >
      <span className="text-[9px] leading-none">{arrow}</span>
      {normalized}
    </motion.span>
  );
}

export function ChainBadge({ chain }) {
  const label = chain?.toUpperCase() === 'ETHEREUM' ? 'ETH' : 'ETH';
  return (
    <span className="bg-eth-dim text-eth text-[10px] font-bold px-1.5 py-[3px] rounded-[4px] font-mono">
      {label}
    </span>
  );
}

export function GradeBadge({ grade }) {
  const normalized = (grade || 'C').toUpperCase();
  const classes = GRADE_CLASSES[normalized] || GRADE_CLASSES.C;

  return (
    <span className={`w-6 h-6 rounded flex items-center justify-center text-[11px] font-bold font-display ${classes}`.trim()}>
      {normalized}
    </span>
  );
}

export function RiskBadge({ level }) {
  const normalized = (level || 'MEDIUM').toUpperCase();
  const classes = RISK_CLASSES[normalized] || RISK_CLASSES.MEDIUM;

  return (
    <span className={`text-[10px] font-bold uppercase tracking-[0.8px] px-2 py-[3px] rounded-[4px] inline-flex items-center gap-1 ${classes}`.trim()}>
      <span className="h-[5px] w-[5px] rounded-full bg-current" />
      {normalized}
    </span>
  );
}
