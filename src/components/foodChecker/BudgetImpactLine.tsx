import { budgetImpact, budgetImpactText } from '../../lib/budget.ts'
import { SOURCE_NOTE } from '../../lib/targetSource.ts'
import type { TargetSource } from '../../lib/rateForSettings.ts'

/**
 * What this serving does to what is left of today. Spec section 5.1.
 *
 * Deliberately not FoodRating.budgetNote, which only appears once she is under
 * five grams remaining, because there it is a warning. This line is on every
 * result.
 *
 * The provenance of the target is named via the shared SOURCE_NOTE, so a number
 * she typed in herself is never presented as guidance from her care team. The
 * budget bar's log panel names it the same way.
 */

export function BudgetImpactLine({
  target,
  targetSource,
  usedGrams,
  itemGrams,
}: {
  target: number
  targetSource: TargetSource
  usedGrams: number
  itemGrams: number
}) {
  const impact = budgetImpact(target, usedGrams, itemGrams)

  return (
    <div className="mt-4 border-t border-stone pt-3">
      <p className="numeral m-0 text-ink">{budgetImpactText(impact)}</p>
      <p className="mt-1 mb-0 text-sm text-ridge-mid">{SOURCE_NOTE[targetSource]}</p>
    </div>
  )
}
