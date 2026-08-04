/**
 * Shared domain types. Kept in one place because the fat calculator, the
 * settings store, and (from Phase 2) the rating engine all key off the same
 * mode and activity vocabularies.
 */

/** Mode selector, spec section 4. Persisted, changeable in two taps. */
export type Mode = 'stable' | 'recovering' | 'flare'

export const MODES: readonly Mode[] = ['stable', 'recovering', 'flare'] as const

/** Addendum section A: mostly resting / light activity / moderately active. */
export type ActivityLevel = 'resting' | 'light' | 'moderate'

/**
 * Used only for the energy equation. "prefer-not-to-say" defaults to the female
 * equation, per addendum section A.
 */
export type BiologicalSex = 'female' | 'male' | 'prefer-not-to-say'

export interface CareTeamContact {
  id: string
  role: 'doctor' | 'dietitian' | 'hospital' | 'other'
  name: string
  phone: string
  notes: string
}

export interface Settings {
  /** Bumped when the persisted shape changes in a way that needs migrating. */
  schemaVersion: 1

  /**
   * Manual override. When set, this always takes precedence over the
   * calculation and is the authoritative value (addendum section A).
   * null means "use the calculator".
   */
  dailyFatTarget: number | null

  age: number | null
  /** Stored in cm only. Feet and inches entry is a display-layer conversion. */
  heightCm: number | null
  /** Stored in kg only. Pounds entry is a display-layer conversion. */
  weightKg: number | null
  activityLevel: ActivityLevel
  biologicalSex: BiologicalSex

  takesEnzymes: boolean
  careTeamContacts: CareTeamContact[]

  currentMode: Mode

  /**
   * ISO timestamp of the last change to the body stats that feed the
   * calculator. Drives the 90 day soft prompt. Never nag.
   */
  bodyStatsUpdatedAt: string | null
}
