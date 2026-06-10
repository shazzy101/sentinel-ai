import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { supabase } from '@/lib/supabase'
import { HexLogo } from '@/components/ui/SentinelLogo'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => { document.title = 'Reset Password — Hadaleum' }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (!supabase) throw new Error('Auth not configured')
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      })
      if (error) throw error
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4"><HexLogo size={36} /></div>
          <h1 className="font-display text-2xl font-bold text-text-primary">Reset your password</h1>
          <p className="text-text-muted text-sm mt-1">We'll send you a reset link</p>
        </div>

        <div className="glass-surface rounded-2xl p-6 shadow-card">
          {sent ? (
            <div className="text-center py-2">
              <div className="text-3xl mb-3">✉️</div>
              <p className="text-sm text-text-secondary leading-relaxed">
                Check your inbox at <strong>{email}</strong>. Follow the link to reset your password.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[12px] text-text-muted mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-border-default bg-bg-elevated px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-green/50 focus:outline-none focus:ring-1 focus:ring-green/30 transition-colors"
                  placeholder="you@example.com"
                />
              </div>

              {error && (
                <p className="text-sm text-red bg-red/10 border border-red/20 rounded-xl px-4 py-2.5">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-green px-4 py-3 text-sm font-semibold text-text-inverse shadow-glow hover:bg-green-bright transition-colors disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[13px] text-text-muted mt-5">
          <Link to="/login" className="text-green hover:underline font-medium">← Back to sign in</Link>
        </p>
      </motion.div>
    </div>
  )
}
