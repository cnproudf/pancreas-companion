/**
 * The pure half of the settings store: defaults, and the hydration rules that
 * turn whatever came out of localStorage into a usable Settings object.
 *
 * Kept free of React so the rules can be tested and reused without a renderer.
 */

import type { Settings } from '../types.ts'

export const SETTINGS_STORAGE_KEY = 'settings'

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: 1,
  // No placeholder target here. The spec offers 30g as a conservative default
  // during onboarding, which is an onboarding decision, not a store default.
  // Until she is asked, the calculator answers.
  dailyFatTarget: null,
  age: null,
  heightCm: null,
  weightKg: null,
  activityLevel: 'light',
  biologicalSex: 'prefer-not-to-say',
  takesEnzymes: false,
  careTeamContacts: [],
  currentMode: 'stable',
  bodyStatsUpdatedAt: null,
}

/** Fields whose change restamps bodyStatsUpdatedAt for the 90 day soft prompt. */
export const BODY_STAT_FIELDS = [
  'age',
  'heightCm',
  'weightKg',
  'activityLevel',
  'biologicalSex',
] as const satisfies readonly (keyof Settings)[]

/**
 * Fields that default to null. Their type cannot be inferred from the default,
 * so it is declared here: a stored string must never land in weightKg, and a
 * stored number must never land in bodyStatsUpdatedAt.
 */
const NULLABLE_NUMBER_FIELDS = new Set<keyof Settings>([
  'dailyFatTarget',
  'age',
  'heightCm',
  'weightKg',
])
const NULLABLE_STRING_FIELDS = new Set<keyof Settings>(['bodyStatsUpdatedAt'])

/**
 * Shallow merges whatever came out of storage over the defaults, field by
 * field, so a partial or half corrupted blob degrades one field at a time
 * instead of blanking the app. A value of the wrong type falls back to its
 * default rather than poisoning the store.
 */
export function hydrateSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ...DEFAULT_SETTINGS }
  }

  const source = raw as Record<string, unknown>
  const merged: Settings = { ...DEFAULT_SETTINGS }

  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    if (key === 'schemaVersion') continue

    const value = source[key]
    if (value === undefined) continue

    const expected = DEFAULT_SETTINGS[key]

    // Nullable fields: null is a legitimate stored value only where the default
    // is null. Anywhere else it means the blob is damaged, so keep the default.
    if (value === null) {
      if (expected === null) merged[key] = null as never
      continue
    }

    if (Array.isArray(expected)) {
      if (Array.isArray(value)) merged[key] = value as never
      continue
    }

    if (NULLABLE_NUMBER_FIELDS.has(key)) {
      if (typeof value === 'number' && Number.isFinite(value)) merged[key] = value as never
      continue
    }

    if (NULLABLE_STRING_FIELDS.has(key)) {
      if (typeof value === 'string' && value !== '') merged[key] = value as never
      continue
    }

    if (typeof value === typeof expected) merged[key] = value as never
  }

  return merged
}
