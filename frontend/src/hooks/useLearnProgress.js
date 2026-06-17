import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthProvider'
import { supabase } from '@/lib/supabase'
import { LEARN_MODULES } from '@/lib/learnModules'

const LS_KEY = 'hadaleum_learn_progress'

function readLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { completed: [], unlocked: [] }
    const parsed = JSON.parse(raw)
    return {
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      unlocked: Array.isArray(parsed.unlocked) ? parsed.unlocked : [],
    }
  } catch {
    return { completed: [], unlocked: [] }
  }
}

function writeLocalStorage(completed, unlocked) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ completed, unlocked }))
  } catch {
    /* quota */
  }
}

/**
 * useLearnProgress — tracks which learn modules the user has completed.
 *
 * When logged in:  reads/writes profiles.modules_completed + profiles.unlocked_features
 * When logged out: falls back to localStorage (key: hadaleum_learn_progress)
 *
 * Returns:
 *   completed    {number[]}  — module ids the user has finished
 *   unlocked     {string[]}  — feature keys that have been unlocked
 *   complete(id) {function}  — mark a module as completed
 *   isCompleted  {function}  — isCompleted(moduleId) => boolean
 *   isUnlocked   {function}  — isUnlocked(featureKey) => boolean
 *   loading      {boolean}
 */
export function useLearnProgress() {
  const auth = useAuth()
  const user = auth?.user ?? null
  const authLoading = auth?.loading ?? false

  const [completed, setCompleted] = useState([])
  const [unlocked, setUnlocked] = useState([])
  const [loading, setLoading] = useState(true)

  // Load initial state
  useEffect(() => {
    if (authLoading) return // wait for auth to resolve

    if (!user) {
      // Logged-out path: read from localStorage
      const local = readLocalStorage()
      setCompleted(local.completed)
      setUnlocked(local.unlocked)
      setLoading(false)
      return
    }

    // Logged-in path: read from Supabase profile
    if (!supabase) {
      const local = readLocalStorage()
      setCompleted(local.completed)
      setUnlocked(local.unlocked)
      setLoading(false)
      return
    }

    let cancelled = false

    supabase
      .from('profiles')
      .select('modules_completed, unlocked_features')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (cancelled) return
        const c = Array.isArray(data?.modules_completed) ? data.modules_completed : []
        const u = Array.isArray(data?.unlocked_features) ? data.unlocked_features : []
        setCompleted(c)
        setUnlocked(u)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        // Fall back to localStorage on error
        const local = readLocalStorage()
        setCompleted(local.completed)
        setUnlocked(local.unlocked)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [user, authLoading])

  const complete = useCallback(
    async (moduleId) => {
      const mod = LEARN_MODULES.find((m) => m.id === moduleId)
      if (!mod) return

      // Optimistic update
      setCompleted((prev) => {
        if (prev.includes(moduleId)) return prev
        return [...prev, moduleId]
      })
      setUnlocked((prev) => {
        if (prev.includes(mod.unlocksFeature)) return prev
        return [...prev, mod.unlocksFeature]
      })

      if (!user || !supabase) {
        // Logged-out: persist to localStorage using the updated state
        // Read current to avoid stale closure
        const local = readLocalStorage()
        const newCompleted = local.completed.includes(moduleId)
          ? local.completed
          : [...local.completed, moduleId]
        const newUnlocked = local.unlocked.includes(mod.unlocksFeature)
          ? local.unlocked
          : [...local.unlocked, mod.unlocksFeature]
        writeLocalStorage(newCompleted, newUnlocked)
        return
      }

      // Logged-in: persist to Supabase
      try {
        // Use the current state values post-update (via functional reads)
        let latestCompleted
        let latestUnlocked

        setCompleted((prev) => {
          latestCompleted = prev
          return prev
        })
        setUnlocked((prev) => {
          latestUnlocked = prev
          return prev
        })

        // Re-derive from state synchronously using the values we set above
        // We compute the new arrays directly instead of reading stale state
        const local = readLocalStorage()
        const mergedCompleted = Array.from(
          new Set([...local.completed, moduleId])
        )
        const mergedUnlocked = Array.from(
          new Set([...local.unlocked, mod.unlocksFeature])
        )

        await supabase
          .from('profiles')
          .update({
            modules_completed: mergedCompleted,
            unlocked_features: mergedUnlocked,
          })
          .eq('id', user.id)
      } catch {
        /* non-fatal: state already updated optimistically */
      }
    },
    [user],
  )

  const isCompleted = useCallback(
    (moduleId) => completed.includes(moduleId),
    [completed],
  )

  const isUnlocked = useCallback(
    (featureKey) => unlocked.includes(featureKey),
    [unlocked],
  )

  return { completed, unlocked, complete, isCompleted, isUnlocked, loading }
}
