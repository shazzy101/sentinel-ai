import { useState } from 'react'
import ProgressBar from './ProgressBar'

/**
 * ModulePlayer — walks a user through a learn module one screen at a time.
 *
 * Props:
 *   module     {object}   — a module from LEARN_MODULES
 *   onComplete {function} — called with module.id when the user finishes
 */
export default function ModulePlayer({ module, onComplete }) {
  const [screenIndex, setScreenIndex] = useState(0)
  const [done, setDone] = useState(false)

  const screens = module?.screens ?? []
  const totalScreens = screens.length
  const screen = screens[screenIndex]
  const isLast = screenIndex === totalScreens - 1

  function handleNext() {
    if (!isLast) {
      setScreenIndex((i) => i + 1)
    }
  }

  function handleBack() {
    if (screenIndex > 0) {
      setScreenIndex((i) => i - 1)
    }
  }

  function handleComplete() {
    setDone(true)
    if (onComplete) onComplete(module.id)
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="text-signal text-4xl font-mono">✓</div>
        <h2 className="text-text-primary text-xl font-semibold">Module complete</h2>
        <p className="text-text-secondary text-sm max-w-xs">
          You&apos;ve unlocked a new dashboard feature. Keep going to unlock more.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header: module title + progress */}
      <div className="flex flex-col gap-2">
        <p className="text-text-muted text-xs font-mono uppercase tracking-wider">
          {module.title}
        </p>
        <ProgressBar current={screenIndex + 1} total={totalScreens} />
        <p className="text-text-muted text-xs text-right font-mono">
          {screenIndex + 1} / {totalScreens}
        </p>
      </div>

      {/* Screen content */}
      <div className="flex flex-col gap-3 min-h-[180px]">
        <h2 className="text-text-primary text-lg font-semibold leading-snug">
          {screen?.title}
        </h2>
        <p className="text-text-secondary text-sm leading-relaxed">
          {screen?.body}
        </p>
        {screen?.example && (
          <div className="rounded-xl border border-signal/20 bg-signal/5 px-4 py-3">
            <p className="text-signal text-xs font-mono leading-relaxed">
              {screen.example}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={handleBack}
          disabled={screenIndex === 0}
          className="text-text-secondary text-sm px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-200"
          aria-label="Previous screen"
        >
          Back
        </button>

        {isLast ? (
          <button
            type="button"
            onClick={handleComplete}
            className="text-text-inverse text-sm font-medium px-5 py-2 rounded-xl bg-signal hover:brightness-110 transition-all duration-200"
            aria-label="Complete module"
          >
            Complete
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            className="text-text-inverse text-sm font-medium px-5 py-2 rounded-xl bg-signal hover:brightness-110 transition-all duration-200"
            aria-label="Next screen"
          >
            Next
          </button>
        )}
      </div>
    </div>
  )
}
