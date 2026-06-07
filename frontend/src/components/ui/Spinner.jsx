const SIZE_MAP = {
  sm: 'h-[14px] w-[14px]',
  md: 'h-[20px] w-[20px]',
  lg: 'h-[32px] w-[32px]',
};

export default function Spinner({ size = 'md', className = '' }) {
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <svg
      className={`${sizeClass} animate-spin text-current ${className}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="40 18"
        opacity="0.9"
      />
    </svg>
  );
}
