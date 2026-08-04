import { describe, expect, it } from 'vitest'
import {
  addDays,
  calendarSpan,
  dateKey,
  formatDayLong,
  formatDayShort,
  parseDateKey,
  windowSpan,
} from './days.ts'

describe('dateKey', () => {
  it('uses local date parts, not UTC', () => {
    // 23:30 local on the 3rd. toISOString would push this to the 4th for anyone
    // west of UTC, moving a late dinner into tomorrow's budget.
    const late = new Date(2026, 7, 3, 23, 30, 0)
    expect(dateKey(late)).toBe('2026-08-03')
  })

  it('does not roll over just before midnight, and does just after', () => {
    expect(dateKey(new Date(2026, 7, 3, 23, 59, 59))).toBe('2026-08-03')
    expect(dateKey(new Date(2026, 7, 4, 0, 0, 1))).toBe('2026-08-04')
  })

  it('pads single digit months and days', () => {
    expect(dateKey(new Date(2026, 0, 9, 12, 0, 0))).toBe('2026-01-09')
  })
})

describe('parseDateKey', () => {
  it('round trips with dateKey', () => {
    const when = parseDateKey('2026-08-04')
    expect(when).not.toBeNull()
    expect(dateKey(when as Date)).toBe('2026-08-04')
  })

  it('lands on local midnight, not UTC midnight', () => {
    // Date.parse('2026-08-04') is specified as UTC, which would be the previous
    // evening anywhere west of UTC and would shift every column on the chart.
    const when = parseDateKey('2026-08-04') as Date
    expect(when.getHours()).toBe(0)
    expect(when.getDate()).toBe(4)
    expect(when.getMonth()).toBe(7)
  })

  it('rejects anything that is not a day key', () => {
    expect(parseDateKey('')).toBeNull()
    expect(parseDateKey('2026-8-4')).toBeNull()
    expect(parseDateKey('not a day')).toBeNull()
    expect(parseDateKey('2026-08-04T10:00:00Z')).toBeNull()
  })

  it('rejects a date that does not exist rather than rolling it forward', () => {
    // new Date(2026, 1, 30) silently becomes March 2nd.
    expect(parseDateKey('2026-02-30')).toBeNull()
    expect(parseDateKey('2026-13-01')).toBeNull()
  })

  it('accepts a real leap day and rejects a fake one', () => {
    expect(parseDateKey('2024-02-29')).not.toBeNull()
    expect(parseDateKey('2026-02-29')).toBeNull()
  })
})

describe('addDays', () => {
  it('moves forward and back', () => {
    expect(addDays('2026-08-04', 1)).toBe('2026-08-05')
    expect(addDays('2026-08-04', -1)).toBe('2026-08-03')
    expect(addDays('2026-08-04', 0)).toBe('2026-08-04')
  })

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('crosses a leap day', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('returns null for a key that is not a day', () => {
    expect(addDays('nope', 1)).toBeNull()
  })
})

describe('calendarSpan', () => {
  /*
   * This is the function invariant 5 rests on. The pattern view's x-axis comes
   * from here and never from the keys present in a log, so a day she did not
   * log still exists as a column and can be drawn as absent.
   */
  it('includes both ends', () => {
    expect(calendarSpan('2026-08-01', '2026-08-04')).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
      '2026-08-04',
    ])
  })

  it('returns a single day when both ends are the same', () => {
    expect(calendarSpan('2026-08-04', '2026-08-04')).toEqual(['2026-08-04'])
  })

  it('emits every day in between, including ones nothing was logged on', () => {
    // The whole point. A 30 day span is 30 entries whether or not she logged.
    expect(calendarSpan('2026-07-06', '2026-08-04')).toHaveLength(30)
  })

  it('crosses a month boundary without skipping or repeating a day', () => {
    const span = calendarSpan('2026-08-30', '2026-09-02')
    expect(span).toEqual(['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02'])
    expect(new Set(span).size).toBe(span.length)
  })

  it('returns empty for a backwards range rather than looping', () => {
    expect(calendarSpan('2026-08-04', '2026-08-01')).toEqual([])
  })

  it('returns empty for a malformed key rather than throwing', () => {
    expect(calendarSpan('nope', '2026-08-04')).toEqual([])
    expect(calendarSpan('2026-08-04', 'nope')).toEqual([])
  })
})

describe('windowSpan', () => {
  it('counts the end day as one of the days', () => {
    // 30 columns, not 31. Off by one here would put a phantom day on the chart.
    expect(windowSpan(30, '2026-08-04')).toHaveLength(30)
    expect(windowSpan(30, '2026-08-04').at(0)).toBe('2026-07-06')
    expect(windowSpan(30, '2026-08-04').at(-1)).toBe('2026-08-04')
  })

  it('handles a window of one', () => {
    expect(windowSpan(1, '2026-08-04')).toEqual(['2026-08-04'])
  })

  it('returns empty for a nonsense window rather than throwing', () => {
    expect(windowSpan(0, '2026-08-04')).toEqual([])
    expect(windowSpan(-5, '2026-08-04')).toEqual([])
    expect(windowSpan(1.5, '2026-08-04')).toEqual([])
  })
})

describe('formatting', () => {
  it('formats a day without throwing on a bad key', () => {
    expect(formatDayShort('2026-08-04')).not.toBe('')
    expect(formatDayLong('2026-08-04')).not.toBe('')
    expect(formatDayShort('nope')).toBe('')
    expect(formatDayLong('nope')).toBe('')
  })
})
