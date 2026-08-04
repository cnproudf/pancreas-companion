/**
 * How many times she has eaten today, and the nudge toward NPF's 4 to 6 small
 * meals. Spec section 5.4, addendum section A.
 *
 * NPF's guidance is that daily fat should be spread across 4 to 6 small meals
 * rather than concentrated in one, and that is the part of it most people skip.
 * It matters as much as the daily total, which is why it sits on the bar rather
 * than buried in the target screen.
 *
 * Pure module. No React, no storage.
 */

import type { FoodLogEntry } from './foodLog.ts'

/**
 * Entries closer together than this are one meal.
 *
 * An entry is one food, so a plate of chicken, rice, and green beans is three
 * of them. Counting entries would report that dinner as 3 meals and tell her
 * she is already spreading things out when she has eaten once. An hour is long
 * enough to hold a slow meal together and short enough to separate lunch from
 * an afternoon snack.
 */
export const MEAL_GAP_MINUTES = 60

/**
 * All nudge copy in one place, the way RATING_COPY and BUDGET_COPY do it.
 *
 * Invariant 10 is the whole design of this list. There is no band that scolds
 * and, just as important, no band that goes quiet. Every count above zero gets
 * the same shape: the number, then a neutral reason. Saying nothing at 7 would
 * read as disapproval by omission, and grazing across 8 small meals is arguably
 * closer to what NPF recommends than 3 large ones.
 *
 * This is information she can act on, not a target she can miss.
 */
export const MEAL_COPY = {
  none: 'Nothing logged yet today.',
  under: 'That is {count} so far. Smaller meals spread out are easier on your system.',
  inRange: 'That is {count} so far, spread through the day. That is the easy pattern.',
  above: 'That is {count} so far, spread out. Easy on your system.',
} as const

/** The band NPF publishes. Not a goal she is scored against. */
export const MEAL_RANGE = { min: 4, max: 6 } as const

/**
 * Meals so far, clustering entries logged within `gapMinutes` of each other.
 *
 * Sorts first rather than trusting the order in storage. Entries are appended
 * in order, but an undone removal is re-appended at the end and a Phase 7
 * backfill could land anywhere, so the order in the array is not the order in
 * the day. An unparseable timestamp is skipped rather than thrown on: one
 * damaged entry should cost her a count, never the screen.
 */
export function countMeals(
  entries: readonly FoodLogEntry[],
  gapMinutes: number = MEAL_GAP_MINUTES,
): number {
  const times = entries
    .map((entry) => Date.parse(entry.loggedAt))
    .filter((time) => !Number.isNaN(time))
    .sort((a, b) => a - b)

  if (times.length === 0) return 0

  const gapMs = gapMinutes * 60 * 1000
  let meals = 1
  let previous = times[0] as number

  for (const time of times.slice(1)) {
    if (time - previous > gapMs) meals += 1
    previous = time
  }
  return meals
}

export function mealNudgeText(count: number): string {
  if (count <= 0) return MEAL_COPY.none

  const template =
    count < MEAL_RANGE.min
      ? MEAL_COPY.under
      : count <= MEAL_RANGE.max
        ? MEAL_COPY.inRange
        : MEAL_COPY.above

  return template.replace('{count}', String(count))
}
