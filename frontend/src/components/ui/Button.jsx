const VARIANT_CLASSES = {
  primary: 'bg-green text-text-inverse font-medium text-[13px] px-4 py-2 rounded-lg hover:bg-green-bright active:scale-[0.98] transition-all duration-150',
  ghost: 'border border-border-default text-text-secondary text-[13px] px-4 py-2 rounded-lg hover:border-border-strong hover:text-text-primary hover:bg-bg-elevated transition-all duration-150',
  danger: 'border border-red-border text-red text-[13px] px-4 py-2 rounded-lg hover:bg-red-dim transition-all duration-150',
  icon: 'p-2 rounded-lg hover:bg-bg-elevated text-text-secondary hover:text-text-primary transition-all duration-150',
};

export default function Button({
  variant = 'ghost',
  fullWidth = false,
  className = '',
  type = 'button',
  ...props
}) {
  const variantClass = VARIANT_CLASSES[variant] || VARIANT_CLASSES.ghost;
  const widthClass = fullWidth ? 'w-full justify-center' : '';

  return (
    <button
      type={type}
      className={`disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 ${variantClass} ${widthClass} ${className}`.trim()}
      {...props}
    />
  );
}
