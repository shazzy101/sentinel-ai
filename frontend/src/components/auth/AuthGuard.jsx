import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthProvider'
import { supabase } from '@/lib/supabase'

/**
 * Wraps protected routes. If Supabase is not configured (null client),
 * users are passed through — auth is optional before Supabase setup.
 * Once configured, unauthenticated users are redirected to /login.
 */
export default function AuthGuard({ children }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  // Supabase not configured → pass through without auth
  if (!supabase) return children

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="flex items-center gap-3 text-text-muted text-sm">
          <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
          Loading…
        </div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  }

  return children
}
