import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthProvider'
import { supabase } from '@/lib/supabase'

/**
 * Wraps protected routes. If Supabase is not configured (null client),
 * users are passed through — auth is optional before Supabase setup.
 * Once configured, unauthenticated users are redirected to /login.
 *
 * Uses useNavigate + useEffect instead of <Navigate> to avoid racing
 * with AnimatePresence mode="wait" exit animations (which caused blank screens).
 */
export default function AuthGuard({ children }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (supabase && !loading && !session) {
      navigate(`/login?next=${encodeURIComponent(location.pathname)}`, { replace: true })
    }
  }, [loading, session]) // eslint-disable-line react-hooks/exhaustive-deps

  // Supabase not configured → pass through without auth
  if (!supabase) return children

  // Show spinner while auth check is in progress OR while redirect effect fires
  if (loading || !session) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="flex items-center gap-3 text-text-muted text-sm">
          <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
          Loading…
        </div>
      </div>
    )
  }

  return children
}
