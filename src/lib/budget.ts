/**
 * What one serving does to what is left of today.
 *
 * rating.ts already carries a BudgetNote, but that only appears once she is
 * under 5 grams remaining, because there it is a warning. Spec section 5.1
 * wants the budget impact on every result, so this module produces the general
 * readout. The Phase 4 budget bar reads from here too.
 *
 * Pure. Takes the numbers, returns the numbers and the sentence.
 */

import { formatGrams, RATING_COPY } from './rating.ts'
import { BUDGET_WARNING_GRAMS } from './ratingThresholds.ts'

export interface BudgetImpact {
  /** T, from whichever source resolved it. */
  target: number
  usedGrams: number
  /** May be negative. She can already be past her target when she checks. */
  remainingBefore: number
  itemGrams: number
  /** May be negative. */
  remainingAfter: number
}

/**
 * All copy in one place so the tone can be reviewed at a glance, the way
 * RATING_COPY does it.
 *
 * Invariant 10: never scold. Going over is information, not a verdict, and
 * every branch that reports it also offers a way forward. Invariant 9: no em
 * dashes.
 */
export const BUDGET_COPY = {
  fits: 'You have {before} left today. This one would leave you about {after}.',
  exact: 'You have {before} left today. This one would use the rest of it.',
  over:
    'You have {before} left today. This one runs about {over} past that. A smaller portion closes most of the gap.',
  usedUp: RATING_COPY.budgetUsedUp,
} as const

/** Rounds to one decimal, which is already finer than an estimate deserves. */
function round(grams: number): number {
  return Math.round(grams * 10) / 10
}

export function budgetImpact(target: number, usedGrams: number, itemGrams: number): BudgetImpact {
  const remainingBefore = round(target - usedGrams)
  return {
    target,
    usedGrams,
    remainingBefore,
    itemGrams,
    remainingAfter: round(remainingBefore - itemGrams),
  }
}

/**
 * How full the day is. Not a food rating, even though it borrows the same three
 * colours: this describes the day, not a serving.
 */
export type BudgetTone = 'under' | 'close' | 'full'

export interface BudgetBarState {
  target: number
  usedGrams: number
  /** May be negative. */
  remainingGrams: number
  /** 0 to 100. Clamped, so the fill never draws past the end of the track. */
  fillPercent: number
  /** True once she is past the target. The fill is already pinned at 100. */
  overflow: boolean
  tone: BudgetTone
  /** The glanceable line, spec section 5.4. */
  readout: string
  /** The sentence under it. Carries the state in words, never colour alone. */
  note: string
}

/**
 * Bar copy, separate from BUDGET_COPY above because that one is about a serving
 * she is considering and this one is about the day so far.
 *
 * Invariant 9: no em dashes. Invariant 10: nothing here comments on her
 * conduct. Going over is reported as a fact about the day with tomorrow
 * attached, never as a verdict.
 */
export const BAR_COPY = {
  readout: '{used}g of {target}g used today',
  left: 'You have {grams} left today.',
  // Reused rather than reworded. Two sentences for one state drift apart.
  usedUp: RATING_COPY.budgetUsedUp,
  noTarget: '{used}g logged today.',
  noTargetNote: 'Add a daily target and this bar fills against it.',
} as const

/**
 * Everything the bar needs from two numbers.
 *
 * The tone boundary is BUDGET_WARNING_GRAMS, the same constant rateFood uses
 * for its budget note, so the bar turns gold at the exact moment the checker
 * starts adding its gentle line. Two thresholds here would mean the two halves
 * of the same screen disagreed about when the day is getting full.
 */
export function budgetBarState(target: number, usedGrams: number): BudgetBarState {
  const remainingGrams = round(target - usedGrams)

  const tone: BudgetTone =
    remainingGrams <= 0 ? 'full' : remainingGrams < BUDGET_WARNING_GRAMS ? 'close' : 'under'

  // A target of zero is not a real target, and dividing by it would put NaN in
  // a style attribute. Nothing is drawn instead.
  const fillPercent = target > 0 ? Math.min(100, Math.max(0, (usedGrams / target) * 100)) : 0

  return {
    target,
    usedGrams,
    remainingGrams,
    fillPercent,
    overflow: usedGrams > target,
    tone,
    /*
     * The compact "18g" form is deliberately not formatGrams, which produces
     * "18 grams". Spec section 5.4 wants the tight version, because this line
     * is read at a glance rather than as a sentence. The note below it does use
     * formatGrams, so the prose still matches the rest of the app. These are
     * two different jobs and must not be deduplicated into one.
     */
    readout: BAR_COPY.readout
      .replace('{used}', String(round(usedGrams)))
      .replace('{target}', String(round(target))),
    note:
      remainingGrams <= 0
        ? BAR_COPY.usedUp
        : BAR_COPY.left.replace('{grams}', formatGrams(remainingGrams)),
  }
}

/** The readout when there is no target yet. No denominator, nothing invented. */
export function budgetBarReadoutWithoutTarget(usedGrams: number): string {
  return BAR_COPY.noTarget.replace('{used}', String(round(usedGrams)))
}

export function budgetImpactText(impact: BudgetImpact): string {
  // Already at or past the target before this item. Nothing about the item
  // changes what she needs to hear, so say the one useful thing and stop.
  if (impact.remainingBefore <= 0) return BUDGET_COPY.usedUp

  const before = formatGrams(impact.remainingBefore)

  if (impact.remainingAfter > 0) {
    return BUDGET_COPY.fits.replace('{before}', before).replace('{after}', formatGrams(impact.remainingAfter))
  }

  if (impact.remainingAfter === 0) {
    return BUDGET_COPY.exact.replace('{before}', before)
  }

  return BUDGET_COPY.over
    .replace('{before}', before)
    .replace('{over}', formatGrams(Math.abs(impact.remainingAfter)))
}
