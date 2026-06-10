import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { supabase } from '@/lib/supabase'
import { SignalPill } from '@/components/ui/Badge'

function StatCard({ label, value, sub, color }) {
  return (
    <div className="rounded-2xl border border-border-default bg-bg-surface p-5 flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-[1.4px] text-text-muted">{label}</span>
      <span className={`font-display text-3xl font-bold ${color || 'text-text-primary'}`}>{value}</span>
      {sub && <span className="text-[12px] text-text-muted">{sub}</span>}
    </div>
  )
}

export default function SignalPerformance() {
  const [stats, setStats] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = 'Signal Performance — Hadaleum'
  }, [])

  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    async function load() {
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('signals')
        .select('signal_type, outcome_24h, outcome_48h, outcome_7d, created_at, eth_price_at_signal, eth_price_7d_after, reasoning')
        .gte('created_at', since)
        .order('created_at', { ascending: false })

      if (error || !data) { setLoading(false); return }

      const resolved = data.filter((s) => s.outcome_7d && s.outcome_7d !== 'PENDING')

      if (resolved.length === 0) { setLoading(false); return }

      const bull = resolved.filter((s) => s.signal_type === 'BULLISH')
      const bear = resolved.filter((s) => s.signal_type === 'BEARISH')

      const accuracy = (arr) =>
        arr.length ? Math.round((arr.filter((s) => s.outcome_7d === 'CORRECT').length / arr.length) * 100) : null

      const totalCorrect = resolved.filter((s) => s.outcome_7d === 'CORRECT')
      const overallPct = Math.round((totalCorrect.length / resolved.length) * 100)

      const correctWithPrices = totalCorrect.filter(
        (s) => s.eth_price_at_signal && s.eth_price_7d_after
      )
      const avgChange = correctWithPrices.length
        ? correctWithPrices.reduce((acc, s) => {
            return acc + Math.abs((s.eth_price_7d_after - s.eth_price_at_signal) / s.eth_price_at_signal) * 100
          }, 0) / correctWithPrices.length
        : null

      setStats({
        overallPct,
        totalResolved: resolved.length,
        bull: { count: bull.length, pct: accuracy(bull) },
        bear: { count: bear.length, pct: accuracy(bear) },
        avgChange: avgChange !== null ? avgChange.toFixed(1) : null,
      })

      const recent = resolved
        .filter((s) => s.eth_price_at_signal && s.eth_price_7d_after)
        .slice(0, 20)
      setRows(recent)
      setLoading(false)
    }

    load()
  }, [])

  const isEmpty = !loading && !stats

  return (
    <div className="min-h-screen bg-bg-base py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mb-10">
            <div className="text-[11px] uppercase tracking-[2px] text-green mb-2">Live Data</div>
            <h1 className="font-display text-3xl font-bold text-text-primary mb-2">Signal Performance</h1>
            <p className="text-[14px] text-text-muted">7-day resolved outcomes · Last 90 days · CORRECT = price moved ≥2% in predicted direction</p>
          </div>

          {loading && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-border-default bg-bg-surface p-5 h-24 animate-pulse" />
              ))}
            </div>
          )}

          {isEmpty && (
            <div className="rounded-2xl border border-border-default bg-bg-surface p-10 text-center">
              <p className="text-text-secondary text-[15px]">Tracking signals — accuracy data will appear once signals have resolved.</p>
              <p className="text-text-muted text-[12px] mt-2">Signals resolve after 7 days.</p>
            </div>
          )}

          {stats && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
                <StatCard
                  label="Overall Accuracy"
                  value={`${stats.overallPct}%`}
                  sub={`${stats.totalResolved} resolved signals`}
                  color={stats.overallPct >= 60 ? 'text-green' : 'text-red'}
                />
                <StatCard
                  label="BULLISH Accuracy"
                  value={stats.bull.pct !== null ? `${stats.bull.pct}%` : '—'}
                  sub={`${stats.bull.count} signals`}
                  color="text-green"
                />
                <StatCard
                  label="BEARISH Accuracy"
                  value={stats.bear.pct !== null ? `${stats.bear.pct}%` : '—'}
                  sub={`${stats.bear.count} signals`}
                  color="text-red"
                />
                <StatCard
                  label="Total Tracked"
                  value={stats.totalResolved}
                  sub="last 90 days"
                />
                {stats.avgChange && (
                  <StatCard
                    label="Avg ETH Move (correct)"
                    value={`${stats.avgChange}%`}
                    sub="when signal was CORRECT"
                    color="text-green"
                  />
                )}
              </div>

              {rows.length > 0 && (
                <div>
                  <h2 className="font-display text-[17px] font-bold text-text-primary mb-4">Recent Resolved Signals</h2>
                  <div className="rounded-xl border border-border-default bg-bg-surface overflow-hidden">
                    <div className="grid grid-cols-[1fr_88px_80px_90px_90px_72px] gap-x-3 px-5 py-3 bg-bg-overlay border-b border-border-default text-[10px] uppercase tracking-[1.2px] text-text-muted">
                      <div>Date</div>
                      <div>Signal</div>
                      <div>Outcome</div>
                      <div className="text-right">ETH at signal</div>
                      <div className="text-right">ETH 7d after</div>
                      <div className="text-right">Change</div>
                    </div>
                    {rows.map((s, i) => {
                      const pctChange = ((s.eth_price_7d_after - s.eth_price_at_signal) / s.eth_price_at_signal) * 100
                      const isCorrect = s.outcome_7d === 'CORRECT'
                      return (
                        <div
                          key={i}
                          className={`grid grid-cols-[1fr_88px_80px_90px_90px_72px] gap-x-3 px-5 py-3.5 border-b border-border-subtle last:border-0 ${i % 2 === 0 ? 'bg-bg-surface' : 'bg-bg-card'}`}
                        >
                          <div className="text-[12px] text-text-muted font-mono self-center">
                            {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                          </div>
                          <div className="self-center">
                            <SignalPill signal={s.signal_type} />
                          </div>
                          <div className={`text-[12px] font-bold self-center ${isCorrect ? 'text-green' : 'text-red'}`}>
                            {isCorrect ? 'CORRECT' : 'WRONG'}
                          </div>
                          <div className="text-[12px] font-mono text-text-secondary self-center text-right">
                            ${s.eth_price_at_signal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                          <div className="text-[12px] font-mono text-text-secondary self-center text-right">
                            ${s.eth_price_7d_after.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                          <div className={`text-[12px] font-mono font-bold self-center text-right ${pctChange >= 0 ? 'text-green' : 'text-red'}`}>
                            {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(1)}%
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <p className="text-[11px] text-text-muted mt-6 text-center leading-relaxed">
                Past accuracy does not guarantee future results. Not financial advice.
              </p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}
