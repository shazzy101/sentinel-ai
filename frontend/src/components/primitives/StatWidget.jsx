import GlassCard from './GlassCard';
import AnimatedCounter from './AnimatedCounter';
import { cn } from '@/lib/utils';

/**
 * Dashboard stat widget — used in bento layouts across app pages.
 */
export default function StatWidget({
  label,
  value,
  sub,
  trend,
  icon: Icon,
  animate = true,
  className,
}) {
  const trendColor = trend > 0 ? 'text-green' : trend < 0 ? 'text-red' : 'text-text-muted';

  return (
    <GlassCard padding={false} hover={false} className={cn('h-full', className)}>
      <div className="p-4 flex flex-col h-full min-h-[88px]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
            {label}
          </span>
          {Icon && (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06]">
              <Icon className="h-3.5 w-3.5 text-text-muted" strokeWidth={1.75} />
            </div>
          )}
        </div>
        <div className="font-display text-[26px] font-semibold tracking-[-0.02em] text-text-primary leading-none">
          {animate && typeof value === 'number' ? (
            <AnimatedCounter value={value} decimals={value % 1 ? 1 : 0} />
          ) : (
            value
          )}
        </div>
        {(sub || trend != null) && (
          <div className="mt-auto pt-2 flex items-center gap-2">
            {trend != null && (
              <span className={cn('text-[11px] font-mono font-medium', trendColor)}>
                {trend > 0 ? '+' : ''}{trend}%
              </span>
            )}
            {sub && <span className="text-[11px] text-text-muted">{sub}</span>}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
