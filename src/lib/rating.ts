/**
 * The rating engine. Main spec section 2, as amended by the decision that there
 * is no per-mode threshold multiplier: each mode brings its own target T and the
 * same two fractions apply to it.
 *
 * Pure module. The daily target T arrives as an argument and is never derived
 * here, so this file has no dependency on fatTarget.ts, the settings store, or
 * React. rateForSettings.ts is the one place that knows how to get T.
 *
 * The point of this engine is not to say no. It is to say here is the version of
 * this you can have, so every result carries modifications, and the copy is
 * neutral and forward looking (CLAUDE.md invariant 10).
 */

import type { Food, FoodFlag, Mode, Rating } from '../types.ts'
import {
  ALWAYS_RED_FLAGS,
  BUDGET_WARNING_GRAMS,
  FLARE_ONLY_RED_FLAGS,
  THRESHOLD_FRACTIONS,
  YELLOW_FLOOR_FLAGS,
} from './ratingThresholds.ts'

/**
 * The two cut points for one serving, derived from the current mode's target.
 *
 * Deliberately no `mode` and no `multiplier`. See ratingThresholds.ts for why.
 */
export interface Thresholds {
  /** T, exactly as passed in. */
  target: number
  /** F <= greenMax is GREEN. Inclusive. */
  greenMax: number
  /** greenMax < F <= yellowMax is YELLOW. Above is RED. Inclusive. */
  yellowMax: number
}

export type RatingReasonCode =
  | 'within-target'
  | 'over-green-threshold'
  | 'over-yellow-threshold'
  | 'alcohol'
  | 'deep-fried'
  | 'flare-restricted'
  | 'yellow-floor'

export interface RatingReason {
  code: RatingReasonCode
  /** The flag that triggered this, when a flag did. */
  flag: FoodFlag | null
  text: string
}

export type RatingIcon = 'check' | 'alert' | 'stop'

/**
 * Invariant 8: a rating always carries colour AND icon AND text, never colour
 * alone. Bundling all three in one object means a consumer cannot take the
 * colour without also holding the icon and the word.
 */
export interface RatingPresentation {
  rating: Rating
  icon: RatingIcon
  label: string
  /** For fills, bars, and icons. */
  fillVar: '--laurel' | '--gold' | '--clay'
  /** Meets AA against --paper, so safe for wording. */
  textVar: '--laurel' | '--gold-text' | '--clay'
}

export interface BudgetNote {
  /** T minus what is already logged today, before this item. May be negative. */
  remainingGrams: number
  /** What would be left after this item. May be negative. */
  wouldRemainGrams: number
  text: string
}

export interface RateFoodInput {
  fatGrams: number
  /** T. Passed explicitly, never derived in this module. */
  target: number
  mode: Mode
  flags?: readonly FoodFlag[] | undefined
  modifications?: readonly string[] | undefined
  /** Grams already logged today. Omit when the budget is not being tracked. */
  gramsUsedToday?: number | undefined
}

export interface FoodRating {
  rating: Rating
  /** What the arithmetic alone said, before any override or floor. */
  mathRating: Rating
  thresholds: Thresholds
  fatGrams: number
  /** Fixed order, dominant reason first. */
  reasons: RatingReason[]
  /** Invariant 4: always empty when the alcohol flag is present. */
  modifications: string[]
  presentation: RatingPresentation
  budgetNote: BudgetNote | null
}

/**
 * All engine copy in one place so the tone can be reviewed at a glance and
 * pinned by test. No em dashes (invariant 9). Never scolding (invariant 10).
 */
export const RATING_COPY = {
  green: 'This fits comfortably in what you have to work with today.',
  yellow: 'This one is worth a smaller portion, or one of the changes below.',
  red: 'This is a large share of a whole day of fat in one serving.',
  alcohol:
    'Alcohol avoidance is standard guidance for pancreatitis, so this one is not a fat question.',
  deepFried: 'Deep fried by default, which puts it here whatever the number says.',
  flareRestricted: 'Harder to digest, so it sits out while you are in flare mode.',
  yellowFloor: 'The fat in this one is easy to underestimate, so it stays here at best.',
  budgetLeft:
    'You have {grams} left today. A smaller portion works, and so does saving this for tomorrow.',
  budgetUsedUp: 'Today is fully spoken for. Tomorrow starts fresh.',
} as const

export const RATING_PRESENTATION: Record<Rating, RatingPresentation> = {
  green: {
    rating: 'green',
    icon: 'check',
    label: 'Green',
    fillVar: '--laurel',
    textVar: '--laurel',
  },
  yellow: {
    rating: 'yellow',
    icon: 'alert',
    label: 'Yellow',
    fillVar: '--gold',
    // Never --gold for wording. It does not meet AA against --paper.
    textVar: '--gold-text',
  },
  red: {
    rating: 'red',
    icon: 'stop',
    label: 'Red',
    fillVar: '--clay',
    textVar: '--clay',
  },
}

const SEVERITY: Record<Rating, number> = { green: 0, yellow: 1, red: 2 }

/** Returns whichever of the two is more severe. Nothing here ever lowers a rating. */
function worst(a: Rating, b: Rating): Rating {
  return SEVERITY[a] >= SEVERITY[b] ? a : b
}

/** The two cut points for the current mode's target. Takes no mode, by design. */
export function thresholdsFor(target: number): Thresholds {
  return {
    target,
    // Not rounded. 0.1 * T can land a hair high in binary floating point, which
    // errs generous by a fraction of a milligram on a number that is already
    // labelled an estimate. An epsilon would be false precision.
    greenMax: target * THRESHOLD_FRACTIONS.green,
    yellowMax: target * THRESHOLD_FRACTIONS.yellow,
  }
}

/** The arithmetic alone. Both bounds inclusive, per the spec. */
export function mathRating(fatGrams: number, thresholds: Thresholds): Rating {
  if (fatGrams <= thresholds.greenMax) return 'green'
  if (fatGrams <= thresholds.yellowMax) return 'yellow'
  return 'red'
}

/**
 * Exported so budget.ts can phrase gram counts identically. Two copies of this
 * drift, and the failure mode is the same number written two ways on one screen.
 */
export function formatGrams(grams: number): string {
  const rounded = Math.round(grams * 10) / 10
  return `${rounded} ${rounded === 1 ? 'gram' : 'grams'}`
}

/** Neutral wording for the budget note. Exported so the copy tests can reach it. */
export function budgetNoteText(remainingGrams: number): string {
  if (remainingGrams <= 0) return RATING_COPY.budgetUsedUp
  return RATING_COPY.budgetLeft.replace('{grams}', formatGrams(remainingGrams))
}

const MATH_REASON: Record<Rating, { code: RatingReasonCode; text: string }> = {
  green: { code: 'within-target', text: RATING_COPY.green },
  yellow: { code: 'over-green-threshold', text: RATING_COPY.yellow },
  red: { code: 'over-yellow-threshold', text: RATING_COPY.red },
}

/**
 * The rating is the maximum severity across four independent contributors:
 *
 *   A. the arithmetic
 *   B. the unconditional red flags (alcohol, deep fried)
 *   C. the flare only red flags, in flare mode only
 *   D. the yellow floor
 *
 * Written as a fold over `worst` rather than a chain of if/else, so the floor in
 * D is structurally incapable of demoting a red produced by A, B, or C.
 */
export function rateFood(input: RateFoodInput): FoodRating {
  const flags = input.flags ?? []
  const thresholds = thresholdsFor(input.target)

  const math = mathRating(input.fatGrams, thresholds)
  let rating: Rating = math

  const hasAlcohol = flags.includes('alcohol')
  const reasons: RatingReason[] = []

  // B. Unconditional reds. These beat everything, including zero grams and an
  // implausibly generous target.
  if (hasAlcohol) {
    rating = worst(rating, 'red')
    reasons.push({ code: 'alcohol', flag: 'alcohol', text: RATING_COPY.alcohol })
  }
  if (flags.includes('deep-fried')) {
    rating = worst(rating, 'red')
    reasons.push({ code: 'deep-fried', flag: 'deep-fried', text: RATING_COPY.deepFried })
  }
  for (const flag of flags) {
    if (ALWAYS_RED_FLAGS.has(flag)) rating = worst(rating, 'red')
  }

  // C. Flare only reds. Inert in stable and recovering, and not even mentioned
  // there. Emitted in the food's own flag order.
  if (input.mode === 'flare') {
    for (const flag of flags) {
      if (!FLARE_ONLY_RED_FLAGS.has(flag)) continue
      rating = worst(rating, 'red')
      reasons.push({ code: 'flare-restricted', flag, text: RATING_COPY.flareRestricted })
    }
  }

  // D. The yellow floor. Can raise a green to yellow, never lower anything.
  for (const flag of flags) {
    if (!YELLOW_FLOOR_FLAGS.has(flag)) continue
    rating = worst(rating, 'yellow')
    reasons.push({ code: 'yellow-floor', flag, text: RATING_COPY.yellowFloor })
  }

  // The arithmetic reason comes last, so reasons[0] is always the headline.
  const mathReason = MATH_REASON[math]
  reasons.push({ code: mathReason.code, flag: null, text: mathReason.text })

  // E. Invariant 4. No modifications are ever offered for alcohol, including
  // the one that data/foods.json actually ships on its alcohol entry.
  const modifications = hasAlcohol ? [] : [...(input.modifications ?? [])]

  // F. Budget awareness. Advisory only, and never touches the rating.
  let budgetNote: BudgetNote | null = null
  if (input.gramsUsedToday !== undefined) {
    const remainingGrams = input.target - input.gramsUsedToday
    if (remainingGrams < BUDGET_WARNING_GRAMS) {
      budgetNote = {
        remainingGrams,
        wouldRemainGrams: remainingGrams - input.fatGrams,
        text: budgetNoteText(remainingGrams),
      }
    }
  }

  return {
    rating,
    mathRating: math,
    thresholds,
    fatGrams: input.fatGrams,
    reasons,
    modifications,
    presentation: RATING_PRESENTATION[rating],
    budgetNote,
  }
}

/** Convenience wrapper for a food out of the dataset. */
export function rateFoodEntry(
  food: Food,
  options: { target: number; mode: Mode; gramsUsedToday?: number | undefined },
): FoodRating {
  return rateFood({
    fatGrams: food.fatGrams,
    target: options.target,
    mode: options.mode,
    flags: food.flags,
    modifications: food.modifications,
    ...(options.gramsUsedToday !== undefined ? { gramsUsedToday: options.gramsUsedToday } : {}),
  })
}
