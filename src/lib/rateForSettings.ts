/**
 * The seam between the fat target calculator and the rating engine.
 *
 * This is the only module that knows where T comes from. rating.ts stays a pure
 * function of (grams, T, mode), which is what lets the traffic light be tested
 * without constructing a Settings object, and what keeps the two modules from
 * importing each other.
 */

import type { Food, FoodFlag, Settings } from '../types.ts'
import { computeFatTarget, type MissingInput } from './fatTarget.ts'
import { rateFood, rateFoodEntry, type FoodRating } from './rating.ts'

/**
 * Where the target came from. Excludes "incomplete", which has no number.
 *
 * The UI must keep these distinct rather than collapsing them to "we have a
 * number": "override" is her care team's instruction and "provisional" is a
 * placeholder she typed in herself, and describing the second as the first
 * would misstate where the guidance came from.
 */
export type TargetSource = 'flare-ceiling' | 'override' | 'calculated' | 'provisional'

export type RateForSettingsResult =
  | {
      status: 'rated'
      target: number
      targetSource: TargetSource
      rating: FoodRating
    }
  | {
      /**
       * Not enough profile to know T, so there is nothing honest to rate
       * against. Deliberately not a fallback to 30g: main spec section 0 item 2
       * makes the target a user setting, not an app decision, and
       * computeFatTarget already refuses to guess. The UI asks her for it.
       */
      status: 'no-target'
      target: null
      missing: MissingInput[]
    }

export interface RateForSettingsInput {
  fatGrams: number
  flags?: readonly FoodFlag[] | undefined
  modifications?: readonly string[] | undefined
  gramsUsedToday?: number | undefined
}

export function rateForSettings(
  settings: Settings,
  input: RateForSettingsInput,
): RateForSettingsResult {
  const target = computeFatTarget(settings)

  if (target.source === 'incomplete') {
    return { status: 'no-target', target: null, missing: target.missing }
  }

  return {
    status: 'rated',
    target: target.grams,
    targetSource: target.source,
    rating: rateFood({
      fatGrams: input.fatGrams,
      target: target.grams,
      mode: settings.currentMode,
      ...(input.flags !== undefined ? { flags: input.flags } : {}),
      ...(input.modifications !== undefined ? { modifications: input.modifications } : {}),
      ...(input.gramsUsedToday !== undefined ? { gramsUsedToday: input.gramsUsedToday } : {}),
    }),
  }
}

/** Same, for a food out of the dataset. */
export function rateFoodForSettings(
  settings: Settings,
  food: Food,
  options: { gramsUsedToday?: number | undefined } = {},
): RateForSettingsResult {
  const target = computeFatTarget(settings)

  if (target.source === 'incomplete') {
    return { status: 'no-target', target: null, missing: target.missing }
  }

  return {
    status: 'rated',
    target: target.grams,
    targetSource: target.source,
    rating: rateFoodEntry(food, {
      target: target.grams,
      mode: settings.currentMode,
      ...(options.gramsUsedToday !== undefined ? { gramsUsedToday: options.gramsUsedToday } : {}),
    }),
  }
}
