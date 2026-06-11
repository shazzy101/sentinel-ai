import { useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '@/context/AuthProvider'
import { useNavigate } from 'react-router-dom'

export default function TrialBanner() {
  const { isTrialing, trialDaysLeft } = useAuth()
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(false)

  if (!isTrialing || dismissed) return null

  const urgent = trialDaysLeft <= 2
  const tone = urgent ? 'bg-amber/10 border-amber/25' : 'bg-green/10 border-green/20'
  const dot = urgent ? 'bg-amber' : 'bg-green'

  return (
    <div className={`relative z-50 flex items-center justify-between gap-4 border-b px-5 py-2.5 ${tone}`}>
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot} ${urgent ? 'animate-pulse' : ''}`} />
        <span>
          <strong className="text-text-primary font-semibold">{trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} left</strong>
          {urgent
            ? <> — keep your full watchlist, AI signals &amp; copy trading before access locks.</>
            : <> on your free trial — unlock all features with Pro.</>}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/upgrade')}
          className={`text-[12px] font-semibold rounded-lg px-3 py-1 transition-colors ${urgent ? 'bg-amber text-bg-base hover:bg-amber/90' : 'text-green border border-green/30 hover:bg-green/10'}`}
        >
          {urgent ? 'Keep Pro — $19/mo →' : 'Upgrade $19/mo →'}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-text-muted hover:text-text-secondary transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
