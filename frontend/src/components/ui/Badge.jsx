const SIGNAL_CLASSES = {
  BULLISH: 'bg-green-dim border border-green-border text-green',
  BEARISH: 'bg-red-dim border border-red-border text-red',
  NEUTRAL: 'bg-amber-dim border border-amber-border text-amber',
};

const GRADE_CLASSES = {
  S: 'bg-green-dim text-green',
  A: 'bg-green-dim text-green opacity-80',
  B: 'bg-blue-dim text-blue',
  C: 'bg-amber-dim text-amber',
  D: 'bg-red-dim text-red',
  F: 'bg-red-dim text-red',
};

const RISK_CLASSES = {
  LOW: 'text-green bg-green-dim border border-green-border',
  MEDIUM: 'text-amber bg-amber-dim border border-amber-border',
  HIGH: 'text-red bg-red-dim border border-red-border',
};

export function SignalPill({ signal }) {
  const normalized = (signal || 'NEUTRAL').toUpperCase();
  const classes = SIGNAL_CLASSES[normalized] || SIGNAL_CLASSES.NEUTRAL;

  return (
    <span className={`text-[10px] font-bold uppercase tracking-[0.8px] px-2 py-[3px] rounded-[4px] inline-flex items-center gap-1 ${classes}`.trim()}>
      <span className="h-[5px] w-[5px] rounded-full bg-current" />
      {normalized}
    </span>
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
