/**
 * Today's food log. What she ate, when, and what it cost against her budget.
 *
 * Pure data layer. The visible budget bar is Phase 4; this exists now because
 * the food checker's "log this" button and its budget line both need somewhere
 * to write to and read from.
 *
 * Invariant 3: everything lives in localStorage, through storage.ts, which is
 * the only module allowed to touch it. Nothing here throws. A corrupted blob
 * should cost her one entry, never the screen.
 */

import type { Food } from '../types.ts'
import * as storage from './storage.ts'
import { isFiniteNumber, isNonEmptyString, isRecord } from './validate.ts'

export const FOOD_LOG_STORAGE_KEY = 'foodLog'

export interface FoodLogEntry {
  id: string
  /** Null when the entry did not come from the dataset. Reserved for Phase 11. */
  foodId: string | null

  /*
   * These three are copied in deliberately. They are NOT looked up from foodId
   * at read time, and this is not redundancy waiting to be normalized away.
   *
   * data/foods.json is hand-authored, and its fat values are estimates that
   * will be corrected over time. This log is a record of what she ate and what
   * it cost when she ate it. Resolving through foodId would silently rewrite
   * her history every time the dataset changed, which would corrupt the pattern
   * view (Phase 7) and the appointment prep export (Phase 10). Those are the
   * two places where this log is meant to be evidence for her doctor, so it has
   * to say what was true at the time.
   */
  name: string
  servingDescription: string
  fatGrams: number

  /** ISO timestamp. The day it belongs to is the key it is filed under. */
  loggedAt: string
}

/** Local date key, "YYYY-MM-DD", to the entries logged that day. */
export type FoodLog = Record<string, FoodLogEntry[]>

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * The local calendar day, "YYYY-MM-DD".
 *
 * Built from the local date parts on purpose. toISOString() would be UTC, which
 * rolls the day over at the wrong hour for everyone not on UTC and would move
 * an 8pm dinner into tomorrow's budget. Spec section 5.4 wants midnight local.
 */
export function dateKey(when: Date = new Date()): string {
  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`
}

let entryCounter = 0

/**
 * crypto.randomUUID is unavailable on http origins in some browsers, and this
 * app is meant to keep working in awkward places, so there is a fallback.
 */
function entryId(when: Date): string {
  const uuid = globalThis.crypto?.randomUUID
  if (typeof uuid === 'function') return globalThis.crypto.randomUUID()
  entryCounter += 1
  return `${when.getTime()}-${entryCounter}`
}

export function makeEntry(food: Food, when: Date = new Date()): FoodLogEntry {
  return {
    id: entryId(when),
    foodId: food.id,
    name: food.name,
    servingDescription: food.servingDescription,
    fatGrams: food.fatGrams,
    loggedAt: when.toISOString(),
  }
}

function hydrateEntry(raw: unknown): FoodLogEntry | null {
  if (!isRecord(raw)) return null
  if (!isNonEmptyString(raw.id)) return null
  if (!isNonEmptyString(raw.name)) return null
  if (!isNonEmptyString(raw.loggedAt)) return null
  // A negative gram value would quietly refund her budget, so reject it.
  if (!isFiniteNumber(raw.fatGrams) || raw.fatGrams < 0) return null

  return {
    id: raw.id,
    foodId: isNonEmptyString(raw.foodId) ? raw.foodId : null,
    name: raw.name,
    servingDescription: isNonEmptyString(raw.servingDescription) ? raw.servingDescription : '',
    fatGrams: raw.fatGrams,
    loggedAt: raw.loggedAt,
  }
}

/** Keys are local date strings. Anything else is not a day and is dropped. */
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * Turns whatever came out of storage into a usable log, dropping only the parts
 * that are actually damaged. Mirrors hydrateSettings: a half corrupted blob
 * degrades one entry at a time instead of blanking her history.
 */
export function hydrateLog(raw: unknown): FoodLog {
  if (!isRecord(raw)) return {}

  const log: FoodLog = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!DATE_KEY_PATTERN.test(key)) continue
    if (!Array.isArray(value)) continue

    const entries = value.map(hydrateEntry).filter((entry): entry is FoodLogEntry => entry !== null)
    if (entries.length > 0) log[key] = entries
  }
  return log
}

export function readLog(): FoodLog {
  return hydrateLog(storage.get<unknown>(FOOD_LOG_STORAGE_KEY, null))
}

/** False when the write did not stick. The caller decides whether to say so. */
export function writeLog(log: FoodLog): boolean {
  return storage.set(FOOD_LOG_STORAGE_KEY, log)
}

/** Pure. Returns a new log rather than mutating the one passed in. */
export function appendEntry(
  log: FoodLog,
  entry: FoodLogEntry,
  key: string = dateKey(new Date(entry.loggedAt)),
): FoodLog {
  return { ...log, [key]: [...(log[key] ?? []), entry] }
}

export function entriesFor(log: FoodLog, key: string): FoodLogEntry[] {
  return log[key] ?? []
}

export function sumFat(entries: readonly FoodLogEntry[]): number {
  const total = entries.reduce((running, entry) => running + entry.fatGrams, 0)
  // Floating point addition of one-decimal gram values drifts (3.5 + 16 + 0.1),
  // and this number is rendered. One decimal is already more precision than an
  // estimate deserves.
  return Math.round(total * 10) / 10
}
