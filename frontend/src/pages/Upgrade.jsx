import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Check, Zap } from 'lucide-react'
import { useAuth } from '@/context/AuthProvider'
import { supabase } from '@/lib/supabase'

const FREE_FEATURES = [
  'Top 10 whale watchlist',
  '1 AI signal per day',
  'ETH Markets page',
  'News Intelligence',
]

const PRO_FEATURES = [
  'All 2,796 ranked whale wallets',
  'Unlimited Claude AI signals',
  'One-click copy trading + best-rate swaps',
  'Signal accuracy track record',
  'Instant alerts on signal flips',
  'Priority support',
]

export default function UpgradePage() {
  const { user, isPro, isTrialing, trialDaysLeft } = useAuth()
  const navigate = useNavigate()
  const [billing, setBilling] = useState('monthly') // 'monthly' | 'annual'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { document.title = 'Upgrade to Pro — Hadaleum' }, [])

  async function handleUpgrade() {
    if (!user) { navigate('/signup'); return }
    if (!supabase) {
      setError('Stripe is not configured yet. Set up Supabase Edge Functions.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-checkout-session', {
        body: { billing },
      })
      if (fnError) {
        let msg = fnError.message
        if (fnError.context?.json) {
          try {
            const body = await fnError.context.json()
            if (body?.error) msg = body.error
          } catch { /* ignore */ }
        }
        throw new Error(msg)
      }
      if (data?.error) throw new Error(data.error)
      if (data?.url) window.location.href = data.url
      else throw new Error('No checkout URL returned')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (isPro && !isTrialing) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green/15 border border-green/30">
            <Check className="h-7 w-7 text-green" strokeWidth={2.25} />
          </div>
          <h2 className="font-display text-2xl font-bold text-text-primary mb-2">You're on Pro</h2>
          <p className="text-text-muted text-sm mb-6">You have full access to all Hadaleum features.</p>
          <button
            type="button"
            onClick={() => navigate('/watchlist')}
            className="text-green text-sm hover:underline"
          >
            Go to Watchlist →
          </button>
        </div>
      </div>
    )
  }

  const monthlyPrice = 19
  const annualPrice = 190
  const annualMonthly = (annualPrice / 12).toFixed(2)

  return (
    <div className="min-h-screen bg-bg-base py-16 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <div className="text-center mb-12">
          {isTrialing && (
            <div className="inline-flex items-center gap-2 rounded-full border border-amber/20 bg-amber/10 px-3 py-1 mb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber">
                {trialDaysLeft} days left on trial
              </span>
            </div>
          )}
          <h1 className="font-display text-4xl md:text-5xl font-bold text-text-primary mb-3 leading-[1.05]">
            Trade like you have<br />a Bloomberg Terminal.
          </h1>
          <p className="text-text-secondary text-lg max-w-xl mx-auto">
            Everything Nansen charges <span className="text-text-muted line-through">$150/mo</span> for — whale tracking, AI signals, copy trading — for <span className="text-green font-semibold">$19</span>.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <button
            type="button"
            onClick={() => setBilling('monthly')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${billing === 'monthly' ? 'bg-green text-text-inverse' : 'text-text-muted hover:text-text-secondary'}`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBilling('annual')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${billing === 'annual' ? 'bg-green text-text-inverse' : 'text-text-muted hover:text-text-secondary'}`}
          >
            Annual
            <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${billing === 'annual' ? 'bg-text-inverse/20 text-text-inverse' : 'bg-green/10 text-green'}`}>
              2 months free
            </span>
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* Free card */}
          <div className="rounded-2xl border border-border-default bg-bg-surface p-6">
            <div className="mb-4">
              <h3 className="font-display text-xl font-bold text-text-primary">Free</h3>
              <div className="mt-2">
                <span className="text-3xl font-bold text-text-primary">$0</span>
                <span className="text-text-muted text-sm">/forever</span>
              </div>
            </div>
            <ul className="space-y-3 mb-6">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-text-secondary">
                  <Check className="h-4 w-4 text-text-muted flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => navigate('/watchlist')}
              className="w-full rounded-xl border border-border-default px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-elevated transition-colors"
            >
              Continue Free
            </button>
          </div>

          {/* Pro card */}
          <div className="rounded-2xl border-2 border-green/40 bg-bg-surface p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-green text-text-inverse text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-xl">
              Most Popular
            </div>
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-4 w-4 text-green" />
                <h3 className="font-display text-xl font-bold text-text-primary">Pro</h3>
              </div>
              <div className="mt-2">
                <span className="text-3xl font-bold text-text-primary">
                  ${billing === 'monthly' ? monthlyPrice : annualMonthly}
                </span>
                <span className="text-text-muted text-sm">/month</span>
                {billing === 'annual' && (
                  <span className="ml-2 text-[11px] text-green">billed ${annualPrice}/year</span>
                )}
              </div>
              <div className="mt-1.5 text-[11px] text-text-muted">
                <span className="text-green font-semibold">87% cheaper</span> than Nansen · less than one bad swap's gas
              </div>
            </div>
            <ul className="space-y-3 mb-6">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-text-secondary">
                  <Check className="h-4 w-4 text-green flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            {error && (
              <p className="text-sm text-red mb-3">{error}</p>
            )}

            <button
              type="button"
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full rounded-xl bg-green px-4 py-3 text-sm font-semibold text-text-inverse shadow-glow hover:bg-green-bright transition-colors disabled:opacity-50"
            >
              {loading ? 'Redirecting…' : isTrialing ? `Upgrade Now — $${billing === 'monthly' ? monthlyPrice : annualPrice}` : 'Start Free Trial →'}
            </button>
            {!isTrialing && (
              <p className="text-center text-[11px] text-text-muted mt-2">
                3-day free trial • cancel anytime
              </p>
            )}
          </div>
        </div>

        {/* Risk reversal row */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-8 text-[12px] text-text-muted">
          {['3-day free trial', 'No credit card to start', 'Cancel anytime', 'Secured by Stripe'].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-green" /> {t}
            </span>
          ))}
        </div>

        {/* Objection-handling FAQ */}
        <div className="max-w-2xl mx-auto mt-12 space-y-3">
          {[
            ['What happens when my trial ends?', 'Nothing automatic — we never charge a card you didn’t enter. You drop to the Free plan unless you choose to upgrade.'],
            ['Is my money safe? Is this custodial?', 'Always non-custodial. Copy trades execute from your own MetaMask; Hadaleum never holds your funds or your private keys.'],
            ['Can I cancel anytime?', 'Yes — one click in Settings. You keep Pro until the end of the period you paid for.'],
            ['Why is it so much cheaper than Nansen?', 'We focus purely on Ethereum and the signals that matter, instead of charging enterprise prices for multi-chain bloat.'],
          ].map(([q, a]) => (
            <details key={q} className="group rounded-xl border border-border-default bg-bg-surface px-4 py-3">
              <summary className="flex cursor-pointer items-center justify-between text-[14px] font-medium text-text-primary list-none">
                {q}
                <span className="text-text-muted transition-transform group-open:rotate-45 text-lg leading-none">+</span>
              </summary>
              <p className="mt-2 text-[13px] text-text-secondary leading-relaxed">{a}</p>
            </details>
          ))}
        </div>

        <p className="text-center text-[12px] text-text-muted mt-10">
          Payments processed securely by Stripe. Not financial advice.
        </p>
      </motion.div>
    </div>
  )
}
