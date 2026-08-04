/**
 * The hydration tracker. Spec section 5.8, in full:
 *
 *   "A row of eight glass icons she taps. Dehydration is a commonly cited
 *   symptom aggravator and this takes four hours of build time. Skip anything
 *   fancier."
 *
 * SKIP ANYTHING FANCIER IS AN INSTRUCTION, NOT A DESCRIPTION.
 *
 * There is no history here, no weekly average, no goal, no reminder, and no
 * streak. Not because they would be hard, but because addendum section B
 * removed the daily prompt and the streak counter from the symptom log for a
 * reason that applies here word for word: those mechanics turn a health tool
 * into an obligation, and an obligation is the last thing she needs. A glass of
 * water she did not log is not a failure, and nothing in this module is capable
 * of describing it as one.
 *
 * Invariant 3: localStorage only, through storage.ts. Nothing here throws. A
 * corrupted blob costs her one day's count, never the row.
 */

import { DATE_KEY_PATTERN, dateKey } from './days.ts'
import * as storage from './storage.ts'
import { isRecord } from './validate.ts'

export const HYDRATION_STORAGE_KEY = 'hydration'

/** Eight glasses, spec 5.8. */
export const GLASS_TARGET = 8

/** Local date key, "YYYY-MM-DD", to the number of glasses logged that day. */
export type HydrationLog = Record<string, number>

/**
 * All copy in one place, the way SYMPTOM_COPY and BAR_COPY do it.
 *
 * Invariant 8's reasoning applies to the row of glasses: filled icons alone
 * carry the state in colour and shape only, so the count is always also written
 * out in words. `readout` is that line.
 *
 * There is deliberately no "3 to go" and no "you did it". The first is a
 * demand and the second is a reward, and a row of glasses needs neither.
 */
export const HYDRATION_COPY = {
  title: 'Water today',
  /** {count} of {target}. */
  readout: '{count} of {target} glasses',
  /** The accessible name of glass N. Tapping it sets the count to N. */
  glassLabel: 'Set today to {n} of {target} glasses',
  /** Tapping the glass that is already the count clears back to none. */
  clearLabel: 'Clear today back to no glasses',
  note: 'Tap a glass to set where you are. Tap the last filled one to clear it.',
} as const

function hydrateCount(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null

  const whole = Math.floor(raw)
  if (whole <= 0) return null
  return Math.min(whole, GLASS_TARGET)
}

/**
 * Turns whatever came out of storage into a usable log, dropping only the days
 * that are actually damaged. Mirrors hydrateLog in foodLog.ts.
 *
 * A day at zero is dropped rather than stored, so the log holds only days she
 * actually tapped something on. Same shape as the food log, where an emptied
 * day is deleted outright: a write then read round trip must not change the
 * shape of the log.
 */
export function hydrateHydration(raw: unknown): HydrationLog {
  if (!isRecord(raw)) return {}

  const log: HydrationLog = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!DATE_KEY_PATTERN.test(key)) continue

    const count = hydrateCount(value)
    if (count !== null) log[key] = count
  }
  return log
}

export function readHydration(): HydrationLog {
  return hydrateHydration(storage.get<unknown>(HYDRATION_STORAGE_KEY, null))
}

/** False when the write did not stick. The caller decides whether to say so. */
export function writeHydration(log: HydrationLog): boolean {
  return storage.set(HYDRATION_STORAGE_KEY, log)
}

export function glassesOn(log: HydrationLog, key: string = dateKey()): number {
  return log[key] ?? 0
}

/**
 * Pure. Sets a day's count, clamped to 0 through GLASS_TARGET.
 *
 * A day set to zero is removed from the log rather than stored as 0, so
 * hydrateHydration's output and this function's output agree.
 */
export function setGlasses(
  log: HydrationLog,
  count: number,
  key: string = dateKey(),
): HydrationLog {
  if (!DATE_KEY_PATTERN.test(key)) return log

  const clamped = Math.min(Math.max(Math.floor(count), 0), GLASS_TARGET)

  if (clamped === 0) {
    if (log[key] === undefined) return log
    const { [key]: _cleared, ...rest } = log
    return rest
  }

  if (log[key] === clamped) return log
  return { ...log, [key]: clamped }
}

/**
 * What tapping glass N does.
 *
 * Tapping a glass sets the count to N, EXCEPT when N is already the count, in
 * which case it clears back to zero. That exception is what makes the row
 * correctable with one thumb: without it there would be no way back from one
 * glass to none, and the only fix for a mistap would be a separate reset
 * control that the row does not need.
 */
export function tapGlass(log: HydrationLog, n: number, key: string = dateKey()): HydrationLog {
  return setGlasses(log, glassesOn(log, key) === n ? 0 : n, key)
}

export function hydrationReadout(count: number): string {
  return HYDRATION_COPY.readout
    .replace('{count}', String(count))
    .replace('{target}', String(GLASS_TARGET))
}
