import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { supabase } from '@/lib/supabase'
import { HexLogo } from '@/components/ui/SentinelLogo'
import { SkeletonLine } from '@/components/primitives/DataState'
import { Share2 } from 'lucide-react'

function outcomeColor(outcome) {
  if (outcome === 'CORRECT') return 'text-green'
  if (outcome === 'INCORRECT') return 'text-red'
  if (outcome === 'PENDING') return 'text-amber'
  return 'text-text-muted'
}

function outcomeLabel(outcome) {
  if (outcome === 'CORRECT') return '✓ Correct'
  if (outcome === 'INCORRECT') return '✗ Incorrect'
  if (outcome === 'NEUTRAL') return '≈ Neutral'
  if (outcome === 'PENDING') return 'Pending…'
  return '—'
}

function signalColor(type) {
  if (type === 'BULLISH') return 'bg-green/10 text-green border-green/20'
  if (type === 'BEARISH') return 'bg-red/10 text-red border-red/20'
  return 'bg-amber/10 text-amber border-amber/20'
}

function AccuracyStats({ signals }) {
  const resolved = signals.filter((s) => s.outcome_7d && s.outcome_7d !== 'PENDING')
  if (!resolved.length) return null
  const correct = resolved.filter((s) => s.outcome_7d === 'CORRECT').length
  const pct = Math.round((correct / resolved.length) * 100)

  const bull = resolved.filter((s) => s.signal_type === 'BULLISH')
  const bear = resolved.filter((s) => s.signal_type === 'BEARISH')
  const bullCorrect = bull.filter((s) => s.outcome_7d === 'CORRECT').length
  const bearCorrect = bear.filter((s) => s.outcome_7d === 'CORRECT').length

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
      {[
        { label: 'Total Accuracy', val: `${pct}%`, sub: `${resolved.length} resolved` },
        { label: 'Signals Issued', val: signals.length, sub: 'all time' },
        { label: 'BULLISH Accuracy', val: bull.length ? `${Math.round(bullCorrect / bull.length * 100)}%` : '—', sub: `${bull.length} signals` },
        { label: 'BEARISH Accuracy', val: bear.length ? `${Math.round(bearCorrect / bear.length * 100)}%` : '—', sub: `${bear.length} signals` },
      ].map(({ label, val, sub }) => (
        <div key={label} className="rounded-2xl border border-border-default bg-bg-surface p-4">
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">{label}</div>
          <div className="font-display text-2xl font-bold text-text-primary">{val}</div>
          <div className="text-[10px] text-text-muted mt-1">{sub}</div>
        </div>
      ))}
    </div>
  )
}

export default function SignalsLeaderboardPage() {
  const [signals, setSignals] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(null)

  useEffect(() => { document.title = 'Signal Accuracy — Hadaleum Public Track Record' }, [])

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase
      .from('signals')
      .select('id, created_at, signal_type, reasoning, eth_price_at_signal, eth_price_7d_after, outcome_7d, whale_trigger_address')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setSignals(data || [])
        setLoading(false)
      })
  }, [])

  function share(signal) {
    const text = `Hadaleum AI Signal: ${signal.signal_type} on ${new Date(signal.created_at).toLocaleDateString()} — 7d outcome: ${signal.outcome_7d}\n\nPublic track record: https://hadaleum.com/signals`
    if (navigator.share) {
      navigator.share({ title: 'Hadaleum Signal', text })
    } else {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(signal.id)
        setTimeout(() => setCopied(null), 1500)
      })
    }
  }

  return (
    <div className="min-h-screen bg-bg-base py-16 px-4">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4"><HexLogo size={36} /></div>
          <h1 className="font-display text-4xl font-bold text-text-primary mb-3">
            Hadaleum Signal Accuracy
          </h1>
          <p className="text-text-muted text-lg mb-4">
            Public track record — every AI signal we've issued and its 7-day outcome.
          </p>
          <p className="text-text-muted text-sm">
            CORRECT = price moved ≥2% in the predicted direction within 7 days.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0,1,2,3,4].map((i) => <SkeletonLine key={i} className="h-16 rounded-2xl" />)}
          </div>
        ) : !supabase ? (
          <div className="text-center py-16 text-text-muted">
            <p className="mb-2">Signal history is not yet available.</p>
            <p className="text-sm">Configure Supabase to enable public signal tracking.</p>
          </div>
        ) : (
          <>
            <AccuracyStats signals={signals} />
            <div className="space-y-3">
              {signals.map((s) => (
                <div key={s.id} className="rounded-2xl border border-border-default bg-bg-surface p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-[11px] font-bold uppercase tracking-wide ${signalColor(s.signal_type)}`}>
                      {s.signal_type}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                      <span className="text-[12px] text-text-muted">{new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      {s.eth_price_at_signal && (
                        <span className="text-[11px] text-text-muted font-mono">ETH ${Number(s.eth_price_at_signal).toLocaleString(undefined, { maximumFractionDigits: 0 })} at signal</span>
                      )}
                      {s.eth_price_7d_after && (
                        <span className="text-[11px] text-text-muted font-mono">→ ${Number(s.eth_price_7d_after).toLocaleString(undefined, { maximumFractionDigits: 0 })} 7d later</span>
                      )}
                    </div>
                    {s.reasoning && (
                      <p className="text-[12px] text-text-secondary line-clamp-2">{s.reasoning.slice(0, 200)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-[12px] font-semibold ${outcomeColor(s.outcome_7d)}`}>
                      {outcomeLabel(s.outcome_7d)}
                    </span>
                    <button
                      type="button"
                      onClick={() => share(s)}
                      title="Share signal"
                      className="text-text-muted hover:text-text-secondary transition-colors"
                    >
                      {copied === s.id ? <span className="text-green text-[10px]">Copied!</span> : <Share2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
              {signals.length === 0 && (
                <div className="text-center py-16 text-text-muted">
                  No signals logged yet. Signals appear here automatically as they are generated.
                </div>
              )}
            </div>
          </>
        )}

        <div className="mt-12 text-center">
          <Link to="/signup" className="inline-flex items-center gap-2 rounded-xl bg-green px-6 py-3 text-sm font-semibold text-text-inverse shadow-glow hover:bg-green-bright transition-colors">
            Start your free trial →
          </Link>
          <p className="text-text-muted text-xs mt-3">Not financial advice. Past accuracy does not guarantee future results.</p>
        </div>
      </motion.div>
    </div>
  )
}
