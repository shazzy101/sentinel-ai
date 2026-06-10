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
    // #region agent log
    fetch('http://127.0.0.1:7399/ingest/432bc0e8-623d-4115-8a69-0cd7624710ad',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'40c5c6'},body:JSON.stringify({sessionId:'40c5c6',location:'AuthGuard.jsx:effect',message:'auth state',data:{loading,hasSession:!!session,path:location.pathname},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    if (supabase && !loading && !session) {
      // #region agent log
      fetch('http://127.0.0.1:7399/ingest/432bc0e8-623d-4115-8a69-0cd7624710ad',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'40c5c6'},body:JSON.stringify({sessionId:'40c5c6',location:'AuthGuard.jsx:navigate',message:'redirecting to login',data:{from:location.pathname},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
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
