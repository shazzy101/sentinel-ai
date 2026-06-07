import { useEffect, useMemo, useState } from 'react';

function scoreColor(score) {
  if (score >= 80) return '#00D992';
  if (score >= 60) return '#F59E0B';
  return '#FF4D4D';
}

export default function ScoreRing({ score = 0, size = 48, strokeWidth = 3 }) {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
  const [animatedScore, setAnimatedScore] = useState(0);
  const radius = useMemo(() => (size - strokeWidth * 2) / 2, [size, strokeWidth]);
  const circumference = useMemo(() => 2 * Math.PI * radius, [radius]);
  const dashOffset = circumference - (animatedScore / 100) * circumference;

  useEffect(() => {
    const t = setTimeout(() => setAnimatedScore(safeScore), 20);
    return () => clearTimeout(t);
  }, [safeScore]);

  return (
    <div className="relative inline-flex items-center justify-center" aria-label={`Score ${safeScore}`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#1A1A20"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={scoreColor(safeScore)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 1s ease' }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="absolute text-[12px] font-bold font-display text-text-primary">
        {safeScore}
      </span>
    </div>
  );
}
