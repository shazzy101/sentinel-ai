import { TextureCard, TextureCardContent } from '@/components/ui/texture-card';
import { cn } from '@/lib/utils';

export default function PremiumStatCard({
  label,
  value,
  sub,
  valueClassName = 'text-text-primary',
  className,
}) {
  return (
    <TextureCard className={cn('overflow-hidden', className)}>
      <TextureCardContent className="px-5 py-4">
        <div className="text-[10px] uppercase tracking-[1.2px] text-text-muted mb-2">{label}</div>
        <div className={cn('font-display text-[26px] font-bold leading-none', valueClassName)}>{value}</div>
        {sub ? <div className="text-[11px] text-text-muted mt-2">{sub}</div> : null}
      </TextureCardContent>
    </TextureCard>
  );
}
