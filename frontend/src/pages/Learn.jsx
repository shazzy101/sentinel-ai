import { useState } from 'react'
import { LEARN_MODULES } from '@/lib/learnModules'
import { useLearnProgress } from '@/hooks/useLearnProgress'
import ModuleCard from '@/components/learn/ModuleCard'
import ModulePlayer from '@/components/learn/ModulePlayer'
import ProgressBar from '@/components/learn/ProgressBar'

/**
 * Learn — gamified module grid. Public route: works logged-out (localStorage progress).
 *
 * Clicking a module card opens ModulePlayer inline. On completion, progress is
 * recorded via useLearnProgress().complete(moduleId) and the grid is shown again.
 */
export default function Learn() {
  const { completed, isCompleted, complete, loading } = useLearnProgress()
  const [activeModuleId, setActiveModuleId] = useState(null)

  const activeModule = LEARN_MODULES.find((m) => m.id === activeModuleId) ?? null
  const completedCount = completed.length
  const totalCount = LEARN_MODULES.length

  function handleStart(moduleId) {
    setActiveModuleId(moduleId)
  }

  function handleComplete(moduleId) {
    complete(moduleId)
    // Brief delay so the player can show its completion screen before we
    // return the user to the grid.
    setTimeout(() => setActiveModuleId(null), 1200)
  }

  function handleBack() {
    setActiveModuleId(null)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-5 py-8 flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <h1 className="text-text-primary text-2xl font-semibold tracking-tight">
          Learn &amp; Unlock
        </h1>
        <p className="text-text-secondary text-sm leading-relaxed max-w-xl">
          Complete modules to unlock dashboard features. Each lesson teaches you
          the on-chain concepts that power Hadaleum&apos;s signals.
        </p>

        {/* Overall progress */}
        {!loading && (
          <div className="flex flex-col gap-1.5 max-w-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
                Progress
              </span>
              <span
                className="text-[11px] font-mono text-signal"
                data-testid="progress-count"
              >
                {completedCount} / {totalCount} modules complete
              </span>
            </div>
            <ProgressBar current={completedCount} total={totalCount} />
          </div>
        )}
      </div>

      {/* Module player overlay */}
      {activeModule && (
        <div className="rounded-2xl border border-white/[0.08] bg-bg-card p-6 flex flex-col gap-4">
          <button
            type="button"
            onClick={handleBack}
            className="self-start text-text-muted text-xs font-mono uppercase tracking-wider hover:text-text-secondary transition-colors duration-200"
            aria-label="Back to modules"
          >
            ← Back
          </button>
          <ModulePlayer module={activeModule} onComplete={handleComplete} />
        </div>
      )}

      {/* Module grid — shown when no active player */}
      {!activeModule && (
        <>
          {loading ? (
            /* Loading skeletons */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-white/[0.06] bg-bg-card p-5 animate-pulse"
                  aria-hidden="true"
                >
                  <div className="h-3 w-16 rounded-full bg-white/[0.06] mb-3" />
                  <div className="h-4 w-3/4 rounded-full bg-white/[0.08] mb-2" />
                  <div className="h-3 w-full rounded-full bg-white/[0.06] mb-1" />
                  <div className="h-3 w-2/3 rounded-full bg-white/[0.06]" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {LEARN_MODULES.map((mod) => (
                <ModuleCard
                  key={mod.id}
                  module={mod}
                  completed={isCompleted(mod.id)}
                  onStart={handleStart}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
