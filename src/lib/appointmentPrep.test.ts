import { describe, expect, it } from 'vitest'
import { buildPrep, PREP_COPY } from './appointmentPrep.ts'
import { windowSpan } from './days.ts'
import type { FoodLog, FoodLogEntry } from './foodLog.ts'
import { SYMPTOM_COPY, type SymptomEntry, type SymptomLog } from './symptomLog.ts'
import { DEFAULT_SETTINGS } from '../state/settingsModel.ts'
import type { Settings } from '../types.ts'
import {
  CALENDAR_RATE_PATTERN,
  CAUSAL_PATTERN,
  DASH_PATTERN,
  OBLIGATION_PATTERN,
  SCOLDING_PATTERN,
} from '../test/copyInvariants.ts'

const TODAY = '2026-08-04'
const MALABSORPTION = 'stool-greasy-floating-pale' as const

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

function settingsWith(patch: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, ...patch }
}

function prep(
  symptomLog: SymptomLog,
  foodLog: FoodLog = {},
  settings: Settings = DEFAULT_SETTINGS,
  printName = '',
) {
  return buildPrep(30, symptomLog, foodLog, TODAY, settings, printName)
}

/* ========================================================================== */
/* Copy invariants, the same pair of sweeps patterns.test.ts runs              */
/* ========================================================================== */

describe('PREP_COPY', () => {
  const lines = Object.entries(PREP_COPY)

  it('has no em or en dashes anywhere (invariant 9)', () => {
    for (const [key, text] of lines) expect(text, key).not.toMatch(DASH_PATTERN)
  })

  it('never scolds (invariant 10)', () => {
    for (const [key, text] of lines) expect(text, key).not.toMatch(SCOLDING_PATTERN)
  })

  /*
   * INVARIANT 5 AS PROSE, and this page is where it matters most. A sentence
   * can break it while the arithmetic behind it is perfect: "your pain averaged
   * 2 per day this month" is false even when the average was taken over logged
   * days only, because it invites the reader to treat the quiet days as calm
   * ones. On a page a gastroenterologist acts on, that is the whole problem.
   */
  it('never phrases anything as a rate over calendar time', () => {
    for (const [key, text] of lines) expect(text, key).not.toMatch(CALENDAR_RATE_PATTERN)
  })

  it('never speaks causally (addendum B)', () => {
    for (const [key, text] of lines) expect(text, key).not.toMatch(CAUSAL_PATTERN)
  })

  it('never implies she owes the app an entry (addendum B)', () => {
    for (const [key, text] of lines) expect(text, key).not.toMatch(OBLIGATION_PATTERN)
  })

  /*
   * The positive half. A negative guard catches the phrasings someone thought
   * of; this catches the ones nobody did. Every line that reports a count of
   * her own logging has to name what it is out of, in words.
   */
  it('names its denominator in every statistic line', () => {
    const statistics = [
      PREP_COPY.symptomaticLine,
      PREP_COPY.malabsorptionLine,
      PREP_COPY.malabsorptionDaysLine,
      PREP_COPY.malabsorptionNone,
    ]

    for (const line of statistics) expect(line, line).toContain('you logged')
  })

  /* The sentence the whole page rests on, checked for both of its beats. */
  it('states plainly that this is logged events only', () => {
    expect(PREP_COPY.loggedOnly).toContain('only what was logged')
    expect(PREP_COPY.loggedOnly).toContain('not days that went well')
  })
})

/* ========================================================================== */
/* The date range and the entry count, addendum B's two additions              */
/* ========================================================================== */

describe('the range and the count', () => {
  it('reports the window covered, with the year on it', () => {
    const document = prep(symptomLogOf({ '2026-08-04': 6 }))
    const span = windowSpan(30, TODAY)

    expect(document.coversLine).toContain('2026')
    // Both ends of the window, gaps included, not just the logged days.
    expect(document.coversLine).toContain(fullOf(span.at(0) as string))
    expect(document.coversLine).toContain(fullOf(span.at(-1) as string))
  })

  /*
   * The range covered and the range she logged in are DIFFERENT FACTS and the
   * page reports both. Collapsing them to one line would either hide the gaps
   * at the edges of the window or misstate what the summary is about.
   */
  it('keeps the covered range separate from the logged range', () => {
    const document = prep(symptomLogOf({ '2026-07-30': 6, '2026-08-01': 4 }))

    expect(document.coversLine).toContain(fullOf('2026-07-06'))
    expect(document.daysLine).toContain('You logged on 2')
  })

  it('reports the number of entries she logged', () => {
    const log: SymptomLog = {
      '2026-08-04': [symptom('2026-08-04', 6), { ...symptom('2026-08-04', 7), id: 'b' }],
      '2026-08-02': [symptom('2026-08-02', 3)],
    }
    const document = prep(log)

    expect(document.summary.entryCount).toBe(3)
    expect(document.entriesLine).toContain('3 entries you logged')
  })

  it('runs from her earliest logged day when the window is everything', () => {
    const document = buildPrep(
      'all',
      symptomLogOf({ '2026-06-01': 5, '2026-08-04': 6 }),
      {},
      TODAY,
      DEFAULT_SETTINGS,
      '',
    )

    expect(document.coversLine).toContain(fullOf('2026-06-01'))
    expect(document.coversLine).toContain(fullOf(TODAY))
  })
})

/* ========================================================================== */
/* Invariant 5: nothing logged is nothing logged                              */
/* ========================================================================== */

describe('invariant 5 on the printed page', () => {
  /*
   * THE ASSERTION THAT MATTERS MOST IN THIS FILE. An empty window must produce
   * a page that says there is nothing here, and specifically must not produce a
   * page of zeros. A zero on a clinical summary reads as an observation.
   */
  it('produces no zeros for a window with nothing in it', () => {
    const document = prep({})

    expect(document.nothingLogged).toBe(true)
    expect(document.painLine).toBeNull()
    expect(document.hardestLine).toBeNull()
    expect(document.fatLine).toBeNull()
    expect(document.entriesLine).toBeNull()
    expect(document.symptomaticLine).toBeNull()
    expect(document.summary.averagePainAcrossLoggedDays).toBeNull()
    expect(document.summary.averageFatAcrossLoggedDays).toBeNull()
  })

  it('never divides by the calendar days in the window', () => {
    // Three logged days at 3, 6 and 9 average 6. Over the 30 day window they
    // would be 0.6, which reads as a nearly painless month.
    const document = prep(
      symptomLogOf({ '2026-08-04': 9, '2026-08-02': 6, '2026-07-28': 3 }),
    )

    expect(document.summary.windowDays).toBe(30)
    expect(document.painLine).toContain('averaged 6')
    expect(document.painLine).toContain('days you logged')
  })

  it('carries the denominator into every rendered statistic', () => {
    const log: SymptomLog = {
      '2026-08-04': [symptom('2026-08-04', 6, { symptoms: ['nausea', MALABSORPTION] })],
      '2026-08-02': [symptom('2026-08-02', 3)],
    }
    const document = prep(log, { '2026-08-04': [foodEntry('2026-08-04', 'Toast', 8, 4)] })

    for (const line of [
      document.symptomaticLine,
      document.painLine,
      document.fatLine,
      document.malabsorptionLine,
      document.malabsorptionDaysLine,
    ]) {
      expect(line, line ?? 'null').toContain('you logged')
    }
  })
})

/* ========================================================================== */
/* Spec 5.6's own bullets                                                     */
/* ========================================================================== */

describe('the statistics spec 5.6 asks for', () => {
  it('reports symptomatic days against the days she logged', () => {
    const log: SymptomLog = {
      '2026-08-04': [symptom('2026-08-04', 6, { symptoms: ['nausea'] })],
      '2026-08-03': [symptom('2026-08-03', 4)],
      '2026-08-02': [symptom('2026-08-02', 2, { symptoms: ['fatigue'] })],
    }
    const document = prep(log)

    expect(document.symptomaticLine).toBe('Of the 3 days you logged, 2 carried a symptom.')
  })

  it('reports average and worst pain, both denominated', () => {
    const document = prep(
      symptomLogOf({ '2026-08-04': 8, '2026-08-03': 4, '2026-08-02': 6 }),
    )

    expect(document.painLine).toContain('averaged 6')
    expect(document.hardestLine).toContain('8')
    expect(document.hardestLine).toContain('The highest you logged')
  })

  it('reports average fat across the days she logged food', () => {
    const foodLog: FoodLog = {
      '2026-08-04': [foodEntry('2026-08-04', 'Toast', 8, 10)],
      '2026-08-02': [foodEntry('2026-08-02', 'Rice', 8, 20)],
    }
    const document = prep(symptomLogOf({ '2026-08-04': 5 }), foodLog)

    // Mean of 10 and 20 across the two days with food. Not across 30 days.
    expect(document.fatLine).toContain('15')
    expect(document.fatLine).toContain('days you logged food')
  })

  /*
   * "Any flagged malabsorption entries." Reported as a count against its
   * denominator rather than as a list of dates: three dates on a page invite a
   * clinician to read a pattern into three data points.
   */
  it('counts the flagged entries and says what the note means', () => {
    const log: SymptomLog = {
      '2026-08-04': [
        symptom('2026-08-04', 6, { symptoms: [MALABSORPTION] }),
        { ...symptom('2026-08-04', 7, { symptoms: [MALABSORPTION] }), id: 'b' },
      ],
      '2026-08-02': [symptom('2026-08-02', 3)],
    }
    const document = prep(log)

    expect(document.malabsorptionLine).toBe(
      'The greasy, floating, or pale stool note is on 2 of the 3 entries you logged.',
    )
    expect(document.malabsorptionDaysLine).toBe('Those fall on 1 of the 2 days you logged.')
    /* The one plain sentence, from the sheet that collects the chip. */
    expect(document.malabsorptionInfo).toBe(SYMPTOM_COPY.stoolInfo)
  })

  it('says plainly when nothing carried the note, and skips the explainer', () => {
    const document = prep(symptomLogOf({ '2026-08-04': 6 }))

    expect(document.malabsorptionLine).toBe(PREP_COPY.malabsorptionNone)
    expect(document.malabsorptionDaysLine).toBeNull()
    expect(document.malabsorptionInfo).toBeNull()
  })

  it('carries the recurring foods with both counts on each', () => {
    /* 12 logged days; the two 9s are the hardest group under a cap of 4. */
    const pains = [3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 9, 9]
    const keys = windowSpan(pains.length, TODAY)

    const symptomLog: SymptomLog = {}
    const foodLog: FoodLog = {}
    keys.forEach((key, index) => {
      symptomLog[key] = [symptom(key, pains[index] as number)]
      /* Toast the evening before every logged day. */
      foodLog[key] = [foodEntry(key, 'Toast', 6)]
    })

    const document = buildPrep('all', symptomLog, foodLog, TODAY, DEFAULT_SETTINGS, '')
    const toast = document.findings.patterns.find((pattern) => pattern.name === 'Toast')

    expect(toast).toBeDefined()
    /* The counter-evidence count is a required field, so it cannot be dropped. */
    expect(toast?.beforeOtherDays).toBeGreaterThan(0)
  })
})

/* ========================================================================== */
/* The target, and where it came from                                         */
/* ========================================================================== */

describe('the daily fat target', () => {
  it('names her care team when the number is theirs', () => {
    const document = prep({}, {}, settingsWith({ dailyFatTarget: 35 }))

    expect(document.target?.line).toBe('35 grams of fat.')
    expect(document.target?.origin).toContain('your care team gave you')
  })

  /*
   * Addendum section A's non-negotiable distinction, on the page where getting
   * it wrong costs the most. A clinician reading this has to be able to tell in
   * one line whether the number is one they gave her or one the app estimated.
   */
  it('disowns the claim when the number is the app estimate', () => {
    const document = prep(
      {},
      {},
      settingsWith({ age: 41, heightCm: 168, weightKg: 70, biologicalSex: 'female' }),
    )

    expect(document.target?.origin).toContain('not a number from your care team')
  })

  it('disowns it just as plainly for a starting number she typed', () => {
    const document = prep({}, {}, settingsWith({ provisionalFatTarget: 30 }))

    expect(document.target?.origin).toContain('you entered yourself')
    expect(document.target?.origin).toContain('not a number from your care team')
  })

  it('returns null rather than inventing one when none is set', () => {
    expect(prep({}).target).toBeNull()
  })
})

/* ========================================================================== */
/* The running footer                                                         */
/* ========================================================================== */

describe('the running footer', () => {
  it('carries the range so a loose page is not anonymous', () => {
    const document = prep(symptomLogOf({ '2026-08-04': 6 }))

    expect(document.footerLine).toContain(fullOf(TODAY))
    expect(document.footerLine).toContain('to')
  })

  it('puts her name in front of it when she has set one', () => {
    const document = prep(symptomLogOf({ '2026-08-04': 6 }), {}, DEFAULT_SETTINGS, 'Sam')
    expect(document.footerLine.startsWith('Sam, ')).toBe(true)
  })

  /* Blank is the normal case. Nothing in the app asks her for a name. */
  it('is the range alone when she has not', () => {
    const document = prep(symptomLogOf({ '2026-08-04': 6 }), {}, DEFAULT_SETTINGS, '   ')
    expect(document.footerLine.startsWith(',')).toBe(false)
    expect(document.footerLine).toContain(fullOf(TODAY))
  })
})

/* -------------------------------------------------------------------------- */

/** A symptom log from { dayKey: worstPain } pairs. */
function symptomLogOf(days: Record<string, number | null>): SymptomLog {
  const log: SymptomLog = {}
  for (const [key, pain] of Object.entries(days)) log[key] = [symptom(key, pain)]
  return log
}

/** The same formatting the module uses, so assertions do not hard code a locale. */
function fullOf(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y as number, (m as number) - 1, d as number).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
