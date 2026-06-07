export default function Input({
  error = false,
  mono = false,
  className = '',
  ...props
}) {
  const baseClass = 'bg-bg-elevated border border-border-default rounded-lg px-3 py-2 text-[13px] text-text-primary placeholder:text-text-muted outline-none focus:border-border-focus transition-colors duration-150';
  const fontClass = mono ? 'font-mono' : 'font-body';
  const errorClass = error ? 'border-red ring-1 ring-red-border' : '';

  return (
    <input
      className={`${baseClass} ${fontClass} ${errorClass} ${className}`.trim()}
      {...props}
    />
  );
}
