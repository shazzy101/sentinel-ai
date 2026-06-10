import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { supabase } from '@/lib/supabase'
import { HexLogo } from '@/components/ui/SentinelLogo'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => { document.title = 'Set New Password — Hadaleum' }, [])

  useEffect(() => {
    if (!supabase) {
      setError('Auth not configured')
      return
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
      else setError('Reset link expired. Request a new one from the sign-in page.')
    })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      if (!supabase) throw new Error('Auth not configured')
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      navigate('/watchlist', { replace: true })
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
          <h1 className="font-display text-2xl font-bold text-text-primary">Set a new password</h1>
          <p className="text-text-muted text-sm mt-1">Choose a strong password for your account</p>
        </div>

        <div className="glass-surface rounded-2xl p-6 shadow-card">
          {!ready && !error ? (
            <p className="text-sm text-text-muted text-center py-4">Verifying reset link…</p>
          ) : error && !ready ? (
            <div className="text-center">
              <p className="text-sm text-red bg-red/10 border border-red/20 rounded-xl px-4 py-3 mb-4">{error}</p>
              <Link to="/forgot-password" className="text-green text-sm font-medium hover:underline">
                Request new link →
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[12px] text-text-muted mb-1.5">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full rounded-xl border border-border-default bg-bg-elevated px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-green/50 focus:outline-none focus:ring-1 focus:ring-green/30 transition-colors"
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label className="block text-[12px] text-text-muted mb-1.5">Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  className="w-full rounded-xl border border-border-default bg-bg-elevated px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-green/50 focus:outline-none focus:ring-1 focus:ring-green/30 transition-colors"
                />
              </div>

              {error && ready && (
                <p className="text-sm text-red bg-red/10 border border-red/20 rounded-xl px-4 py-2.5">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-green px-4 py-3 text-sm font-semibold text-text-inverse shadow-glow hover:bg-green-bright transition-colors disabled:opacity-50"
              >
                {loading ? 'Updating…' : 'Update password'}
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
