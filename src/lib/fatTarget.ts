/**
 * Daily fat target calculator. Implements docs/spec-addendum.md section A
 * exactly. Pure module, no React, so the Phase 2 rating engine can scale off
 * the same numbers without importing any UI.
 *
 * Important framing, from the addendum: the National Pancreas Foundation does
 * NOT publish a formula or a lookup table. What follows is standard clinical
 * arithmetic used to personalize a number, with the result constrained inside
 * the band NPF does publish. The interface must say exactly that, and must
 * never imply the formula came from NPF.
 */

import type { ActivityLevel, BiologicalSex, Mode, Settings } from '../types.ts'

/** Step 2. Daily energy multipliers. */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  resting: 1.2,
  light: 1.375,
  moderate: 1.55,
}

/** Step 3. Share of daily energy coming from fat, by mode. */
export const FAT_PERCENT = {
  stable: 0.25,
  recovering: 0.2,
} as const

/** Step 4. The published band, per mode. */
export const CLAMP_BANDS = {
  stable: { min: 30, max: 50 },
  recovering: { min: 20, max: 30 },
} as const

/**
 * Flare mode does not get a calculated target. NPF describes flares as a time
 * when a doctor may recommend no food for a day or two. This is a working
 * ceiling framed as an upper bound, not a goal.
 */
export const FLARE_CEILING_GRAMS = 15

/** Calories per gram of fat. */
const KCAL_PER_FAT_GRAM = 9

export type CalculableMode = Exclude<Mode, 'flare'>

/** Inputs the calculator cannot run without. */
export type MissingInput = 'age' | 'heightCm' | 'weightKg'

/** The arithmetic, step by step, so the "how we got this" panel can show it. */
export interface FatTargetBreakdown {
  /** Which equation ran. "prefer-not-to-say" resolves to female here. */
  equation: 'female' | 'male'
  weightKg: number
  heightCm: number
  age: number
  /** Step 1. Mifflin-St Jeor, unrounded. */
  bmr: number
  activityLevel: ActivityLevel
  activityFactor: number
  /** Step 2. */
  tdee: number
  /** Step 3. */
  fatPercent: number
  /** Step 3 result, before the clamp and before rounding. */
  rawFatGrams: number
  /** Step 4. */
  band: { min: number; max: number }
  wasClamped: boolean
  /** Step 5. Clamped, then rounded to the nearest whole gram. */
  grams: number
}

export type FatTargetResult =
  | {
      /** Mode is flare. Fixed working ceiling, no calculation. */
      source: 'flare-ceiling'
      grams: typeof FLARE_CEILING_GRAMS
      breakdown: null
      missing: null
    }
  | {
      /**
       * A number from her care team. Always takes precedence. The calculator
       * becomes decorative, and the app says so. The breakdown is still carried
       * when the inputs allow it, so the panel can show what the estimate would
       * have been.
       */
      source: 'override'
      grams: number
      breakdown: FatTargetBreakdown | null
      missing: null
    }
  | {
      source: 'calculated'
      grams: number
      breakdown: FatTargetBreakdown
      missing: null
    }
  | {
      /** Not enough inputs yet. Ask for these, do not guess. */
      source: 'incomplete'
      grams: null
      breakdown: null
      missing: MissingInput[]
    }

function isPositiveNumber(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/** Step 1. Mifflin-St Jeor. */
export function basalEnergy(
  equation: 'female' | 'male',
  weightKg: number,
  heightCm: number,
  age: number,
): number {
  const shared = 10 * weightKg + 6.25 * heightCm - 5 * age
  return equation === 'male' ? shared + 5 : shared - 161
}

/**
 * "prefer-not-to-say" defaults to the female equation, per addendum section A.
 * The lower of the two, so the estimate errs toward the more conservative
 * target.
 */
export function equationFor(sex: BiologicalSex): 'female' | 'male' {
  return sex === 'male' ? 'male' : 'female'
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Runs steps 1 to 5 for a mode that actually gets a calculated target. */
export function calculateFatTarget(
  mode: CalculableMode,
  input: {
    age: number
    heightCm: number
    weightKg: number
    activityLevel: ActivityLevel
    biologicalSex: BiologicalSex
  },
): FatTargetBreakdown {
  const equation = equationFor(input.biologicalSex)
  const bmr = basalEnergy(equation, input.weightKg, input.heightCm, input.age)

  const activityFactor = ACTIVITY_FACTORS[input.activityLevel]
  const tdee = bmr * activityFactor

  const fatPercent = FAT_PERCENT[mode]
  const rawFatGrams = (tdee * fatPercent) / KCAL_PER_FAT_GRAM

  const band = CLAMP_BANDS[mode]
  const clamped = clamp(rawFatGrams, band.min, band.max)

  return {
    equation,
    weightKg: input.weightKg,
    heightCm: input.heightCm,
    age: input.age,
    bmr,
    activityLevel: input.activityLevel,
    activityFactor,
    tdee,
    fatPercent,
    rawFatGrams,
    band: { min: band.min, max: band.max },
    wasClamped: clamped !== rawFatGrams,
    // Step 4 clamps, then step 5 rounds. Not the other way around.
    grams: Math.round(clamped),
  }
}

/**
 * The single entry point. Resolves what number to show for the current mode and
 * settings, and where that number came from.
 *
 * Precedence:
 *   1. Flare mode. Fixed 15g ceiling. The manual override is deliberately NOT
 *      used here: an override is a normal-eating daily target from her
 *      dietitian, and surfacing 30 to 50g during a flare would be wrong in the
 *      dangerous direction.
 *   2. Manual override, when set.
 *   3. Calculation, when the inputs are all present.
 *   4. Incomplete.
 */
export function computeFatTarget(settings: Settings): FatTargetResult {
  if (settings.currentMode === 'flare') {
    return {
      source: 'flare-ceiling',
      grams: FLARE_CEILING_GRAMS,
      breakdown: null,
      missing: null,
    }
  }

  const mode: CalculableMode = settings.currentMode

  const missing: MissingInput[] = []
  if (!isPositiveNumber(settings.age)) missing.push('age')
  if (!isPositiveNumber(settings.heightCm)) missing.push('heightCm')
  if (!isPositiveNumber(settings.weightKg)) missing.push('weightKg')

  const breakdown =
    isPositiveNumber(settings.age) &&
    isPositiveNumber(settings.heightCm) &&
    isPositiveNumber(settings.weightKg)
      ? calculateFatTarget(mode, {
          age: settings.age,
          heightCm: settings.heightCm,
          weightKg: settings.weightKg,
          activityLevel: settings.activityLevel,
          biologicalSex: settings.biologicalSex,
        })
      : null

  if (isPositiveNumber(settings.dailyFatTarget)) {
    return {
      source: 'override',
      grams: settings.dailyFatTarget,
      breakdown,
      missing: null,
    }
  }

  if (breakdown === null) {
    return { source: 'incomplete', grams: null, breakdown: null, missing }
  }

  return { source: 'calculated', grams: breakdown.grams, breakdown, missing: null }
}

/** Ninety days in milliseconds. The soft prompt threshold. Never nag. */
export const BODY_STATS_STALE_MS = 90 * 24 * 60 * 60 * 1000

/**
 * True when the body stats have not been touched in 90 days, so the settings
 * screen can ask, once and softly, whether anything has changed.
 */
export function bodyStatsAreStale(
  bodyStatsUpdatedAt: string | null,
  now: number = Date.now(),
): boolean {
  if (bodyStatsUpdatedAt === null) return false
  const then = Date.parse(bodyStatsUpdatedAt)
  if (Number.isNaN(then)) return false
  return now - then > BODY_STATS_STALE_MS
}
