import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [profile, setProfile] = useState(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const loadProfile = useCallback(async (userId) => {
    if (!supabase) return
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    // Don't set state if the provider unmounted while the query was in flight.
    if (data && mountedRef.current) setProfile(data)
  }, [])

  useEffect(() => {
    if (!supabase) {
      setSession(null)
      return
    }

    let cancelled = false

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (cancelled) return
        setSession(session)
        if (session) loadProfile(session.user.id)
      })
      .catch((err) => {
        if (cancelled) return
        // eslint-disable-next-line no-console
        console.error('Auth getSession failed:', err)
        setSession(null)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      setSession(session)
      if (session) loadProfile(session.user.id)
      else setProfile(null)
    })

    return () => { cancelled = true; subscription.unsubscribe() }
  }, [loadProfile])

  const isPro = useMemo(() =>
    profile?.plan === 'pro' ||
    (profile?.trial_ends_at && new Date(profile.trial_ends_at) > new Date()),
  [profile])

  const trialDaysLeft = profile?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(profile.trial_ends_at) - new Date()) / 86400000))
    : 0

  const isTrialing = trialDaysLeft > 0 && profile?.plan !== 'pro'

  async function signOut() {
    if (!supabase) return
    // Fire the signed-out event only after Supabase actually clears the session.
    await supabase.auth.signOut()
    window.dispatchEvent(new Event('hadaleum-auth-signed-out'))
  }

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      profile,
      isPro,
      isTrialing,
      trialDaysLeft,
      loading: session === undefined,
      signOut,
      refreshProfile: () => session && loadProfile(session.user.id),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
