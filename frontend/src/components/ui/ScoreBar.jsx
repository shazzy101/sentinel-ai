import { useEffect, useState } from 'react';

function getScoreColor(score) {
  if (score >= 80) return 'bg-score-high text-score-high';
  if (score >= 60) return 'bg-score-mid text-score-mid';
  return 'bg-score-low text-score-low';
}

export default function ScoreBar({ score = 0, showLabel = false }) {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
  const [mounted, setMounted] = useState(false);
  const colorClasses = getScoreColor(safeScore);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="w-full">
      <svg className="h-[2px] w-full overflow-visible" viewBox="0 0 100 2" preserveAspectRatio="none" aria-hidden="true">
        <rect x="0" y="0" width="100" height="2" className="fill-bg-elevated" rx="1" />
        <rect
          x="0"
          y="0"
          width={mounted ? safeScore : 0}
          height="2"
          className={`${colorClasses.split(' ')[0]} transition-all duration-700`.trim()}
          rx="1"
        />
      </svg>
      {showLabel ? (
        <div className={`mt-1 text-right text-[12px] font-mono font-medium ${colorClasses.split(' ')[1]}`.trim()}>
          {safeScore}
        </div>
      ) : null}
    </div>
  );
}
