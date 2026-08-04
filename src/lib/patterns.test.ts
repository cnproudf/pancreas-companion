import { describe, expect, it } from 'vitest'
import { windowSpan } from './days.ts'
import type { FoodLog, FoodLogEntry } from './foodLog.ts'
import {
  buildWindow,
  daysLineText,
  fatLineText,
  findPatterns,
  hardDaysLineText,
  hardestLineText,
  hardestLoggedDays,
  HARD_DAY_SHARE,
  MIN_DAYS_FOR_PATTERNS,
  painLineText,
  patternItemText,
  PATTERN_COPY,
  percentile75,
  spanFor,
  summarize,
  type PatternWindow,
} from './patterns.ts'
import type { SymptomEntry, SymptomLog } from './symptomLog.ts'
import {
  CALENDAR_RATE_PATTERN,
  CAUSAL_PATTERN,
  DASH_PATTERN,
  OBLIGATION_PATTERN,
  SCOLDING_PATTERN,
} from '../test/copyInvariants.ts'

const TODAY = '2026-08-04'

/* Local, so day keys do not depend on the runner's zone. */
function iso(key: string, hour = 12): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y as number, (m as number) - 1, d as number, hour, 0, 0).toISOString()
}

function symptom(key: string, pain: number | null, patch: Partial<SymptomEntry> = {}): SymptomEntry {
  return {
    id: `s-${key}-${pain ?? 'none'}`,
    at: iso(key),
    pain,
    symptoms: [],
    note: '',
    attachedFoods: [],
    ...patch,
  }
}

/** A symptom log from { dayKey: worstPain } pairs. null means slider skipped. */
function symptomLogOf(days: Record<string, number | null>): SymptomLog {
  const log: SymptomLog = {}
  for (const [key, pain] of Object.entries(days)) log[key] = [symptom(key, pain)]
  return log
}

function foodEntry(key: string, name: string, hour: number, grams = 5): FoodLogEntry {
  return {
    id: `f-${key}-${name}-${hour}`,
    foodId: null,
    name,
    servingDescription: '1 serving',
    fatGrams: grams,
    loggedAt: iso(key, hour),
  }
}

/** A window of `days` calendar days ending today, over the given logs. */
function windowOf(days: number, symptomLog: SymptomLog, foodLog: FoodLog = {}): PatternWindow {
  return buildWindow(windowSpan(days, TODAY), symptomLog, foodLog)
}

/** N consecutive days ending today, carrying the given pain values in order. */
function daysWithPain(pains: readonly (number | null)[]): SymptomLog {
  const keys = windowSpan(pains.length, TODAY)
  const log: SymptomLog = {}
  keys.forEach((key, index) => {
    log[key] = [symptom(key, pains[index] as number | null)]
  })
  return log
}

/* ========================================================================== */
/* INVARIANT 5. Unlogged days are gaps, never zeros.                          */
/* ========================================================================== */

describe('invariant 5: unlogged days are gaps', () => {
  it('yields a gap for every calendar day with nothing logged', () => {
    const window = windowOf(30, symptomLogOf({ '2026-08-04': 6, '2026-08-02': 4, '2026-07-28': 8 }))

    expect(window.days).toHaveLength(30)
    expect(window.symptomDays.filter((day) => day.kind === 'gap')).toHaveLength(27)
    expect(window.symptomDays.filter((day) => day.kind === 'logged')).toHaveLength(3)
  })

  it('gives a gap no numeric field to read as a zero', () => {
    /*
     * The load bearing assertion for invariant 5, and the reason SymptomDay is
     * a union rather than one shape with nullable numbers. A nullable number is
     * one `?? 0` away from being a symptom-free day on a chart her
     * gastroenterologist is going to read.
     */
    const window = windowOf(5, symptomLogOf({ '2026-08-04': 6 }))
    const gap = window.symptomDays.find((day) => day.kind === 'gap')

    expect(gap).toBeDefined()
    expect(gap).not.toHaveProperty('worstPain')
    expect(gap).not.toHaveProperty('events')
    expect(Object.keys(gap as object).sort()).toEqual(['dateKey', 'kind'])
  })

  it('gives a fat gap no grams field either', () => {
    const window = windowOf(5, {}, { '2026-08-04': [foodEntry('2026-08-04', 'Toast', 8)] })
    const gap = window.fatDays.find((day) => day.kind === 'gap')

    expect(gap).toBeDefined()
    expect(gap).not.toHaveProperty('grams')
    expect(Object.keys(gap as object).sort()).toEqual(['dateKey', 'kind'])
  })

  it('never divides by calendar days', () => {
    // 3 logged days at 3, 6, and 9 average 6. Averaged over the 30 day window
    // they would be 0.6, which would read as a nearly painless month.
    const window = windowOf(
      30,
      symptomLogOf({ '2026-08-04': 9, '2026-08-02': 6, '2026-07-28': 3 }),
    )
    const summary = summarize(window)

    expect(summary.windowDays).toBe(30)
    expect(summary.daysLogged).toBe(3)
    expect(summary.averagePainAcrossLoggedDays).toBe(6)
  })

  it('says both numbers in the sentence and divides by only one', () => {
    const summary = summarize(
      windowOf(30, symptomLogOf({ '2026-08-04': 9, '2026-08-02': 6, '2026-07-28': 3 })),
    )

    expect(daysLineText(summary, false)).toBe('You logged on 3 of the last 30 days.')
    expect(painLineText(summary)).toContain('averaged 6')
    expect(painLineText(summary)).toContain('days you logged')
  })

  it('returns null rather than 0 when there is nothing to average', () => {
    const summary = summarize(windowOf(30, {}))

    expect(summary.averagePainAcrossLoggedDays).toBeNull()
    expect(summary.averageFatAcrossLoggedDays).toBeNull()
    expect(summary.hardestLogged).toBeNull()
    expect(summary.daysLogged).toBe(0)
  })

  it('treats a day with food but no symptoms as a gap in one series only', () => {
    // Both true at once. Merging the series would force one of them to zero.
    const window = windowOf(3, {}, { '2026-08-04': [foodEntry('2026-08-04', 'Toast', 8, 4)] })

    const symptomToday = window.symptomDays.find((day) => day.dateKey === TODAY)
    const fatToday = window.fatDays.find((day) => day.dateKey === TODAY)

    expect(symptomToday?.kind).toBe('gap')
    expect(fatToday?.kind).toBe('logged')
    expect(fatToday?.kind === 'logged' ? fatToday.grams : null).toBe(4)
  })

  it('treats a day with symptoms but no food as a gap in the other series', () => {
    const window = windowOf(3, symptomLogOf({ '2026-08-04': 5 }))

    expect(window.symptomDays.find((day) => day.dateKey === TODAY)?.kind).toBe('logged')
    expect(window.fatDays.find((day) => day.dateKey === TODAY)?.kind).toBe('gap')
  })
})

/* ========================================================================== */
/* The three pain states                                                      */
/* ========================================================================== */

describe('pain: gap, skipped, and a logged zero are three different things', () => {
  it('keeps a day where the slider was skipped as logged, with null pain', () => {
    const window = windowOf(3, symptomLogOf({ '2026-08-04': null }))
    const day = window.symptomDays.find((d) => d.dateKey === TODAY)

    expect(day?.kind).toBe('logged')
    expect(day?.kind === 'logged' ? day.worstPain : 'wrong').toBeNull()
  })

  it('keeps a logged 0 as 0, which is a real observation', () => {
    const window = windowOf(3, symptomLogOf({ '2026-08-04': 0 }))
    const day = window.symptomDays.find((d) => d.dateKey === TODAY)

    expect(day?.kind === 'logged' ? day.worstPain : 'wrong').toBe(0)
  })

  it('does not seed the daily worst at 0, which would turn skips into zeros', () => {
    // A reduce with a 0 seed is the most natural way to write worstPainOf and
    // is exactly wrong: every skipped-slider day would report a 0.
    const log: SymptomLog = { '2026-08-04': [symptom('2026-08-04', null)] }
    const window = windowOf(3, log)
    const day = window.symptomDays.find((d) => d.dateKey === TODAY)

    expect(day?.kind === 'logged' ? day.worstPain : 'wrong').not.toBe(0)
  })

  it('excludes skipped days from the average without counting them as zero', () => {
    const log: SymptomLog = {
      '2026-08-04': [symptom('2026-08-04', 8)],
      '2026-08-03': [symptom('2026-08-03', null)],
      '2026-08-02': [symptom('2026-08-02', 4)],
    }
    const summary = summarize(windowOf(30, log))

    expect(summary.daysLogged).toBe(3)
    expect(summary.daysWithPainNumber).toBe(2)
    // Mean of 8 and 4. Counting the skip as 0 would give 4.
    expect(summary.averagePainAcrossLoggedDays).toBe(6)
  })

  it('takes the worst of several entries on one day', () => {
    const log: SymptomLog = {
      '2026-08-04': [symptom('2026-08-04', 3), { ...symptom('2026-08-04', 7), id: 'b' }],
    }
    const day = windowOf(3, log).symptomDays.find((d) => d.dateKey === TODAY)

    expect(day?.kind === 'logged' ? day.worstPain : null).toBe(7)
  })

  it('reports null for a day of entries that all skipped the slider', () => {
    const log: SymptomLog = {
      '2026-08-04': [symptom('2026-08-04', null), { ...symptom('2026-08-04', null), id: 'b' }],
    }
    const day = windowOf(3, log).symptomDays.find((d) => d.dateKey === TODAY)

    expect(day?.kind === 'logged' ? day.worstPain : 'wrong').toBeNull()
  })
})

/* ========================================================================== */
/* Hardest logged days                                                        */
/* ========================================================================== */

describe('percentile75', () => {
  it('interpolates, R-7 style', () => {
    expect(percentile75([1, 2, 3, 4, 5, 6, 7, 8])).toBeCloseTo(6.25)
    expect(percentile75([4, 6, 6, 6, 6, 6, 7, 8])).toBeCloseTo(6.25)
    expect(percentile75([5, 6, 6, 6, 6, 6, 6, 6])).toBeCloseTo(6)
    expect(percentile75([6, 6, 6, 6, 6, 6, 6, 6])).toBeCloseTo(6)
  })

  it('handles the degenerate sizes', () => {
    expect(percentile75([])).toBeNull()
    expect(percentile75([7])).toBe(7)
  })
})

describe('hardestLoggedDays', () => {
  /*
   * THE FAILURE THIS GUARDS AGAINST.
   *
   * A bare "at or above the 75th percentile" breaks on ties, and pain logs are
   * full of ties. The four rows below are the ones worked through in the plan:
   * the last two would select 7 of 8 and 8 of 8 days as "hardest". That is not
   * a cosmetic problem. If every logged day is a hard day then every food she
   * ate lands in the pattern list, and the counter-evidence denominator
   * collapses to zero because there are no other logged days to compare
   * against. The guard meant to stop her eliminating a food she loves would be
   * satisfied on paper while doing nothing.
   */
  it('selects a clean minority when the values spread out', () => {
    const hard = hardestLoggedDays(windowOf(30, daysWithPain([1, 2, 3, 4, 5, 6, 7, 8])))
    expect(hard.dateKeys).toHaveLength(2)
    expect(hard.threshold).toBe(7)
  })

  it('takes whole tie groups up to the cap', () => {
    const hard = hardestLoggedDays(windowOf(30, daysWithPain([4, 6, 6, 6, 6, 6, 7, 8])))
    expect(hard.dateKeys).toHaveLength(2)
    expect(hard.threshold).toBe(7)
  })

  it('refuses rather than naming 7 of 8 days as hardest', () => {
    // Seven days at exactly 6 have no hardest group. Picking 2 of those 7 would
    // manufacture a distinction that is not in the data.
    const hard = hardestLoggedDays(windowOf(30, daysWithPain([5, 6, 6, 6, 6, 6, 6, 6])))
    expect(hard.dateKeys).toEqual([])
    expect(hard.threshold).toBeNull()
  })

  it('refuses rather than naming every logged day as hardest', () => {
    const hard = hardestLoggedDays(windowOf(30, daysWithPain([6, 6, 6, 6, 6, 6, 6, 6])))
    expect(hard.dateKeys).toEqual([])
  })

  it('takes two tie groups when both fit under a larger cap', () => {
    // n=12, cap 4, threshold 7.25. Both 9s, then the 8. Stops at 3.
    const hard = hardestLoggedDays(
      windowOf(30, daysWithPain([3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 9, 9])),
    )
    expect(hard.dateKeys).toHaveLength(3)
    expect(hard.threshold).toBe(8)
  })

  it('never selects more than a third of the logged days', () => {
    // The invariant behind the cap, asserted directly across many shapes.
    const shapes: number[][] = [
      [1, 2, 3, 4, 5, 6, 7, 8],
      [4, 6, 6, 6, 6, 6, 7, 8],
      [5, 6, 6, 6, 6, 6, 6, 6],
      [6, 6, 6, 6, 6, 6, 6, 6],
      [3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 9, 9],
      [0, 0, 1, 1, 2, 2, 3, 3, 9, 9, 10, 10],
      [10, 10, 10, 10, 9, 9, 8, 8, 7, 7, 6, 6],
    ]

    for (const shape of shapes) {
      const hard = hardestLoggedDays(windowOf(60, daysWithPain(shape)))
      expect(hard.dateKeys.length).toBeLessThanOrEqual(Math.floor(shape.length * HARD_DAY_SHARE))
    }
  })

  it('selects only complete tie groups', () => {
    const shape = [0, 0, 1, 1, 2, 2, 3, 3, 9, 9, 10, 10]
    const window = windowOf(60, daysWithPain(shape))
    const hard = hardestLoggedDays(window)

    const selectedPains = window.symptomDays
      .filter((day) => day.kind === 'logged' && hard.dateKeys.includes(day.dateKey))
      .map((day) => (day.kind === 'logged' ? day.worstPain : null))

    // Every day in the window sharing a selected pain value must be selected.
    for (const pain of new Set(selectedPains)) {
      const allWithPain = window.symptomDays.filter(
        (day) => day.kind === 'logged' && day.worstPain === pain,
      ).length
      expect(selectedPains.filter((value) => value === pain)).toHaveLength(allWithPain)
    }
  })

  it('applies the floor so an ordinary stretch has no hard days', () => {
    // Nothing above a 3. A percentile alone would still name the top of it.
    const hard = hardestLoggedDays(windowOf(30, daysWithPain([1, 1, 2, 2, 2, 3, 3, 3])))
    expect(hard.dateKeys).toEqual([])
  })

  it('refuses below the minimum-data gate', () => {
    const hard = hardestLoggedDays(windowOf(30, daysWithPain([2, 5, 9, 10, 8, 7, 6])))
    expect(hard.dateKeys).toEqual([])
  })

  it('ignores skipped days when counting toward the gate', () => {
    // 8 logged days but only 5 numbers is below the gate, not at it.
    const hard = hardestLoggedDays(
      windowOf(30, daysWithPain([9, 10, 8, null, null, null, 7, 6])),
    )
    expect(hard.dateKeys).toEqual([])
  })
})

/* ========================================================================== */
/* Possible patterns                                                          */
/* ========================================================================== */

describe('findPatterns', () => {
  /** 12 logged days; the two 9s are the hardest group under a cap of 4. */
  const pains = [3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 9, 9]
  const symptomLog = daysWithPain(pains)
  const keys = windowSpan(pains.length, TODAY)
  const hardKeys = [keys[10] as string, keys[11] as string]

  function foodOn(days: readonly string[], name: string, hour = 8): FoodLog {
    const log: FoodLog = {}
    for (const key of days) log[key] = [...(log[key] ?? []), foodEntry(key, name, hour)]
    return log
  }

  function merge(...logs: FoodLog[]): FoodLog {
    const merged: FoodLog = {}
    for (const log of logs) {
      for (const [key, entries] of Object.entries(log)) {
        merged[key] = [...(merged[key] ?? []), ...entries]
      }
    }
    return merged
  }

  it('reports the counter-evidence count alongside the hits', () => {
    /*
     * The whole reason beforeOtherDays is a required field. A list that reports
     * only the hits is the mechanism by which she stops eating something she
     * loves for no reason.
     */
    const foodLog = merge(foodOn(hardKeys, 'Chicken salad'), foodOn(keys.slice(0, 5), 'Chicken salad'))
    const found = findPatterns(buildWindow(keys, symptomLog, foodLog), foodLog)

    const item = found.patterns.find((pattern) => pattern.name === 'Chicken salad')
    expect(item).toBeDefined()
    expect(item?.beforeHardDays).toBe(2)
    expect(item?.beforeOtherDays).toBe(5)
  })

  it('always renders both numbers', () => {
    const text = patternItemText({ name: 'Toast', beforeHardDays: 2, beforeOtherDays: 9 })
    expect(text).toContain('2')
    expect(text).toContain('9')
    expect(text).toContain('other days you logged')
  })

  it('says so plainly when a food appeared on no other logged day', () => {
    const text = patternItemText({ name: 'Toast', beforeHardDays: 3, beforeOtherDays: 0 })
    expect(text).toContain('no other day you logged')
  })

  it('drops a food that appeared too few times to mean anything', () => {
    const foodLog = foodOn([hardKeys[0] as string], 'Rare thing')
    const found = findPatterns(buildWindow(keys, symptomLog, foodLog), foodLog)
    expect(found.patterns.map((p) => p.name)).not.toContain('Rare thing')
  })

  it('drops a food that never appeared before a hard day', () => {
    const foodLog = foodOn(keys.slice(0, 6), 'Oatmeal')
    const found = findPatterns(buildWindow(keys, symptomLog, foodLog), foodLog)
    expect(found.patterns.map((p) => p.name)).not.toContain('Oatmeal')
  })

  it('counts a food once per day, not once per serving', () => {
    // Otherwise a staple she eats three times a day outranks everything by
    // frequency alone.
    const foodLog: FoodLog = {}
    for (const key of [...hardKeys, ...keys.slice(0, 4)]) {
      foodLog[key] = [
        foodEntry(key, 'Toast', 7),
        foodEntry(key, 'Toast', 8),
        foodEntry(key, 'Toast', 9),
      ]
    }
    const found = findPatterns(buildWindow(keys, symptomLog, foodLog), foodLog)
    const item = found.patterns.find((pattern) => pattern.name === 'Toast')

    expect(item?.beforeHardDays).toBe(2)
    expect(item?.beforeOtherDays).toBe(4)
  })

  it('reaches back across midnight to the evening before', () => {
    // "Within 24 hours" of a morning entry is mostly the previous evening. A
    // midnight to midnight window would miss that dinner entirely.
    const morningLog: SymptomLog = {}
    keys.forEach((key, index) => {
      morningLog[key] = [{ ...symptom(key, pains[index] as number), at: iso(key, 9) }]
    })

    const eveningBefore: FoodLog = {}
    for (const key of hardKeys) {
      const previous = keys[keys.indexOf(key) - 1] as string
      eveningBefore[previous] = [
        ...(eveningBefore[previous] ?? []),
        foodEntry(previous, 'Fried fish', 20),
      ]
    }
    const other = foodOn(keys.slice(0, 3), 'Fried fish', 20)
    const foodLog = merge(eveningBefore, other)

    const found = findPatterns(buildWindow(keys, morningLog, foodLog), foodLog)
    expect(found.patterns.find((p) => p.name === 'Fried fish')?.beforeHardDays).toBe(2)
  })

  it('reports belowGate when there is not enough logged to compare', () => {
    const small = daysWithPain([3, 5, 7])
    const found = findPatterns(buildWindow(windowSpan(3, TODAY), small, {}), {})

    expect(found.belowGate).toBe(true)
    expect(found.patterns).toEqual([])
  })

  it('returns no list and no gate message when the pain does not separate', () => {
    // Enough data, but nothing to compare against. A different empty state.
    const flat = daysWithPain([6, 6, 6, 6, 6, 6, 6, 6])
    const foodLog = foodOn(windowSpan(8, TODAY), 'Toast')
    const found = findPatterns(buildWindow(windowSpan(8, TODAY), flat, foodLog), foodLog)

    expect(found.belowGate).toBe(false)
    expect(found.patterns).toEqual([])
    expect(found.hardDays.dateKeys).toEqual([])
  })
})

/* ========================================================================== */
/* Window selection                                                           */
/* ========================================================================== */

describe('spanFor', () => {
  it('counts the chosen number of calendar days', () => {
    expect(spanFor(30, {}, {}, TODAY)).toHaveLength(30)
    expect(spanFor(90, {}, {}, TODAY)).toHaveLength(90)
  })

  it('runs all-time from her earliest logged day to today', () => {
    // To today, not to her last entry, so a quiet stretch since then shows as
    // gaps rather than being cropped off the end.
    const span = spanFor('all', symptomLogOf({ '2026-08-01': 5 }), {}, TODAY)
    expect(span.at(0)).toBe('2026-08-01')
    expect(span.at(-1)).toBe(TODAY)
    expect(span).toHaveLength(4)
  })

  it('considers the food log when finding the earliest day', () => {
    const span = spanFor('all', {}, { '2026-07-30': [foodEntry('2026-07-30', 'Toast', 8)] }, TODAY)
    expect(span.at(0)).toBe('2026-07-30')
  })

  it('falls back to 30 days when there is nothing logged at all', () => {
    expect(spanFor('all', {}, {}, TODAY)).toHaveLength(30)
  })
})

/* ========================================================================== */
/* Copy                                                                       */
/* ========================================================================== */

describe('PATTERN_COPY', () => {
  const lines = Object.values(PATTERN_COPY)

  it('has no em or en dashes', () => {
    for (const line of lines) expect(line).not.toMatch(DASH_PATTERN)
  })

  it('never scolds', () => {
    for (const line of lines) expect(line).not.toMatch(SCOLDING_PATTERN)
  })

  it('never phrases anything as a rate over calendar time', () => {
    // Invariant 5 as prose. A sentence can violate it while the arithmetic
    // behind it is perfect.
    for (const line of lines) expect(line).not.toMatch(CALENDAR_RATE_PATTERN)
  })

  it('never claims a cause', () => {
    for (const line of lines) expect(line).not.toMatch(CAUSAL_PATTERN)
  })

  it('never implies she owes the app an entry', () => {
    for (const line of lines) expect(line).not.toMatch(OBLIGATION_PATTERN)
  })

  it('names the denominator in every line that reports a statistic', () => {
    /*
     * The positive assertion, which is the stronger of the two. The negative
     * guards catch phrasings someone thought of; this catches the ones nobody
     * did, because any statistic line rewritten without its denominator fails
     * here regardless of how it was worded.
     */
    const statisticLines = [
      PATTERN_COPY.daysLine,
      PATTERN_COPY.daysLineAll,
      PATTERN_COPY.entriesLine,
      PATTERN_COPY.painLine,
      PATTERN_COPY.painNoNumbers,
      PATTERN_COPY.hardestLine,
      PATTERN_COPY.fatLine,
      PATTERN_COPY.hardDaysLine,
      PATTERN_COPY.patternItem,
      PATTERN_COPY.patternItemNoOthers,
    ]

    for (const line of statisticLines) expect(line).toMatch(/you logged/i)
  })

  it('frames patterns as worth mentioning to her doctor, never as findings', () => {
    expect(PATTERN_COPY.patternsTitle).toMatch(/possible patterns/i)
    expect(PATTERN_COPY.patternsTitle).toMatch(/doctor/i)
    expect(PATTERN_COPY.patternsFraming).toMatch(/doctor/i)
  })

  it('says plainly what a gap is not', () => {
    // The sentence that keeps the chart honest.
    expect(PATTERN_COPY.gapExplainer).toMatch(/not calm days/i)
    expect(PATTERN_COPY.gapExplainer).toMatch(/nothing recorded/i)
  })

  it('faults the list rather than her when there is too little to say', () => {
    expect(PATTERN_COPY.belowGate).toMatch(/noise rather than a pattern/i)
    expect(PATTERN_COPY.belowGate).toMatch(/nothing to catch up on/i)
    // No "yet", which frames the present as a shortfall against a future state.
    expect(PATTERN_COPY.belowGate).not.toMatch(/\byet\b/i)
    expect(PATTERN_COPY.empty).not.toMatch(/\byet\b/i)
  })
})

describe('the copy guards actually bite', () => {
  /*
   * Without this block the five guard tests above would pass just as happily
   * against a regex with a typo in it, and a guard that matches nothing
   * protects nothing. Each case below is a sentence someone could plausibly
   * write into PATTERN_COPY.
   */
  it('catches a rate over calendar time', () => {
    for (const bad of [
      'Your pain averaged 2 per day this month.',
      'Daily average pain: 3.',
      'Your pain averaged a 2 a day.',
      'You had 21 symptom-free days.',
      '18 good days out of 30.',
      'Logged 12 of 30 days, a 4 day streak.',
      'You missed 18 days.',
      'Symptoms on 40% of days.',
    ]) {
      expect(bad).toMatch(CALENDAR_RATE_PATTERN)
    }
  })

  it('leaves correct phrasing alone', () => {
    // The other half of the same point: a guard that fails on correct copy gets
    // weakened by whoever is in a hurry.
    for (const fine of [
      'Across the days you logged, your pain averaged 5.',
      'You logged on 3 of the last 30 days.',
      'That was a day you felt fine.',
      'Fried fish shows up more often before your hardest logged days.',
    ]) {
      expect(fine).not.toMatch(CALENDAR_RATE_PATTERN)
      expect(fine).not.toMatch(OBLIGATION_PATTERN)
    }
  })

  it('catches a causal claim', () => {
    for (const bad of [
      'Fried food caused your worst days.',
      'This food triggers your flares.',
      'Your pain was due to the cream sauce.',
      'That is what made you feel worse.',
      'The likely culprit is dairy.',
      'Your pain spiked because of the fried fish.',
    ]) {
      expect(bad).toMatch(CAUSAL_PATTERN)
    }
  })

  it('catches an obligation', () => {
    for (const bad of [
      'Keep logging and this will fill in.',
      'Log more to see patterns here.',
      'The more you log, the better this gets.',
      'Remember to log tomorrow.',
      'Come back daily for the best picture.',
      'You would get a better picture if you kept at it.',
    ]) {
      expect(bad).toMatch(OBLIGATION_PATTERN)
    }
  })
})

describe('copy builders', () => {
  const summary = summarize(
    windowOf(30, symptomLogOf({ '2026-08-04': 7, '2026-08-02': 5, '2026-07-28': 3 })),
  )

  it('names the range rather than a window length for all-time', () => {
    const text = daysLineText(summary, true)
    expect(text).toContain('You logged on 3 days')
    expect(text).not.toContain('30')
  })

  it('reports the hardest logged value with its date', () => {
    expect(hardestLineText(summary)).toContain('7')
    expect(hardestLineText(summary)).toMatch(/August 4/)
  })

  it('returns null instead of a zero line when there is nothing to report', () => {
    const emptySummary = summarize(windowOf(30, {}))
    expect(hardestLineText(emptySummary)).toBeNull()
    expect(fatLineText(emptySummary)).toBeNull()
    expect(hardDaysLineText({ dateKeys: [], threshold: null })).toBeNull()
  })

  it('says she gave no numbers rather than reporting an average of zero', () => {
    const skipped = summarize(windowOf(30, symptomLogOf({ '2026-08-04': null })))
    expect(painLineText(skipped)).toBe(PATTERN_COPY.painNoNumbers)
    expect(painLineText(skipped)).not.toContain('0')
  })

  it('names the actual threshold so she can audit the group', () => {
    const hard = hardestLoggedDays(windowOf(30, daysWithPain([1, 2, 3, 4, 5, 6, 7, 8])))
    expect(hardDaysLineText(hard)).toContain('2 hardest days you logged')
    expect(hardDaysLineText(hard)).toContain('7 or above')
  })
})

describe('constants', () => {
  it('caps a hardest group at a third of the logged days', () => {
    expect(Math.floor(MIN_DAYS_FOR_PATTERNS * HARD_DAY_SHARE)).toBe(2)
  })
})
