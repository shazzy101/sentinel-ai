import { Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthProvider'
import { supabase } from '@/lib/supabase'

/**
 * Wraps content that requires a Pro subscription.
 * If Supabase is not configured, always shows the content (dev mode).
 * If the user is on a free plan (not trialing), shows a locked overlay.
 */
export default function PaywallGate({ children, feature = 'This feature', blur = false }) {
  const auth = useAuth()
  const navigate = useNavigate()

  // Supabase not configured or user is pro/trialing → show content
  if (!supabase || !auth?.user || auth?.isPro) return children

  if (blur) {
    return (
      <div className="relative">
        <div className="select-none pointer-events-none opacity-40 blur-sm">
          {children}
        </div>
        <ProOverlay feature={feature} navigate={navigate} auth={auth} />
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border-default bg-bg-surface p-8 text-center">
      <Lock className="h-8 w-8 text-text-muted mx-auto mb-4" />
      <h3 className="font-display text-lg font-bold text-text-primary mb-2">{feature}</h3>
      <p className="text-sm text-text-muted mb-6 max-w-xs mx-auto">
        Upgrade to Hadaleum Pro to access this feature. Start your 7-day free trial — no credit card required.
      </p>
      <button
        type="button"
        onClick={() => navigate('/upgrade')}
        className="rounded-xl bg-green px-6 py-2.5 text-sm font-semibold text-text-inverse shadow-glow hover:bg-green-bright transition-colors"
      >
        Start Free Trial →
      </button>
    </div>
  )
}

function ProOverlay({ feature, navigate, auth }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-bg-base/80 backdrop-blur-sm">
      <Lock className="h-6 w-6 text-text-muted mb-3" />
      <p className="text-sm text-text-secondary font-medium mb-4">{feature} requires Pro</p>
      <button
        type="button"
        onClick={() => navigate('/upgrade')}
        className="rounded-xl bg-green px-5 py-2 text-sm font-semibold text-text-inverse shadow-glow hover:bg-green-bright transition-colors"
      >
        {auth?.isTrialing ? 'Upgrade →' : 'Start Free Trial →'}
      </button>
    </div>
  )
}
