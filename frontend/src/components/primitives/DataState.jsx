import { AlertCircle, RefreshCw, InboxIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ─── Skeleton pulse line ─────────────────────────────── */
export function SkeletonLine({ className }) {
  return <div className={cn('animate-pulse rounded-md bg-white/[0.06]', className)} />
}

/* ─── Full-page or section skeleton ──────────────────── */
export function SkeletonBlock({ rows = 5, className }) {
  return (
    <div className={cn('space-y-3 p-4', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <SkeletonLine className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonLine className="h-3 w-3/4" />
            <SkeletonLine className="h-2 w-1/2" />
          </div>
          <SkeletonLine className="h-6 w-12 rounded-lg flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}

/* ─── Table row skeletons ────────────────────────────── */
export function TableSkeleton({ rows = 8, cols = 5 }) {
  return (
    <div className="space-y-px">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border-subtle last:border-0">
          {Array.from({ length: cols }).map((_, j) => (
            <SkeletonLine
              key={j}
              className={cn('h-3 animate-pulse', j === 0 ? 'w-6' : j === 1 ? 'flex-1' : 'w-16')}
              style={{ animationDelay: `${(i * cols + j) * 40}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/* ─── Card skeleton ──────────────────────────────────── */
export function CardSkeleton({ className }) {
  return (
    <div className={cn('rounded-2xl border border-border-default bg-bg-surface p-5 space-y-3', className)}>
      <SkeletonLine className="h-3 w-1/3" />
      <SkeletonLine className="h-8 w-2/3" />
      <SkeletonLine className="h-2 w-full" />
      <SkeletonLine className="h-2 w-4/5" />
    </div>
  )
}

/* ─── Error state ────────────────────────────────────── */
export function ErrorState({ message = "Couldn't load data", onRetry, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-4 text-center', className)}>
      <AlertCircle className="h-8 w-8 text-red/60 mb-4" />
      <p className="text-sm text-text-secondary font-medium mb-1">{message}</p>
      <p className="text-xs text-text-muted mb-5">Check your connection and try again.</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-2 rounded-xl border border-border-default px-4 py-2 text-sm text-text-secondary hover:bg-bg-elevated transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </button>
      )}
    </div>
  )
}

/* ─── Empty state ────────────────────────────────────── */
export function EmptyState({ title = 'Nothing here yet', body, action, actionLabel, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-4 text-center', className)}>
      <InboxIcon className="h-8 w-8 text-text-muted mb-4" />
      <p className="text-sm font-medium text-text-secondary mb-1">{title}</p>
      {body && <p className="text-xs text-text-muted max-w-xs mb-5">{body}</p>}
      {action && (
        <button
          type="button"
          onClick={action}
          className="rounded-xl bg-green/10 border border-green/20 px-4 py-2 text-sm text-green hover:bg-green/15 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

/* ─── Inline retry cache helper ──────────────────────── */

const CACHE = new Map()

export function cachedFetch(key, ttlMs, fetchFn) {
  const cached = CACHE.get(key)
  if (cached && Date.now() - cached.ts < ttlMs) {
    return Promise.resolve(cached.data)
  }
  return fetchFn().then((data) => {
    CACHE.set(key, { data, ts: Date.now() })
    return data
  })
}

/** localStorage-backed cache with TTL */
export function lsCachedFetch(key, ttlMs, fetchFn) {
  try {
    const raw = localStorage.getItem(`hadaleum_cache_${key}`)
    if (raw) {
      const { data, ts } = JSON.parse(raw)
      if (Date.now() - ts < ttlMs) return Promise.resolve(data)
    }
  } catch {}
  return fetchFn().then((data) => {
    try {
      localStorage.setItem(`hadaleum_cache_${key}`, JSON.stringify({ data, ts: Date.now() }))
    } catch {}
    return data
  })
}
