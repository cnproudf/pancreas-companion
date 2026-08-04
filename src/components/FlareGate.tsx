import type { ReactNode } from 'react'
import { useTriage } from '../state/triage.tsx'

/**
 * Invariant 1: flare mode opens the triage screen BEFORE any food content.
 * Always.
 *
 * This is the structural seam that enforces it. Food content goes INSIDE this
 * gate from Phase 2 onward, so it cannot render before triage has been passed.
 *
 * The triage content itself (spec section 4: the five red flag questions, the
 * yes branch with the tap-to-dial care team panel, the no branch into flare
 * food guidance) is a later phase. This placeholder holds the position and
 * proves the gate closes.
 */
export function FlareGate({ children }: { children: ReactNode }) {
  const { foodAllowed } = useTriage()

  if (foodAllowed) return <>{children}</>

  return (
    <section
      aria-labelledby="flare-gate-heading"
      data-testid="flare-gate"
      className="rounded-lg border-2 border-clay bg-paper p-5"
    >
      <h2 id="flare-gate-heading" className="mt-0 mb-2 text-xl">
        Before we talk about food
      </h2>
      <p className="m-0 text-ink">
        When you tell the app you are having a bad time, it checks in with you
        first. That check is the next thing being built, so nothing about food
        appears here yet.
      </p>
      <p className="mt-3 mb-0 text-ink">
        If you are in severe pain, cannot keep fluids down, or have a fever or
        chills, please contact your care team now.
      </p>
      <p
        className="mt-4 mb-0 text-sm text-ridge-mid"
        data-note="phase-1 placeholder, triage screen lands in a later phase"
      >
        Placeholder for the triage screen.
      </p>
    </section>
  )
}
