import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { SkeletonLine } from '@/components/primitives/DataState'
import { TrendingUp } from 'lucide-react'

function AccuracyBar({ pct, color }) {
  return (
    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden w-20">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export default function SignalAccuracyWidget() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    async function load() {
      // Query last 30 days of resolved signals
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('signals')
        .select('signal_type, outcome_24h, outcome_7d')
        .gte('created_at', since)
        .neq('outcome_7d', 'PENDING')

      if (error || !data || data.length === 0) { setLoading(false); return }

      const bull = data.filter((s) => s.signal_type === 'BULLISH')
      const bear = data.filter((s) => s.signal_type === 'BEARISH')

      const accuracy = (arr) => {
        if (!arr.length) return null
        const correct = arr.filter((s) => s.outcome_7d === 'CORRECT').length
        return Math.round((correct / arr.length) * 100)
      }

      const bullPct = accuracy(bull)
      const bearPct = accuracy(bear)
      const total = [...bull, ...bear]
      const totalPct = total.length
        ? Math.round(total.filter((s) => s.outcome_7d === 'CORRECT').length / total.length * 100)
        : null

      setStats({ bull: { count: bull.length, pct: bullPct }, bear: { count: bear.length, pct: bearPct }, totalPct, total: total.length })
      setLoading(false)
    }

    load()
  }, [])

  if (!supabase) return null
  if (loading) {
    return (
      <div className="rounded-2xl border border-border-default bg-bg-surface p-4 space-y-3">
        <SkeletonLine className="h-3 w-32" />
        <SkeletonLine className="h-8 w-16" />
        <SkeletonLine className="h-2 w-full" />
      </div>
    )
  }
  if (!stats || stats.total === 0) return null

  return (
    <div className="rounded-2xl border border-border-default bg-bg-surface p-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-4 w-4 text-green" />
        <span className="text-[11px] uppercase tracking-[1.5px] text-text-muted font-medium">
          Signal Accuracy · Last 30 Days
        </span>
      </div>

      {stats.totalPct !== null && (
        <div className="mb-4 flex items-end gap-2">
          <span className="font-display text-3xl font-bold text-green">{stats.totalPct}%</span>
          <span className="text-sm text-text-muted mb-1">overall accuracy</span>
        </div>
      )}

      <div className="space-y-3">
        {stats.bull.count > 0 && stats.bull.pct !== null && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green flex-shrink-0" />
              <span className="text-[12px] text-text-secondary">BULLISH</span>
              <span className="text-[10px] text-text-muted">{stats.bull.count} signals</span>
            </div>
            <div className="flex items-center gap-2">
              <AccuracyBar pct={stats.bull.pct} color="bg-green" />
              <span className="text-[12px] font-mono font-bold text-green w-9 text-right">{stats.bull.pct}%</span>
            </div>
          </div>
        )}
        {stats.bear.count > 0 && stats.bear.pct !== null && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red flex-shrink-0" />
              <span className="text-[12px] text-text-secondary">BEARISH</span>
              <span className="text-[10px] text-text-muted">{stats.bear.count} signals</span>
            </div>
            <div className="flex items-center gap-2">
              <AccuracyBar pct={stats.bear.pct} color="bg-red" />
              <span className="text-[12px] font-mono font-bold text-red w-9 text-right">{stats.bear.pct}%</span>
            </div>
          </div>
        )}
      </div>

      <p className="text-[10px] text-text-muted mt-3 leading-relaxed">
        Based on 7-day outcomes. CORRECT = price moved ≥2% in predicted direction.
        Past accuracy does not guarantee future results.
      </p>
    </div>
  )
}
