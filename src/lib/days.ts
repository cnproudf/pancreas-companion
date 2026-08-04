/**
 * Local calendar days, as "YYYY-MM-DD" keys.
 *
 * dateKey lived in foodLog.ts until Phase 7. It moved here when the symptom log
 * needed the same day boundary and the pattern view needed something foodLog.ts
 * had no business owning: calendarSpan, which enumerates EVERY day in a range
 * including the ones with nothing in them.
 *
 * That function is where gaps come from. Invariant 5 says unlogged days render
 * as gaps, never as zeros, and the only way to render a gap is to know the day
 * exists. Deriving the axis from the keys present in a log would make an
 * unlogged day literally unrepresentable, which sounds safe and is the exact
 * bug: the day would vanish from the chart instead of showing as absent.
 *
 * Pure module. No React, no storage.
 */

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

/** Keys are local date strings. Anything else is not a day. */
export const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * A key back to local midnight on that day. Null when the string is not a day.
 *
 * Constructed through the Date(y, m, d) form rather than Date.parse, because
 * Date.parse("2026-08-04") is specified as UTC midnight while
 * Date.parse("2026-08-04T00:00") is local. Going through the parts avoids
 * depending on which of those the caller happened to write, and keeps this
 * agreeing with dateKey by construction.
 */
export function parseDateKey(key: string): Date | null {
  if (!DATE_KEY_PATTERN.test(key)) return null

  const year = Number(key.slice(0, 4))
  const month = Number(key.slice(5, 7))
  const day = Number(key.slice(8, 10))

  const when = new Date(year, month - 1, day)
  // Rejects 2026-02-30, which the pattern allows and the Date constructor
  // silently rolls forward into March.
  if (when.getFullYear() !== year) return null
  if (when.getMonth() !== month - 1) return null
  if (when.getDate() !== day) return null

  return when
}

/**
 * A day key shifted by whole days. Null when the key is not a day.
 *
 * Goes through the Date constructor rather than adding 86400000 milliseconds,
 * so a span that crosses a daylight saving boundary still lands on the next
 * calendar day rather than 23 or 25 hours later.
 */
export function addDays(key: string, days: number): string | null {
  const when = parseDateKey(key)
  if (when === null) return null

  when.setDate(when.getDate() + days)
  return dateKey(when)
}

/**
 * Every calendar day from `fromKey` to `toKey`, inclusive, in order.
 *
 * THIS IS THE SOURCE OF GAPS. The pattern view's x-axis is built from this and
 * never from the keys present in a log, so a day she did not log is still a
 * column on the chart and can be drawn as absent. See the note at the top.
 *
 * Returns an empty array when either key is malformed or the range runs
 * backwards, rather than throwing or looping forever.
 */
export function calendarSpan(fromKey: string, toKey: string): string[] {
  const from = parseDateKey(fromKey)
  const to = parseDateKey(toKey)
  if (from === null || to === null) return []
  if (from.getTime() > to.getTime()) return []

  const days: string[] = []
  const cursor = new Date(from.getTime())

  while (cursor.getTime() <= to.getTime()) {
    days.push(dateKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

/**
 * The window ending today and running back `days` calendar days, inclusive of
 * today. windowSpan(30) is 30 columns, not 31.
 */
export function windowSpan(days: number, endKey: string = dateKey()): string[] {
  if (!Number.isInteger(days) || days < 1) return []

  const startKey = addDays(endKey, -(days - 1))
  if (startKey === null) return []

  return calendarSpan(startKey, endKey)
}

/** For display. "Aug 4" style, in her locale. Empty string for a bad key. */
export function formatDayShort(key: string): string {
  const when = parseDateKey(key)
  if (when === null) return ''
  return when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** For prose. "August 4" style, in her locale. Empty string for a bad key. */
export function formatDayLong(key: string): string {
  const when = parseDateKey(key)
  if (when === null) return ''
  return when.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
}
