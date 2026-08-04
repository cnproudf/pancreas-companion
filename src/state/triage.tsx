import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { foodGuidanceAllowed, type TriageStage } from '../lib/triage.ts'
import type { Mode } from '../types.ts'
import { useSettings } from './settings.tsx'

/**
 * Where the flare mode triage gate currently stands. Invariant 1.
 *
 * A context provider rather than state inside FlareGate, because the answer has
 * consumers on BOTH sides of the gate. FatBudgetBar and the symptom sheet's
 * AttachFoodSection render outside FlareGate and carry their own guards, and
 * those guards have to agree with the gate exactly. Two copies of this state
 * would let the budget bar reappear while the red flag check was still on
 * screen, which is the precise thing invariant 1 forbids.
 *
 * NOTHING HERE TOUCHES localStorage, AND NOTHING HERE MAY.
 *
 * Triage clearance is in memory only, by decision. A reload, a relaunch, or
 * leaving flare mode and coming back all re-arm the gate. See the header note
 * in lib/triage.ts for why, and note that lib/triage.ts does not import
 * storage.ts either. Persisting this would be a two line change and a bad one.
 */

export interface TriageApi {
  /** Only meaningful in flare mode. Always a valid stage regardless. */
  stage: TriageStage
  /**
   * True when the current mode is flare, whatever the stage.
   *
   * Separate from `stage` because "cleared" alone does not mean she is in a
   * flare, and the flare guidance panel must not appear in stable mode. The
   * stamp in `answer` makes that combination unreachable today, but a gate that
   * depends on an unreachable state staying unreachable is a gate waiting to
   * break.
   */
  inFlare: boolean
  /** Convenience for the three guards. mode is read from settings here. */
  foodAllowed: boolean
  /** She reported one or more red flags. */
  reportRedFlag: () => void
  /** She reported none. Proceeds to flare food guidance. */
  reportNoRedFlag: () => void
  /** "I have already contacted them." Her assertion, from the urgent panel. */
  alreadyContacted: () => void
  /** Back to the questions, from the "still feel like something is wrong" link. */
  reopenCheck: () => void
}

const TriageContext = createContext<TriageApi | null>(null)

export function TriageProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const mode = settings.currentMode

  /**
   * The answer, STAMPED WITH THE MODE IT WAS GIVEN UNDER.
   *
   * That stamp is what makes the reset below work without an effect.
   */
  const [answer, setAnswer] = useState<{ mode: Mode; stage: TriageStage } | null>(null)

  /*
   * DERIVED DURING RENDER, NOT IN A useEffect. THIS IS NOT A STYLE PREFERENCE.
   *
   * The gate has to re-arm whenever she enters flare mode. Resetting in an
   * effect would mean one committed render where the stale "cleared" stage is
   * paired with the new mode, and a render where flare mode reports cleared is
   * literally a frame of food content above the triage screen. React would
   * paint it. She would see it.
   *
   * Comparing the stamp against the current mode instead means a mode change
   * re-arms the gate in the same render that changes the mode. There is no
   * intermediate state to leak, because there is no intermediate state.
   */
  const stage: TriageStage = answer !== null && answer.mode === mode ? answer.stage : 'redflag-check'

  const set = useCallback(
    (next: TriageStage) => {
      setAnswer({ mode, stage: next })
    },
    [mode],
  )

  const reportRedFlag = useCallback(() => set('urgent'), [set])
  const reportNoRedFlag = useCallback(() => set('cleared'), [set])
  const alreadyContacted = useCallback(() => set('cleared'), [set])
  const reopenCheck = useCallback(() => set('redflag-check'), [set])

  const value = useMemo<TriageApi>(
    () => ({
      stage,
      inFlare: mode === 'flare',
      foodAllowed: foodGuidanceAllowed(mode, stage),
      reportRedFlag,
      reportNoRedFlag,
      alreadyContacted,
      reopenCheck,
    }),
    [stage, mode, reportRedFlag, reportNoRedFlag, alreadyContacted, reopenCheck],
  )

  return <TriageContext value={value}>{children}</TriageContext>
}

export function useTriage(): TriageApi {
  const context = useContext(TriageContext)
  if (context === null) {
    throw new Error('useTriage must be used inside a TriageProvider')
  }
  return context
}
