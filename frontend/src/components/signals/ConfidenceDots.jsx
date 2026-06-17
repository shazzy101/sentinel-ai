/**
 * ConfidenceDots — renders 5 dots representing confidence score.
 * Filled dots (●) use signal green; hollow dots (○) are muted.
 * score: 1–5
 */
export default function ConfidenceDots({ score = 1 }) {
  const clamped = Math.min(5, Math.max(1, score));

  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`Confidence ${clamped} of 5`}
      role="img"
    >
      {Array.from({ length: 5 }, (_, i) => {
        const filled = i < clamped;
        return (
          <span
            key={i}
            className={filled ? 'text-signal text-xs leading-none' : 'text-text-muted text-xs leading-none'}
            aria-hidden="true"
          >
            {filled ? '●' : '○'}
          </span>
        );
      })}
    </span>
  );
}
