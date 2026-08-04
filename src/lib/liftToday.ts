/**
 * How far she has walked past today's entry with "show me another".
 *
 * Kept out of liftRotation.ts so that module can stay pure, and out of
 * liftFavorites.ts because this is throwaway state and those are things she
 * chose to keep.
 *
 * Persisted rather than held in memory so a reload does not yank her back to
 * the day's first entry after she has tapped past it. Stamped with the day it
 * belongs to, so tomorrow starts at zero without anything needing to clear it.
 */

import * as storage from './storage.ts'
import { isFiniteNumber, isNonEmptyString, isRecord } from './validate.ts'

export const LIFT_TODAY_STORAGE_KEY = 'liftToday'

export interface TodayOffset {
  /** Local date key, "YYYY-MM-DD", from foodLog.ts's dateKey. */
  day: string
  offset: number
}

/**
 * Returns 0 for a stored offset belonging to any day but this one, which is how
 * the offset resets at midnight without a timer.
 */
export function readOffset(day: string): number {
  const raw = storage.get<unknown>(LIFT_TODAY_STORAGE_KEY, null)
  if (!isRecord(raw)) return 0
  if (!isNonEmptyString(raw.day) || raw.day !== day) return 0
  if (!isFiniteNumber(raw.offset) || raw.offset < 0) return 0
  return Math.floor(raw.offset)
}

/** False when the write did not stick. Losing this costs her nothing. */
export function writeOffset(day: string, offset: number): boolean {
  return storage.set(LIFT_TODAY_STORAGE_KEY, { day, offset } satisfies TodayOffset)
}
