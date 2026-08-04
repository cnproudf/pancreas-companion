import { describe, expect, it } from 'vitest'
import { countMeals, mealNudgeText, MEAL_COPY, MEAL_GAP_MINUTES } from './meals.ts'
import type { FoodLogEntry } from './foodLog.ts'
import { DASH_PATTERN, SCOLDING_PATTERN } from '../test/copyInvariants.ts'

/** Local wall clock times on one day, so the clustering is readable. */
function at(hour: number, minute = 0): FoodLogEntry {
  return {
    id: `e-${hour}-${minute}`,
    foodId: null,
    name: 'Something',
    servingDescription: '1 serving',
    fatGrams: 2,
    loggedAt: new Date(2026, 7, 3, hour, minute, 0).toISOString(),
  }
}

describe('countMeals', () => {
  it('is zero for a day with nothing logged', () => {
    expect(countMeals([])).toBe(0)
  })

  it('counts a plate logged food by food as one meal', () => {
    // Chicken, rice, and green beans at dinner. This is the case that makes
    // counting entries instead of clustering give the wrong answer.
    expect(countMeals([at(18, 0), at(18, 3), at(18, 10)])).toBe(1)
  })

  it('separates meals that are hours apart', () => {
    expect(countMeals([at(8, 0), at(12, 30), at(18, 0)])).toBe(3)
  })

  it('clusters the same way regardless of the order in the array', () => {
    // An undone removal is re-appended at the end, so the array order is not
    // the order of the day.
    const inOrder = countMeals([at(8, 0), at(8, 20), at(13, 0)])
    const shuffled = countMeals([at(13, 0), at(8, 20), at(8, 0)])
    expect(inOrder).toBe(2)
    expect(shuffled).toBe(2)
  })

  it('splits exactly past the gap and holds together at it', () => {
    expect(countMeals([at(8, 0), at(9, 0)])).toBe(1)
    expect(countMeals([at(8, 0), at(9, 1)])).toBe(2)
  })

  it('measures the gap between neighbours, not from the first entry', () => {
    // A grazed afternoon: nothing is an hour from the one before it, so it is
    // one long meal rather than four.
    expect(countMeals([at(14, 0), at(14, 50), at(15, 40), at(16, 30)])).toBe(1)
  })

  it('honours a caller supplied gap', () => {
    expect(countMeals([at(8, 0), at(8, 40)], 30)).toBe(2)
    expect(MEAL_GAP_MINUTES).toBe(60)
  })

  it('skips an entry whose timestamp will not parse rather than throwing', () => {
    const damaged: FoodLogEntry = { ...at(8, 0), id: 'bad', loggedAt: 'not a date' }
    expect(countMeals([damaged, at(12, 0), at(18, 0)])).toBe(2)
  })

  it('returns zero when every timestamp is unusable', () => {
    expect(countMeals([{ ...at(8, 0), loggedAt: '' }])).toBe(0)
  })
})

describe('mealNudgeText', () => {
  it('says nothing has been logged at zero', () => {
    expect(mealNudgeText(0)).toBe('Nothing logged yet today.')
  })

  it('offers the 4 to 6 pattern below the range', () => {
    expect(mealNudgeText(2)).toBe(
      'That is 2 so far today, spreading things across 4 to 6 smaller meals is easier on your system.',
    )
  })

  it('stays neutral inside the range', () => {
    expect(mealNudgeText(5)).toBe(
      'That is 5 so far today, spread through the day, which is what is easiest on your system.',
    )
  })

  it('still says something above the range, and does not go quiet', () => {
    // Going silent only at the high end reads as disapproval by omission, which
    // is exactly what invariant 10 exists to prevent.
    const text = mealNudgeText(8)
    expect(text).toBe('That is 8 so far today, spread out, which is easy on your system.')
    expect(text.length).toBeGreaterThan(0)
  })

  it('gives every band above zero a reason, not just a count', () => {
    for (const count of [1, 3, 4, 6, 7, 12]) {
      expect(mealNudgeText(count)).toContain('your system')
    }
  })

  it('treats a negative count as nothing logged rather than rendering it', () => {
    expect(mealNudgeText(-1)).toBe(MEAL_COPY.none)
  })
})

describe('meal copy', () => {
  const strings = Object.values(MEAL_COPY)

  it('contains no em dashes or en dashes (invariant 9)', () => {
    for (const line of strings) expect(line).not.toMatch(DASH_PATTERN)
  })

  it('never scolds (invariant 10)', () => {
    for (const line of strings) expect(line).not.toMatch(SCOLDING_PATTERN)
  })

  it('never frames the range as a target she is failing to hit', () => {
    for (const line of strings) {
      expect(line.toLowerCase()).not.toMatch(/goal|target|try to|need to|aim for|only|just \d/)
    }
  })
})
