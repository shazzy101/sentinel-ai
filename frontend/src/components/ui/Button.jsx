import { cn } from '@/lib/utils';
import MagneticButton from '../primitives/MagneticButton';

const VARIANT_CLASSES = {
  primary: cn(
    'bg-green text-text-inverse font-medium text-sm px-4 py-2 rounded-xl',
    'shadow-glow hover:bg-green-bright',
    'border border-green/20',
    'transition-colors duration-200',
  ),
  ghost: cn(
    'border border-white/[0.08] text-text-secondary text-sm px-4 py-2 rounded-xl',
    'bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12] hover:text-text-primary',
    'transition-all duration-200',
  ),
  danger: cn(
    'border border-red/30 text-red text-sm px-4 py-2 rounded-xl',
    'bg-red/5 hover:bg-red/10 transition-colors duration-200',
  ),
  icon: cn(
    'p-2 rounded-xl hover:bg-white/[0.05] text-text-muted hover:text-text-primary',
    'transition-colors duration-200',
  ),
};

export default function Button({
  variant = 'ghost',
  fullWidth = false,
  className = '',
  type = 'button',
  magnetic = false,
  ...props
}) {
  const variantClass = VARIANT_CLASSES[variant] || VARIANT_CLASSES.ghost;
  const widthClass = fullWidth ? 'w-full justify-center' : '';
  const classes = cn(
    'disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2',
    variantClass,
    widthClass,
    className,
  );

  if (magnetic && variant === 'primary') {
    return (
      <MagneticButton type={type} className={classes} {...props} />
    );
  }

  return (
    <button type={type} className={classes} {...props} />
  );
}
