import { useId, useState } from 'react'
import {
  budgetBarReadoutWithoutTarget,
  budgetBarState,
  BAR_COPY,
  type BudgetTone,
} from '../../lib/budget.ts'
import { computeFatTarget } from '../../lib/fatTarget.ts'
import { countMeals, mealNudgeText } from '../../lib/meals.ts'
import { useFoodLog } from '../../state/foodLog.tsx'
import { useSettings } from '../../state/settings.tsx'
import { useTriage } from '../../state/triage.tsx'
import { TodayLogPanel } from './TodayLogPanel.tsx'

/**
 * The daily fat budget bar. Spec section 5.4.
 *
 * This is what turns the traffic light from a trivia game into a decision tool,
 * so it stays maximally legible. Addendum section C bars the ridgeline motif
 * from this component by name: decoration on a screen someone reads while
 * unwell is a cost, not a feature.
 *
 * It reads gramsUsedToday from FoodLogProvider and never recomputes it. There
 * is one source of truth for what today has cost.
 */

/**
 * Tailwind v4 purges any class composed at runtime, so these are written out as
 * literals rather than built from RatingPresentation's fillVar. Same reason as
 * the table in foodChecker/ratingClasses.ts.
 *
 * The fill uses --gold, the wording uses --gold-text. #B5762C does not meet AA
 * against --paper at small sizes, and this line is read in bad lighting.
 */
const TONE_CLASSES: Record<BudgetTone, { fill: string; text: string }> = {
  under: { fill: 'bg-laurel', text: 'text-laurel' },
  close: { fill: 'bg-gold', text: 'text-gold-text' },
  full: { fill: 'bg-clay', text: 'text-clay' },
}

export function FatBudgetBar() {
  const { settings } = useSettings()
  const { foodAllowed } = useTriage()
  const { entriesToday, gramsUsedToday } = useFoodLog()
  const [open, setOpen] = useState(false)
  const panelId = useId()

  /*
   * INVARIANT 1. Flare mode opens the triage screen before any food content,
   * always.
   *
   * AppShell renders this bar outside FlareGate, so nothing else stops a fat
   * budget from appearing above the triage screen. The guard lives here rather
   * than in AppShell so it travels with the component: anyone mounting this
   * somewhere new gets the rule for free.
   *
   * Phase 9 turned this from a mode check into a triage check, which is what
   * the note here used to promise. The bar is now withheld only until the gate
   * clears, and after that it fills against the 15 gram flare ceiling with the
   * ceiling framing attached (BAR_COPY.flareCeilingNote). What has not changed
   * is the ordering: a grams-used-today readout ABOVE the red flag check is
   * exactly what the invariant exists to prevent, so do not swap this back to
   * asking about the mode alone.
   *
   * foodGuidanceAllowed is the one definition of this rule. FlareGate and
   * AttachFoodSection ask the same function. See lib/triage.ts.
   */
  if (!foodAllowed) return null

  const target = computeFatTarget(settings)
  const meals = countMeals(entriesToday)
  const nudge = mealNudgeText(meals)

  const hasTarget = target.source !== 'incomplete'
  const state = hasTarget ? budgetBarState(target.grams, gramsUsedToday) : null

  const readout = state === null ? budgetBarReadoutWithoutTarget(gramsUsedToday) : state.readout
  const note = state === null ? BAR_COPY.noTargetNote : state.note
  const tone = state === null ? null : TONE_CLASSES[state.tone]

  return (
    <div className="bg-paper px-5 pt-4 pb-1">
      <div className="mx-auto max-w-xl">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((wasOpen) => !wasOpen)}
          aria-label={`${readout} ${nudge} ${open ? "Close today's log." : "Open today's log."}`}
          className="w-full rounded-lg border border-stone bg-white/50 px-4 py-3 text-left hover:border-creek"
        >
          {/*
            Invariant 8 in spirit: the number and the sentence below carry the
            state in words, so nothing here rests on the fill colour alone.
          */}
          <div className="flex items-baseline justify-between gap-3">
            <span
              className={`numeral text-xl font-semibold ${tone === null ? 'text-ridge-deep' : tone.text}`}
            >
              {readout}
            </span>
            <span aria-hidden="true" className="shrink-0 text-sm text-ridge-mid">
              {open ? 'Close' : 'Today'}
            </span>
          </div>

          {/*
            The track. Hidden from the accessibility tree because the readout
            above already says the same thing in words, and a progressbar role
            cannot be nested inside a button.
          */}
          {state !== null && tone !== null && (
            <div aria-hidden="true" className="mt-2 h-3 overflow-hidden rounded-full bg-stone">
              <div
                className={`h-full rounded-full transition-[width] duration-300 ${tone.fill}`}
                style={{ width: `${state.fillPercent}%` }}
              />
            </div>
          )}

          {/*
            The note stays at the theme's base 18px rather than text-sm. It is
            the line that says where the day stands in words, so it is doing the
            same job as the number above it and is read in the same bad
            lighting. The meal nudge below it is genuinely secondary.
          */}
          <span className="mt-2 block text-ink">{note}</span>
          {/*
            Flare mode only. The denominator is a ceiling, not a goal, and a
            bar filling toward a number reads as a goal without this line.
          */}
          {target.source === 'flare-ceiling' && (
            <span className="mt-1 block text-sm text-ink">{BAR_COPY.flareCeilingNote}</span>
          )}
          <span className="mt-1 block text-sm text-ridge-mid">{nudge}</span>
        </button>

        {/*
          Announced without moving focus, so logging a food from the checker is
          spoken by a screen reader while she stays where she is.
        */}
        <p aria-live="polite" className="sr-only">
          {readout}
        </p>

        {open && <TodayLogPanel id={panelId} targetSource={hasTarget ? target.source : null} />}
      </div>
    </div>
  )
}
