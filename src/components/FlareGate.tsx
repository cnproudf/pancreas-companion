import type { ReactNode } from 'react'
import { FlareGuidance } from './flare/FlareGuidance.tsx'
import { RedFlagCheck } from './flare/RedFlagCheck.tsx'
import { UrgentPanel } from './flare/UrgentPanel.tsx'
import { useTriage } from '../state/triage.tsx'

/**
 * INVARIANT 1: FLARE MODE OPENS THE TRIAGE SCREEN BEFORE ANY FOOD CONTENT.
 * ALWAYS.
 *
 * This is the structural seam that enforces it, and as of Phase 9 it is real
 * rather than a placeholder. Food content goes INSIDE this gate, so it cannot
 * render before triage has been answered. Two components render outside it and
 * carry their own guards for reasons documented in their own files:
 * FatBudgetBar and the symptom sheet's AttachFoodSection.
 *
 * HOW A GATE THAT ASKS ABOUT SYMPTOMS SQUARES WITH SPEC RULE 6, WHICH SAYS THE
 * APP NEVER INTERPRETS THEM:
 *
 *   The app asks a fixed list, routes every yes to a person, and never forms a
 *   view.
 *
 * Asking is not interpreting. Interpreting is what rule 6 forbids, and nothing
 * in this flow does it: the questions are authored and identical every time,
 * nothing here reads her symptom log or her pain scores to decide what to show,
 * a yes produces a phone number rather than an assessment, a no is never
 * reported back to her as a clearance, and no branch writes a finding anywhere.
 * The full argument, including the seven constraints that keep it true, is in
 * the header of lib/triage.ts. Read it before changing anything in this flow.
 *
 * THREE STAGES, AND ONLY THE LAST ONE RENDERS CHILDREN.
 *
 *   redflag-check  the five questions. Nothing else on screen.
 *   urgent         she reported one. Contact panel, no food content, and the
 *                  children are not rendered at all.
 *   cleared        flare guidance, and then the app.
 *
 * Outside flare mode there is no gate and children render untouched, which is
 * what foodGuidanceAllowed returns for stable and recovering at every stage.
 */
export function FlareGate({ children }: { children: ReactNode }) {
  const { stage, inFlare, foodAllowed } = useTriage()

  /*
   * Not in flare mode, or in flare mode with triage cleared. The one call, in
   * the one place, that decides whether food content may render at all.
   *
   * The guidance panel is gated on inFlare as well as the stage, so it cannot
   * appear in stable mode. Today the provider's mode stamp already makes that
   * combination unreachable; this does not depend on that staying true.
   */
  if (foodAllowed) {
    return (
      <>
        {inFlare && stage === 'cleared' && <FlareGuidance />}
        {children}
      </>
    )
  }

  /*
   * The gate is closed. Note that children are not rendered in either branch
   * below, rather than rendered and hidden. Hiding food content with CSS or
   * aria-hidden would leave it in the DOM, reachable by find-in-page and read
   * by anything that walks the tree, and "before any food content" is a claim
   * about what exists on the screen, not about what is painted.
   */
  return stage === 'urgent' ? <UrgentPanel /> : <RedFlagCheck />
}
