import { describe, expect, it } from 'vitest'
import { buildMarks, DEFAULT_BOX } from './chartGeometry.ts'
import { windowSpan } from './days.ts'
import type { FoodLog, FoodLogEntry } from './foodLog.ts'
import { buildWindow } from './patterns.ts'
import type { SymptomEntry, SymptomLog } from './symptomLog.ts'

const TODAY = '2026-08-04'

function iso(key: string, hour = 12): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y as number, (m as number) - 1, d as number, hour, 0, 0).toISOString()
}

function symptom(key: string, pain: number | null, id = 'a'): SymptomEntry {
  return { id: `${key}-${id}`, at: iso(key), pain, symptoms: [], note: '', attachedFoods: [] }
}

function foodEntry(key: string, grams: number): FoodLogEntry {
  return {
    id: `f-${key}`,
    foodId: null,
    name: 'Toast',
    servingDescription: '1 slice',
    fatGrams: grams,
    loggedAt: iso(key, 8),
  }
}

function marksFor(days: number, symptomLog: SymptomLog, foodLog: FoodLog = {}) {
  return buildMarks(buildWindow(windowSpan(days, TODAY), symptomLog, foodLog))
}

describe('layout', () => {
  it('gives every calendar day a column, including unlogged ones', () => {
    const marks = marksFor(30, { '2026-08-04': [symptom('2026-08-04', 5)] })
    expect(marks.columns).toHaveLength(30)
  })

  it('lays columns left to right without overlaps or holes', () => {
    const marks = marksFor(10, {})
    marks.columns.forEach((column, index) => {
      if (index === 0) return
      const previous = marks.columns[index - 1]
      expect(column.x).toBeCloseTo((previous?.x as number) + (previous?.width as number))
    })
  })

  it('spans the full plot width', () => {
    const marks = marksFor(10, {})
    expect(marks.columns.at(0)?.x).toBeCloseTo(marks.axis.plotLeft)
    const last = marks.columns.at(-1)
    expect((last?.x as number) + (last?.width as number)).toBeCloseTo(marks.axis.plotRight)
  })

  it('puts the skipped strip below the axis rule, below the zero gridline', () => {
    // Larger y is further down. The strip must clear both.
    const marks = marksFor(5, {})
    expect(marks.axis.zeroY).toBeLessThan(marks.axis.ruleY)
    expect(marks.axis.ruleY).toBeLessThan(marks.axis.stripY)
  })

  it('puts pain 10 at the top and pain 0 on the zero gridline', () => {
    const marks = marksFor(5, {})
    const ten = marks.axis.painTicks.find((tick) => tick.pain === 10)
    const zero = marks.axis.painTicks.find((tick) => tick.pain === 0)

    expect(ten?.y).toBeCloseTo(marks.axis.plotTop)
    expect(zero?.y).toBeCloseTo(marks.axis.zeroY)
  })

  it('labels a readable number of days, always including the last', () => {
    for (const days of [7, 30, 90]) {
      const marks = marksFor(days, {})
      expect(marks.dayLabels.length).toBeLessThanOrEqual(6)
      expect(marks.dayLabels.at(-1)?.dateKey).toBe(TODAY)
    }
  })
})

/* ========================================================================== */
/* INVARIANT 5, as geometry                                                   */
/* ========================================================================== */

describe('invariant 5: gaps are drawn, never zeros', () => {
  it('emits a gap mark for every day with nothing logged at all', () => {
    /*
     * Asserted by count, so a gap can never be silently absent. Omitting the
     * day would leave white space, and white space on a chart reads as
     * "nothing happened". An unlogged day is unknown, not calm.
     */
    const marks = marksFor(30, {
      '2026-08-04': [symptom('2026-08-04', 5)],
      '2026-07-30': [symptom('2026-07-30', 8)],
    })

    expect(marks.gaps).toHaveLength(28)
    expect(marks.painPoints).toHaveLength(2)
  })

  it('gives a gap a real drawn area rather than a zero height sliver', () => {
    const marks = marksFor(5, {})
    for (const gap of marks.gaps) {
      expect(gap.height).toBeGreaterThan(0)
      expect(gap.width).toBeGreaterThan(0)
    }
  })

  it('places no pain point on a day with nothing logged', () => {
    const marks = marksFor(30, { '2026-08-04': [symptom('2026-08-04', 5)] })
    const plotted = new Set(marks.painPoints.map((point) => point.dateKey))

    for (const gap of marks.gaps) expect(plotted.has(gap.dateKey)).toBe(false)
  })

  it('never places a mark from an unlogged day on the zero gridline', () => {
    // The failure invariant 5 names. Nothing from an empty day may touch y(0).
    const marks = marksFor(30, { '2026-08-04': [symptom('2026-08-04', 5)] })
    const gapDays = new Set(marks.gaps.map((gap) => gap.dateKey))

    const onZero = [...marks.painPoints, ...marks.skippedPoints].filter(
      (point) => Math.abs(point.cy - marks.axis.zeroY) < 0.001,
    )
    for (const point of onZero) expect(gapDays.has(point.dateKey)).toBe(false)
  })

  it('does not hatch a day that has food but no symptom entry', () => {
    /*
     * That day is not blank. The bar already shows it was not empty, and
     * hatching it too would say something false. The missing pain point carries
     * the meaning, and the screen reader table says it in words.
     */
    const marks = marksFor(5, {}, { '2026-08-04': [foodEntry('2026-08-04', 12)] })

    expect(marks.gaps.map((gap) => gap.dateKey)).not.toContain(TODAY)
    expect(marks.fatBars.map((bar) => bar.dateKey)).toContain(TODAY)
    expect(marks.painPoints.map((point) => point.dateKey)).not.toContain(TODAY)
  })

  it('does not hatch a day that has symptoms but no food', () => {
    const marks = marksFor(5, { '2026-08-04': [symptom('2026-08-04', 5)] })
    expect(marks.gaps.map((gap) => gap.dateKey)).not.toContain(TODAY)
  })
})

describe('invariant 5: skipped pain is not a zero', () => {
  it('puts a skipped day in the strip, not on the zero gridline', () => {
    const marks = marksFor(5, { '2026-08-04': [symptom('2026-08-04', null)] })

    expect(marks.skippedPoints).toHaveLength(1)
    expect(marks.painPoints).toHaveLength(0)
    expect(marks.skippedPoints.at(0)?.cy).toBe(marks.axis.stripY)
    expect(marks.skippedPoints.at(0)?.cy).not.toBe(marks.axis.zeroY)
  })

  it('puts a logged 0 on the zero gridline, where it belongs', () => {
    // 0 means "nothing right now", which is a real observation and the reason
    // the skipped strip cannot borrow that line.
    const marks = marksFor(5, { '2026-08-04': [symptom('2026-08-04', 0)] })

    expect(marks.painPoints).toHaveLength(1)
    expect(marks.painPoints.at(0)?.cy).toBeCloseTo(marks.axis.zeroY)
    expect(marks.skippedPoints).toHaveLength(0)
  })

  it('keeps a skipped day and a logged zero visually apart', () => {
    const marks = marksFor(5, {
      '2026-08-04': [symptom('2026-08-04', null)],
      '2026-08-03': [symptom('2026-08-03', 0)],
    })

    const skipped = marks.skippedPoints.at(0)
    const zero = marks.painPoints.at(0)
    expect(skipped?.cy).toBeGreaterThan(zero?.cy as number)
  })

  it('sends a day to the strip only when every entry skipped the slider', () => {
    const log: SymptomLog = {
      '2026-08-04': [symptom('2026-08-04', null, 'a'), symptom('2026-08-04', 6, 'b')],
    }
    const marks = marksFor(5, log)

    expect(marks.skippedPoints).toHaveLength(0)
    expect(marks.painPoints.at(0)?.pain).toBe(6)
  })
})

describe('invariant 5: no zero height bars', () => {
  it('emits no bar at all for a day with no food logged', () => {
    const marks = marksFor(
      30,
      {},
      { '2026-08-04': [foodEntry('2026-08-04', 20)] },
    )

    expect(marks.fatBars).toHaveLength(1)
    expect(marks.fatBars.at(0)?.dateKey).toBe(TODAY)
  })

  it('emits no bars and no scale when she logged no food at all', () => {
    const marks = marksFor(30, { '2026-08-04': [symptom('2026-08-04', 5)] })
    expect(marks.fatBars).toEqual([])
    expect(marks.fatMax).toBeNull()
  })

  it('scales bars against the window maximum, growing up from the zero line', () => {
    const marks = marksFor(
      5,
      {},
      {
        '2026-08-04': [foodEntry('2026-08-04', 40)],
        '2026-08-03': [foodEntry('2026-08-03', 20)],
      },
    )

    expect(marks.fatMax).toBe(40)
    const tall = marks.fatBars.find((bar) => bar.dateKey === TODAY)
    const short = marks.fatBars.find((bar) => bar.dateKey === '2026-08-03')

    expect(short?.height).toBeCloseTo((tall?.height as number) / 2)
    expect((tall?.y as number) + (tall?.height as number)).toBeCloseTo(marks.axis.zeroY)
  })

  it('does not emit a bar of height zero for a day logged at 0 grams', () => {
    // A fat free day is a real logged day, but a zero height bar is invisible
    // and indistinguishable from an unlogged one, so it must not be the only
    // thing marking it. The bar is absent; the day is not hatched either,
    // because she did log that day.
    const marks = marksFor(5, {}, { '2026-08-04': [foodEntry('2026-08-04', 0)] })

    expect(marks.gaps.map((gap) => gap.dateKey)).not.toContain(TODAY)
    for (const bar of marks.fatBars) expect(bar.height).toBeGreaterThan(0)
  })
})

describe('markers', () => {
  it('carries the entry count so a busy day can be drawn heavier', () => {
    const log: SymptomLog = {
      '2026-08-04': [symptom('2026-08-04', 5, 'a'), symptom('2026-08-04', 7, 'b')],
    }
    const marks = marksFor(5, log)
    expect(marks.painPoints.at(0)?.eventCount).toBe(2)
    expect(marks.painPoints.at(0)?.pain).toBe(7)
  })

  it('centres marks in their column', () => {
    const marks = marksFor(5, { '2026-08-04': [symptom('2026-08-04', 5)] })
    const column = marks.columns.find((c) => c.dateKey === TODAY)
    expect(marks.painPoints.at(0)?.cx).toBeCloseTo(column?.center as number)
  })
})

describe('degenerate inputs', () => {
  it('survives an empty window without dividing by zero', () => {
    const marks = buildMarks(buildWindow([], {}, {}))
    expect(marks.columns).toEqual([])
    expect(marks.gaps).toEqual([])
    expect(marks.dayLabels).toEqual([])
  })

  it('survives a box with no room to draw in', () => {
    const marks = buildMarks(buildWindow(windowSpan(5, TODAY), {}, {}), {
      ...DEFAULT_BOX,
      width: 10,
      height: 10,
    })
    for (const gap of marks.gaps) {
      expect(Number.isFinite(gap.height)).toBe(true)
      expect(gap.height).toBeGreaterThanOrEqual(0)
    }
  })

  it('clamps an out of range pain rather than drawing outside the band', () => {
    // hydrateSymptomLog rejects these, so this is belt and braces for a value
    // arriving from somewhere else.
    const marks = marksFor(5, { '2026-08-04': [symptom('2026-08-04', 99)] })
    expect(marks.painPoints.at(0)?.cy).toBeCloseTo(marks.axis.plotTop)
  })
})
