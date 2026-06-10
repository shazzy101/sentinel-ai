import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { supabase } from '@/lib/supabase'
import { HexLogo } from '@/components/ui/SentinelLogo'

export default function SignupPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => { document.title = 'Create Account — Hadaleum' }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (!supabase) throw new Error('Auth not configured')
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/watchlist`,
        },
      })
      if (error) throw error
      // Create profile with 7-day trial
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: data.user.email,
          plan: 'free',
          trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
      }
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    if (!supabase) return
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/watchlist` },
    })
  }

  if (done) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm text-center"
        >
          <div className="flex justify-center mb-4"><HexLogo size={36} /></div>
          <h2 className="font-display text-2xl font-bold text-text-primary mb-3">Check your email</h2>
          <p className="text-text-muted text-sm leading-relaxed mb-6">
            We sent a confirmation link to <strong className="text-text-secondary">{email}</strong>.
            Click it to activate your 7-day free trial.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-green text-sm hover:underline"
          >
            Back to sign in
          </button>
        </motion.div>
      </div>
    )
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
          <div className="inline-flex items-center gap-2 rounded-full border border-green/20 bg-green/10 px-3 py-1 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-green">7-day free trial</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-text-primary">Create your account</h1>
          <p className="text-text-muted text-sm mt-1">Full Pro access. No credit card required.</p>
        </div>

        <div className="glass-surface rounded-2xl p-6 shadow-card">
          {!supabase && (
            <div className="mb-4 rounded-xl bg-amber/10 border border-amber/20 px-4 py-3 text-sm text-amber">
              Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogle}
            disabled={!supabase}
            className="w-full flex items-center justify-center gap-3 rounded-xl border border-border-default bg-white/[0.03] px-4 py-3 text-sm text-text-secondary hover:bg-white/[0.06] transition-colors mb-4 disabled:opacity-40"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-border-subtle" />
            <span className="text-[11px] text-text-muted uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-border-subtle" />
          </div>

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
            <div>
              <label className="block text-[12px] text-text-muted mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-xl border border-border-default bg-bg-elevated px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-green/50 focus:outline-none focus:ring-1 focus:ring-green/30 transition-colors"
                placeholder="Min 8 characters"
              />
            </div>

            {error && (
              <p className="text-sm text-red bg-red/10 border border-red/20 rounded-xl px-4 py-2.5">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !supabase}
              className="w-full rounded-xl bg-green px-4 py-3 text-sm font-semibold text-text-inverse shadow-glow hover:bg-green-bright transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating account…' : 'Start Free Trial'}
            </button>

            <p className="text-[11px] text-text-muted text-center leading-relaxed">
              By signing up you agree to our{' '}
              <Link to="/terms" className="text-green hover:underline">Terms</Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-green hover:underline">Privacy Policy</Link>.
            </p>
          </form>
        </div>

        <p className="text-center text-[13px] text-text-muted mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-green hover:underline font-medium">Sign in</Link>
        </p>
      </motion.div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}
