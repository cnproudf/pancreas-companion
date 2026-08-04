/**
 * Where every mark on the pattern chart goes. Pure arithmetic, no SVG.
 *
 * Split out from PatternChart.tsx the way budget.ts is split from
 * FatBudgetBar.tsx, and for a sharper reason than usual: invariant 5 is a claim
 * about geometry. "Unlogged days render as GAPS, never as zeros" is a statement
 * about where a mark is NOT placed, and the only way to test that properly is to
 * have the positions be values a test can look at rather than attributes on a
 * DOM node in a suite that does not run a DOM.
 *
 * Three rules this module holds, all of them checked in chartGeometry.test.ts:
 *
 * 1. A day with nothing logged produces a GapMark and no other mark. It is
 *    DRAWN as absent rather than left out. White space on a chart reads as
 *    "nothing happened", and an unlogged day is unknown, not calm.
 * 2. A day where she skipped the pain slider produces a SkippedPoint in a strip
 *    BELOW the axis rule, never a PainPoint at y(0). The 0 gridline is taken by
 *    a real observation: pain 0 means "nothing right now".
 * 3. A day with no food logged produces no FatBar at all, not a bar of height
 *    zero sitting on the axis.
 *
 * There is deliberately no line series and no path building anywhere in here.
 * Symptom events are discrete points per addendum B, so there is nothing that
 * could interpolate across a gap.
 */

import { formatDayShort } from './days.ts'
import { PAIN_MAX, PAIN_MIN } from './symptomLog.ts'
import type { PatternWindow } from './patterns.ts'

export interface ChartBox {
  width: number
  height: number
  padding: { top: number; right: number; bottom: number; left: number }
  /** Depth of the strip below the axis rule where skipped-pain marks sit. */
  stripHeight: number
  /** Clear space between the 0 gridline and the axis rule under it. */
  ruleGap: number
}

/**
 * A 4:3-ish box in viewBox units. Rendered with the default preserveAspectRatio
 * so it scales uniformly and the text does not stretch, unlike Ridgeline, which
 * is decoration and can afford to distort.
 */
export const DEFAULT_BOX: ChartBox = {
  width: 720,
  height: 300,
  padding: { top: 16, right: 16, bottom: 34, left: 34 },
  stripHeight: 26,
  ruleGap: 10,
}

export interface Column {
  dateKey: string
  /** Left edge. */
  x: number
  width: number
  /** Centre, which is where every mark in this column is anchored. */
  center: number
}

/** A day with nothing logged at all. Drawn, never merely omitted. */
export interface GapMark {
  dateKey: string
  x: number
  width: number
  /** Top of the hatched column. */
  y: number
  height: number
}

export interface FatBar {
  dateKey: string
  grams: number
  x: number
  width: number
  y: number
  height: number
}

export interface PainPoint {
  dateKey: string
  pain: number
  /** How many entries she made that day, for the marker's size. */
  eventCount: number
  cx: number
  cy: number
}

/** A logged day where she gave no pain number. Never at y(0). */
export interface SkippedPoint {
  dateKey: string
  eventCount: number
  cx: number
  cy: number
}

export interface DayLabel {
  dateKey: string
  x: number
  text: string
}

export interface ChartMarks {
  box: ChartBox
  columns: Column[]
  gaps: GapMark[]
  fatBars: FatBar[]
  painPoints: PainPoint[]
  skippedPoints: SkippedPoint[]
  dayLabels: DayLabel[]
  axis: {
    /** y for each labelled pain value, 0 and 10 at minimum. */
    painTicks: { pain: number; y: number }[]
    /** y of the 0 gridline. Pain 0 sits here. */
    zeroY: number
    /** y of the rule separating the pain band from the skipped strip. */
    ruleY: number
    /** y that skipped markers sit on, below the rule. */
    stripY: number
    plotLeft: number
    plotRight: number
    plotTop: number
  }
  /** The top of the fat scale, so the legend can name it. Null when no food. */
  fatMax: number | null
}

/** Pain values that get a gridline and a label. */
const PAIN_TICKS = [0, 5, 10] as const

/** Roughly how many date labels to show, whatever the window length. */
const TARGET_LABELS = 5

export function buildMarks(window: PatternWindow, box: ChartBox = DEFAULT_BOX): ChartMarks {
  const plotLeft = box.padding.left
  const plotRight = box.width - box.padding.right
  const plotTop = box.padding.top
  const plotWidth = Math.max(0, plotRight - plotLeft)

  /*
   * Vertical layout, top to bottom: the 0 to 10 pain band, a gap, the axis
   * rule, then the strip for logged days carrying no pain number. The strip is
   * BELOW the rule and outside the band on purpose. Above 10 would read as
   * worse than 10, and at 0 it would collide with a real observation.
   */
  const stripY = box.height - box.padding.bottom - box.stripHeight / 2
  const ruleY = box.height - box.padding.bottom - box.stripHeight
  const zeroY = ruleY - box.ruleGap
  const painHeight = Math.max(0, zeroY - plotTop)

  const dayCount = window.days.length
  const columnWidth = dayCount === 0 ? 0 : plotWidth / dayCount

  const columns: Column[] = window.days.map((dateKey, index) => {
    const x = plotLeft + index * columnWidth
    return { dateKey, x, width: columnWidth, center: x + columnWidth / 2 }
  })

  const columnFor = new Map(columns.map((column) => [column.dateKey, column]))

  /** Pain to y. 10 at the top, 0 on the zero gridline. */
  function painY(pain: number): number {
    const span = PAIN_MAX - PAIN_MIN
    const clamped = Math.min(Math.max(pain, PAIN_MIN), PAIN_MAX)
    return zeroY - ((clamped - PAIN_MIN) / span) * painHeight
  }

  /*
   * RULE 1. A day with nothing logged at all gets a hatched column.
   *
   * "Nothing at all" means no symptom entry AND no food. A day with food but no
   * symptom entry is not blank: its bar already shows the day was not empty, and
   * hatching it too would say something false. The absent pain point carries
   * that day's meaning on its own, and the screen reader table spells out the
   * difference in words.
   */
  const gaps: GapMark[] = []
  window.days.forEach((dateKey, index) => {
    const symptomDay = window.symptomDays[index]
    const fatDay = window.fatDays[index]
    if (symptomDay?.kind !== 'gap' || fatDay?.kind !== 'gap') return

    const column = columnFor.get(dateKey)
    if (column === undefined) return

    gaps.push({
      dateKey,
      x: column.x,
      width: column.width,
      y: plotTop,
      height: Math.max(0, zeroY - plotTop),
    })
  })

  /*
   * RULE 3. Fat is a light background series scaled to the window's own
   * maximum. Days with no food logged are simply not in this array, so there is
   * no zero height bar resting on the axis to be misread as "she ate nothing".
   */
  const loggedFat = window.fatDays.filter((day) => day.kind === 'logged')
  const fatMax = loggedFat.length === 0 ? null : Math.max(...loggedFat.map((day) => day.grams))

  const fatBars: FatBar[] = []
  if (fatMax !== null && fatMax > 0) {
    for (const day of loggedFat) {
      const column = columnFor.get(day.dateKey)
      if (column === undefined) continue

      const height = (day.grams / fatMax) * painHeight
      // Inset, so adjacent bars read as separate days rather than one block.
      const inset = Math.min(column.width * 0.18, 3)
      fatBars.push({
        dateKey: day.dateKey,
        grams: day.grams,
        x: column.x + inset,
        width: Math.max(0, column.width - inset * 2),
        y: zeroY - height,
        height,
      })
    }
  }

  /*
   * RULE 2. Logged days split by whether she gave a number, and the two land in
   * different places. Nothing here can put a skipped day on the 0 gridline.
   */
  const painPoints: PainPoint[] = []
  const skippedPoints: SkippedPoint[] = []

  for (const day of window.symptomDays) {
    if (day.kind !== 'logged') continue

    const column = columnFor.get(day.dateKey)
    if (column === undefined) continue

    if (day.worstPain === null) {
      skippedPoints.push({
        dateKey: day.dateKey,
        eventCount: day.events.length,
        cx: column.center,
        cy: stripY,
      })
    } else {
      painPoints.push({
        dateKey: day.dateKey,
        pain: day.worstPain,
        eventCount: day.events.length,
        cx: column.center,
        cy: painY(day.worstPain),
      })
    }
  }

  return {
    box,
    columns,
    gaps,
    fatBars,
    painPoints,
    skippedPoints,
    dayLabels: buildDayLabels(columns),
    axis: {
      painTicks: PAIN_TICKS.map((pain) => ({ pain, y: painY(pain) })),
      zeroY,
      ruleY,
      stripY,
      plotLeft,
      plotRight,
      plotTop,
    },
    fatMax,
  }
}

/**
 * A handful of date labels, evenly spaced, always including the last day.
 *
 * Labelling every column would be unreadable at 90 days and is not what the
 * axis is for: the marks carry the data, the labels only anchor it in time.
 */
function buildDayLabels(columns: readonly Column[]): DayLabel[] {
  if (columns.length === 0) return []

  const step = Math.max(1, Math.ceil(columns.length / TARGET_LABELS))
  const labels: DayLabel[] = []

  for (let index = columns.length - 1; index >= 0; index -= step) {
    const column = columns[index] as Column
    labels.unshift({
      dateKey: column.dateKey,
      x: column.center,
      text: formatDayShort(column.dateKey),
    })
  }

  return labels
}
