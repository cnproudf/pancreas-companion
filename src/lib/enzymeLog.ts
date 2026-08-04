/**
 * The enzyme log. Spec section 5.7, conditional on her taking PERT:
 *
 *   "Only appears if she toggles 'I take pancreatic enzymes' in settings. If
 *   she is on PERT, timing with meals matters and it is easy to forget
 *   mid-meal. Simple log: which meal, taken or not."
 *
 * A SLOT SHE HAS NOT TOUCHED IS UNRECORDED, NOT "DID NOT TAKE". THIS IS THE
 * WHOLE DESIGN OF THIS MODULE.
 *
 * The spec says "taken or not", which reads as a boolean and is not one. A
 * boolean has to pick a default, and both defaults lie: defaulting to taken
 * invents doses she never had, and defaulting to not-taken turns every meal she
 * simply did not log into a missed dose staring back at her.
 *
 * This is invariant 5's reasoning applied to a different log. Unlogged days
 * render as gaps in the pattern chart, never as zeros, never as symptom-free
 * days, because a day she did not log is UNKNOWN rather than well. A meal slot
 * she did not tap is unknown in exactly the same way, and for the same reason
 * it must never be drawn as the negative case. She may show this to her
 * gastroenterologist, and "I did not record it" and "I did not take it" are
 * different facts about her care.
 *
 * So the states are: absent, 'taken', 'not-taken'. Absent is the default and
 * has no icon, no colour, and no count.
 *
 * NO REMINDER NOTIFICATIONS, deliberately. Spec 5.7 offers them as optional and
 * they are declined: a scheduled notification is a nag, and addendum section B
 * removed the daily prompt and the streak counter from the symptom log because
 * those mechanics turn a health tool into an obligation. The same reasoning
 * ends in the same place here.
 *
 * Invariant 3: localStorage only, through storage.ts. Nothing here throws.
 */

import { DATE_KEY_PATTERN, dateKey } from './days.ts'
import * as storage from './storage.ts'
import { isRecord } from './validate.ts'

export const ENZYME_LOG_STORAGE_KEY = 'enzymeLog'

/**
 * Four slots rather than three.
 *
 * "Other" carries the 4 to 6 small meals pattern the app pushes everywhere
 * else: spec 5.4 nudges toward small frequent meals rather than three large
 * ones, so a log with exactly three slots would quietly contradict the rest of
 * the app. It is one slot rather than three more because this is a memory aid,
 * not a diary, and four controls fit one row on a phone.
 */
export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'other'] as const

export type MealSlot = (typeof MEAL_SLOTS)[number]

/** What she recorded for a slot. Absent means she did not record anything. */
export type EnzymeState = 'taken' | 'not-taken'

export const ENZYME_STATES: readonly EnzymeState[] = ['taken', 'not-taken'] as const

/** One day's slots. A slot with no entry is unrecorded. */
export type EnzymeDay = Partial<Record<MealSlot, EnzymeState>>

/** Local date key, "YYYY-MM-DD", to that day's slots. */
export type EnzymeLog = Record<string, EnzymeDay>

export const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  other: 'Other',
}

/**
 * All copy in one place, the way SYMPTOM_COPY and BAR_COPY do it.
 *
 * "Not this one" rather than "missed". Invariant 10 says never scold, and
 * "missed" addresses her conduct rather than the fact; it is already banned by
 * CALENDAR_RATE_PATTERN for the same reason. A dose she chose not to take and a
 * dose she forgot are both "not this one" as far as this log is concerned, and
 * the log has no business telling them apart.
 */
export const ENZYME_COPY = {
  title: 'Enzymes',
  intro: 'Tap a meal to record it. Tap it again to clear it.',
  taken: 'Took them',
  notTaken: 'Not this one',
  /** For the state a slot is in when she has not tapped it. */
  unrecorded: 'Not recorded',
  /** {slot} and {state} are filled in by the component. */
  slotStatus: '{slot}: {state}',
  toggleLabel: 'I take pancreatic enzymes',
  toggleHint:
    'Turn this on and a place to record them appears here. Your care team decides whether you need them.',
} as const

function hydrateState(raw: unknown): EnzymeState | null {
  return raw === 'taken' || raw === 'not-taken' ? raw : null
}

function hydrateDay(raw: unknown): EnzymeDay | null {
  if (!isRecord(raw)) return null

  const day: EnzymeDay = {}
  for (const slot of MEAL_SLOTS) {
    const state = hydrateState(raw[slot])
    if (state !== null) day[slot] = state
  }

  // A day with nothing recorded is dropped, so a write then read round trip
  // does not change the shape of the log. Same rule as foodLog and hydration.
  return Object.keys(day).length === 0 ? null : day
}

/** Degrades one slot at a time rather than blanking her history. */
export function hydrateEnzymeLog(raw: unknown): EnzymeLog {
  if (!isRecord(raw)) return {}

  const log: EnzymeLog = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!DATE_KEY_PATTERN.test(key)) continue

    const day = hydrateDay(value)
    if (day !== null) log[key] = day
  }
  return log
}

export function readEnzymeLog(): EnzymeLog {
  return hydrateEnzymeLog(storage.get<unknown>(ENZYME_LOG_STORAGE_KEY, null))
}

/** False when the write did not stick. The caller decides whether to say so. */
export function writeEnzymeLog(log: EnzymeLog): boolean {
  return storage.set(ENZYME_LOG_STORAGE_KEY, log)
}

export function dayFor(log: EnzymeLog, key: string = dateKey()): EnzymeDay {
  return log[key] ?? {}
}

/**
 * What she recorded for one slot, or null when she recorded nothing.
 *
 * NULL IS NOT 'not-taken'. Callers that collapse the two are the bug this
 * module exists to prevent. See the header.
 */
export function stateFor(
  log: EnzymeLog,
  slot: MealSlot,
  key: string = dateKey(),
): EnzymeState | null {
  return dayFor(log, key)[slot] ?? null
}

/**
 * Pure. Records a state for a slot, or clears it when `state` is null.
 *
 * An emptied day is deleted outright rather than left as an empty object, for
 * the same reason foodLog deletes an emptied day: hydrateEnzymeLog drops it on
 * the way back in, so leaving one here would mean a round trip changed the
 * shape of the log.
 */
export function setSlot(
  log: EnzymeLog,
  slot: MealSlot,
  state: EnzymeState | null,
  key: string = dateKey(),
): EnzymeLog {
  if (!DATE_KEY_PATTERN.test(key)) return log

  const day = { ...dayFor(log, key) }

  if (state === null) {
    if (day[slot] === undefined) return log
    delete day[slot]
  } else {
    if (day[slot] === state) return log
    day[slot] = state
  }

  if (Object.keys(day).length === 0) {
    const { [key]: _emptied, ...rest } = log
    return rest
  }
  return { ...log, [key]: day }
}

/**
 * What tapping a slot's state button does.
 *
 * Tapping the state a slot is already in clears it back to unrecorded, so a
 * mistap is correctable with one thumb and there is a route back to "I did not
 * record this". Without it, tapping "Not this one" by accident would leave a
 * permanent claim she never meant to make.
 */
export function toggleSlot(
  log: EnzymeLog,
  slot: MealSlot,
  state: EnzymeState,
  key: string = dateKey(),
): EnzymeLog {
  return setSlot(log, slot, stateFor(log, slot, key) === state ? null : state, key)
}

/** The word for a slot's state, including the unrecorded case. */
export function stateLabel(state: EnzymeState | null): string {
  if (state === 'taken') return ENZYME_COPY.taken
  if (state === 'not-taken') return ENZYME_COPY.notTaken
  return ENZYME_COPY.unrecorded
}

/** "Breakfast: took them". For the screen reader summary line. */
export function slotStatusText(slot: MealSlot, state: EnzymeState | null): string {
  return ENZYME_COPY.slotStatus
    .replace('{slot}', SLOT_LABELS[slot])
    .replace('{state}', stateLabel(state).toLowerCase())
}
