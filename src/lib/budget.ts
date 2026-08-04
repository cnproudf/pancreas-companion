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
