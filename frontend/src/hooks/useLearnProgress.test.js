import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLearnProgress } from './useLearnProgress'

// ── Mock @/lib/supabase as null (logged-out / no client) ──────────────────────
vi.mock('@/lib/supabase', () => ({ supabase: null }))

// ── Mock @/context/AuthProvider (no user) ────────────────────────────────────
vi.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({ user: null, loading: false }),
}))

// ── Mock @/lib/learnModules (use real data) ───────────────────────────────────
// (no mock needed — we import the real file)

// ── localStorage mock ─────────────────────────────────────────────────────────
const LS_KEY = 'hadaleum_learn_progress'

function makeLocalStorageMock() {
  let store = {}
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store[key] = value }),
    removeItem: vi.fn((key) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    _store: () => store,
  }
}

let localStorageMock

beforeEach(() => {
  localStorageMock = makeLocalStorageMock()
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
  })
})

describe('useLearnProgress (logged-out / no supabase)', () => {
  it('starts with empty completed and unlocked arrays', () => {
    const { result } = renderHook(() => useLearnProgress())
    expect(result.current.completed).toEqual([])
    expect(result.current.unlocked).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('complete(1) marks module 1 as completed', async () => {
    const { result } = renderHook(() => useLearnProgress())
    await act(async () => {
      result.current.complete(1)
    })
    expect(result.current.completed).toContain(1)
  })

  it('complete(1) unlocks the feature for module 1 (whale_heatmap)', async () => {
    const { result } = renderHook(() => useLearnProgress())
    await act(async () => {
      result.current.complete(1)
    })
    expect(result.current.unlocked).toContain('whale_heatmap')
  })

  it('persists progress to localStorage after complete(1)', async () => {
    const { result } = renderHook(() => useLearnProgress())
    await act(async () => {
      result.current.complete(1)
    })
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      LS_KEY,
      expect.stringContaining('"completed"'),
    )
    const written = JSON.parse(localStorageMock.setItem.mock.calls.at(-1)[1])
    expect(written.completed).toContain(1)
    expect(written.unlocked).toContain('whale_heatmap')
  })

  it('isCompleted(1) returns true after complete(1)', async () => {
    const { result } = renderHook(() => useLearnProgress())
    await act(async () => {
      result.current.complete(1)
    })
    expect(result.current.isCompleted(1)).toBe(true)
  })

  it('isCompleted(2) returns false when only module 1 completed', async () => {
    const { result } = renderHook(() => useLearnProgress())
    await act(async () => {
      result.current.complete(1)
    })
    expect(result.current.isCompleted(2)).toBe(false)
  })

  it('isUnlocked("whale_heatmap") returns true after complete(1)', async () => {
    const { result } = renderHook(() => useLearnProgress())
    await act(async () => {
      result.current.complete(1)
    })
    expect(result.current.isUnlocked('whale_heatmap')).toBe(true)
  })

  it('isUnlocked("signal_history") returns false when only module 1 completed', async () => {
    const { result } = renderHook(() => useLearnProgress())
    await act(async () => {
      result.current.complete(1)
    })
    expect(result.current.isUnlocked('signal_history')).toBe(false)
  })

  it('calling complete(1) twice does not duplicate entries', async () => {
    const { result } = renderHook(() => useLearnProgress())
    await act(async () => {
      result.current.complete(1)
      result.current.complete(1)
    })
    const count = result.current.completed.filter((id) => id === 1).length
    expect(count).toBe(1)
  })

  it('reads saved progress from localStorage on mount', async () => {
    // Pre-populate localStorage
    localStorageMock.getItem.mockReturnValueOnce(
      JSON.stringify({ completed: [2], unlocked: ['signal_history'] }),
    )
    const { result } = renderHook(() => useLearnProgress())
    expect(result.current.completed).toContain(2)
    expect(result.current.unlocked).toContain('signal_history')
  })

  it('complete() with unknown moduleId is a no-op', async () => {
    const { result } = renderHook(() => useLearnProgress())
    await act(async () => {
      result.current.complete(99)
    })
    expect(result.current.completed).toEqual([])
    expect(result.current.unlocked).toEqual([])
  })
})
