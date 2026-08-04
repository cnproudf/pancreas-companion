/**
 * Which lift she sees today.
 *
 * dailyLift.ts loads and validates the 365 entries and the friend notes. This
 * module is the part that chooses. Pure, no storage, no React, so the rotation
 * rules can be tested against a thousand simulated days without a browser.
 *
 * Two properties matter more than anything else here:
 *
 * 1. Deterministic per day. Refreshing must not reshuffle. She may open the app
 *    six times before breakfast and it has to be the same thing each time,
 *    because the alternative is a slot machine, and a slot machine is the
 *    opposite of what this feature is for.
 * 2. Never empty. Every path that could fail to produce an item falls back to
 *    the general rotation rather than rendering nothing.
 */

import { FRIEND_NOTES, LIFT_ENTRIES, type LiftItem } from './dailyLift.ts'
import type { LiftEntry, Mode } from '../types.ts'

const MS_PER_DAY = 86_400_000
const WEEK = 7

/**
 * Which days of the week carry a friend note. Two residues means exactly two in
 * every rolling seven days, which is the "roughly twice a week" the spec asks
 * for, except it is exact and it never reshuffles.
 *
 * Epoch day 0 was a Thursday, so residue 2 is Saturday and residue 5 is
 * Tuesday. Three days apart one way and four the other, which is about as
 * evenly spread as two days in a week get.
 */
export const FRIEND_RESIDUES: readonly number[] = [2, 5]

/** Always non-negative, unlike the % operator on a negative left side. */
function mod(value: number, size: number): number {
  return ((value % size) + size) % size
}

/**
 * Days since the epoch, counted in LOCAL calendar days.
 *
 * The local y/m/d are fed through Date.UTC purely to get an integer that
 * increments at local midnight. Using the timestamp directly would roll the day
 * over at the wrong hour for everyone not on UTC, and this has to agree with
 * foodLog.ts's dateKey() about when a day starts.
 *
 * A monotonic day count rather than a calendar day-of-year, on purpose. Day 366
 * of a leap year would replay January 1st, and day-of-year makes year two an
 * exact rerun of year one. Nothing in the data is tied to a calendar date, so
 * there is nothing to lose by counting straight through.
 */
export function dayNumber(when: Date = new Date()): number {
  return Math.floor(Date.UTC(when.getFullYear(), when.getMonth(), when.getDate()) / MS_PER_DAY)
}

export function isFriendDay(day: number): boolean {
  return FRIEND_RESIDUES.includes(mod(day, WEEK))
}

/**
 * How many friend days have already passed before this one. Doubles as the slot
 * index of a friend day itself, which is what cycles the notes in order as more
 * are added.
 */
export function friendSlotsBefore(day: number): number {
  const weeks = Math.floor(day / WEEK)
  const within = mod(day, WEEK)
  return weeks * FRIEND_RESIDUES.length + FRIEND_RESIDUES.filter((r) => r < within).length
}

/**
 * The general rotation is indexed by the count of NON-friend days elapsed, not
 * by the raw day number.
 *
 * Indexing by the day number would skip roughly two entries every week, so a
 * chunk of the 365 would never be seen. Counting only the days the general
 * rotation actually consumes walks the whole list in order before repeating
 * anything, which takes about seventeen months of calendar time.
 */
export function generalIndexFor(day: number): number {
  return day - friendSlotsBefore(day)
}

/**
 * Entries withheld in flare mode.
 *
 * The Daily Lift renders outside FlareGate because it carries no food content.
 * That is true of 363 of the 365 entries. Two are food instructions: lift-091
 * ("put a snack in your bag") and lift-273 ("eat something you like today,
 * within budget"). On a flare day, above the triage screen, when her doctor may
 * have said no food for a day or two, that is exactly the ordering invariant 1
 * exists to prevent.
 *
 * The predicate is type plus food word rather than a hand-listed pair of ids,
 * so an entry added in Phase 12 cannot slip through. tiny-win is the only
 * imperative type in the data, which is what separates "eat something you like
 * today" from lift-133's "it is fine if the only thing you accomplished today
 * was eating something that did not hurt". The latter is a reflection, not an
 * instruction, and it is one of the kinder entries in the file.
 *
 * "drink" is deliberately absent from the word list. lift-005 asks her to drink
 * a glass of water, and clear liquids are the one thing NPF does describe for a
 * flare, so withholding it would be wrong.
 *
 * liftRotation.test.ts asserts this matches exactly lift-091 and lift-273
 * today, so a change in either direction is loud.
 */
const FOOD_WORD = /\b(eat|eats|eating|ate|snack|snacks|food|foods|meal|meals)\b/i

export function instructsEating(entry: LiftEntry): boolean {
  return entry.type === 'tiny-win' && FOOD_WORD.test(entry.content)
}

const FLARE_ENTRIES: readonly LiftEntry[] = LIFT_ENTRIES.filter((e) => !instructsEating(e))

export function poolFor(mode: Mode): readonly LiftEntry[] {
  return mode === 'flare' ? FLARE_ENTRIES : LIFT_ENTRIES
}

/**
 * The day's item, or the offset-th one after it once she taps "show me
 * another".
 *
 * Returns null only if the general pool is somehow empty, which the data makes
 * impossible. The card renders nothing at all in that case rather than an error
 * state.
 */
export function pickLift(day: number, offset = 0, mode: Mode = 'stable'): LiftItem | null {
  const pool = poolFor(mode)

  // A day only spends its friend slot if there is actually a note to show. With
  // an empty friends-notes.json every day is a general day, silently.
  const hasNotes = FRIEND_NOTES.length > 0
  const hasFriendSlot = hasNotes && isFriendDay(day)

  if (hasFriendSlot && offset === 0) {
    const note = FRIEND_NOTES[mod(friendSlotsBefore(day), FRIEND_NOTES.length)]
    if (note !== undefined) return { kind: 'friend-note', note }
  }

  if (pool.length === 0) return null

  /*
   * The general index discounts friend days only when friend days are actually
   * being spent. With no notes in the file, discounting them anyway would leave
   * the index stalled on those days and serve the same entry twice in a row,
   * which is the one thing a rotation is for.
   */
  const base = hasNotes ? generalIndexFor(day) : day

  /*
   * On a friend day her first tap of "show me another" should land on the
   * general entry the day would otherwise have carried, not one past it.
   * Without this the friend slot would swallow an entry every time.
   */
  const step = hasFriendSlot ? offset - 1 : offset
  const entry = pool[mod(base + step, pool.length)]

  return entry === undefined ? null : { kind: 'lift', entry }
}

/** A stable identity for an item, for favorites and for React keys. */
export function liftItemId(item: LiftItem): string {
  return item.kind === 'friend-note' ? item.note.id : item.entry.id
}

export function liftItemContent(item: LiftItem): string {
  return item.kind === 'friend-note' ? item.note.content : item.entry.content
}

/**
 * Every user-facing string in the Daily Lift, in one place, so the copy suite
 * can hold it to invariants 9 and 10. Same shape as BAR_COPY and MEAL_COPY.
 */
export const LIFT_COPY = {
  /** Names the region for screen readers. Not rendered visually. */
  regionLabel: 'Today',
  another: 'Show me another',
  save: 'Save',
  saved: 'Saved',
  saveLabel: 'Save this to your saved lifts',
  savedLabel: 'Saved. Choose this again to remove it.',
  /** Precedes the friend's first name. "from Chad". */
  friendPrefix: 'from',
  showFavorites: 'Saved lifts',
  hideFavorites: 'Hide saved lifts',
  removeFavorite: 'Remove',
  removeFavoriteLabel: 'Remove this from your saved lifts',
  notPersisted:
    'This device is not letting the app save right now, so your saved lifts may not be here next time.',
} as const
