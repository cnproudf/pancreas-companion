/**
 * The pattern view's data layer. Addendum section B.
 *
 * INVARIANT 5 LIVES HERE, AND IT LIVES IN THE TYPES RATHER THAN IN THE CARE OF
 * WHOEVER TOUCHES THIS FILE NEXT.
 *
 * "Unlogged days render as GAPS in the pattern chart. Never as zeros, never as
 * green days, never as symptom-free days."
 *
 * The mechanism is the discriminated unions below. A day she did not log is a
 * `gap`, and a gap carries no numeric field at all. There is no zero on it to
 * read by accident, and code that reaches for a pain value or a gram value on
 * an unlogged day does not compile. That is the whole design: the failure is not
 * avoided, it is unrepresentable.
 *
 * Do not "simplify" these unions into one shape with nullable numbers. A
 * nullable number is one `?? 0` away from being a symptom-free day on a chart
 * her gastroenterologist is going to read.
 *
 * Three further rules the rest of this file exists to hold:
 *
 * 1. The two series are separate. A day can carry symptoms and no food, or food
 *    and no symptoms. Merging them into one day record forces one side to zero.
 * 2. daysLogged is the only denominator. windowDays exists to be named in a
 *    sentence, never divided by.
 * 3. An average with nothing to average is null, never 0.
 *
 * Pure module. No React, no storage.
 */

import { calendarSpan, formatDayLong, windowSpan } from './days.ts'
import { sumFat, type FoodLog } from './foodLog.ts'
import { CHIP_LABELS, type SymptomChip, type SymptomEntry, type SymptomLog } from './symptomLog.ts'

/**
 * The chip that spec 5.6 calls a flagged malabsorption entry.
 *
 * Read from SYMPTOM_CHIPS's union rather than written as a bare string, so
 * renaming the key in symptomLog.ts breaks the build here instead of quietly
 * reporting zero flagged entries forever.
 */
const MALABSORPTION_CHIP: SymptomChip = 'stool-greasy-floating-pale'

/* -------------------------------------------------------------------------- */
/* Day slots: the shape invariant 5 rests on                                   */
/* -------------------------------------------------------------------------- */

/**
 * One calendar day of symptom data.
 *
 * The `gap` variant deliberately has no `worstPain`, no `events`, and no count.
 * There is nothing on it to render as a number.
 *
 * `worstPain` is nullable on the LOGGED variant too, and that is a third state,
 * not a redundant one. She can log an entry and skip the slider, which is a real
 * event with no pain number attached. Three states, three renderings:
 *
 *   gap                      no entry that day        hatched column, no marker
 *   logged, worstPain null   logged, no number given  marker in the skipped strip
 *   logged, worstPain 0      logged "nothing right now"  marker on the 0 gridline
 *
 * The third one is why the second cannot borrow zero: the 0 gridline is taken by
 * a real observation.
 */
export type SymptomDay =
  | {
      kind: 'logged'
      dateKey: string
      events: SymptomEntry[]
      /** Her highest pain that day, or null if she gave no number at all. */
      worstPain: number | null
    }
  | { kind: 'gap'; dateKey: string }

/** One calendar day of logged fat. Same rule: a gap carries no grams. */
export type FatDay =
  | { kind: 'logged'; dateKey: string; grams: number; entryCount: number }
  | { kind: 'gap'; dateKey: string }

export interface PatternWindow {
  /** Every calendar day in the window, in order, including the empty ones. */
  days: string[]
  symptomDays: SymptomDay[]
  fatDays: FatDay[]
}

/**
 * Her highest pain that day, or null if no entry that day carried a number.
 *
 * Deliberately not a reduce with a 0 seed, which is the single most natural way
 * to write this and would report every skipped-slider day as a 0.
 */
function worstPainOf(entries: readonly SymptomEntry[]): number | null {
  const numbers = entries
    .map((entry) => entry.pain)
    .filter((pain): pain is number => pain !== null)

  if (numbers.length === 0) return null
  return Math.max(...numbers)
}

/**
 * Builds both series across a span of calendar days.
 *
 * The span comes from days.ts and is every day between the ends, NOT the keys
 * present in the logs. Deriving the axis from the logs would make an unlogged
 * day literally absent from the chart, which is a quieter version of the same
 * lie: the day would vanish rather than show as unknown.
 */
export function buildWindow(
  days: readonly string[],
  symptomLog: SymptomLog,
  foodLog: FoodLog,
): PatternWindow {
  const symptomDays: SymptomDay[] = days.map((dateKey) => {
    const events = symptomLog[dateKey]
    if (events === undefined || events.length === 0) return { kind: 'gap', dateKey }

    const sorted = [...events].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    return { kind: 'logged', dateKey, events: sorted, worstPain: worstPainOf(sorted) }
  })

  const fatDays: FatDay[] = days.map((dateKey) => {
    const entries = foodLog[dateKey]
    if (entries === undefined || entries.length === 0) return { kind: 'gap', dateKey }
    return { kind: 'logged', dateKey, grams: sumFat(entries), entryCount: entries.length }
  })

  return { days: [...days], symptomDays, fatDays }
}

/** The window selector. Calendar days back from today, inclusive of today. */
export const WINDOW_CHOICES = [
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
] as const

export type WindowChoice = (typeof WINDOW_CHOICES)[number]['days']

/**
 * The span for a chosen window, or for everything she has.
 *
 * "Everything" runs from her earliest logged day to today rather than from the
 * earliest to the latest, so the quiet stretch since her last entry is visible
 * as gaps rather than cropped off the end.
 */
export function spanFor(
  choice: WindowChoice | 'all',
  symptomLog: SymptomLog,
  foodLog: FoodLog,
  todayKey: string,
): string[] {
  if (choice !== 'all') return windowSpan(choice, todayKey)

  const keys = [...Object.keys(symptomLog), ...Object.keys(foodLog)].sort()
  const earliest = keys.at(0)
  if (earliest === undefined) return windowSpan(30, todayKey)
  if (earliest > todayKey) return windowSpan(30, todayKey)

  return calendarSpan(earliest, todayKey)
}

/* -------------------------------------------------------------------------- */
/* Summary: daysLogged is the only denominator                                 */
/* -------------------------------------------------------------------------- */

export interface LoggedSummary {
  /**
   * Calendar days in the window. Named in the sentence so she knows what she is
   * looking at, and NEVER used as a divisor. Dividing by this is the exact
   * failure invariant 5 describes: it would dilute every average toward zero in
   * proportion to how little she logged, and read as improvement.
   */
  windowDays: number

  /** Days carrying at least one entry. The only denominator in this object. */
  daysLogged: number

  /** Days carrying a pain number, which is at most daysLogged. */
  daysWithPainNumber: number

  entryCount: number
  firstLoggedKey: string | null
  lastLoggedKey: string | null

  /**
   * Mean of her worst pain on each day that carried a number.
   *
   * Null when no day carried one. Not 0: an average of nothing is not zero, and
   * a 0 here would render as a calm month.
   */
  averagePainAcrossLoggedDays: number | null

  hardestLogged: { pain: number; dateKey: string } | null

  /** Days with food logged, and the mean grams across only those days. */
  daysWithFoodLogged: number
  averageFatAcrossLoggedDays: number | null

  /*
   * The two counts spec 5.6 asks the appointment export for, and they live here
   * rather than in appointmentPrep.ts on purpose.
   *
   * This object is where "daysLogged is the only denominator" is stated and
   * held. A second module counting days out of window.symptomDays would be a
   * second place where that rule has to be remembered, and the printed page a
   * clinician reads is the worst possible place for it to have been forgotten.
   * Both fields below are derived from the SAME `logged` array daysLogged is,
   * so neither can exceed its denominator and a gap day cannot reach them.
   */

  /**
   * Logged days where at least one entry carried a symptom chip. Spec 5.6's
   * "number of symptomatic days", and at most daysLogged.
   *
   * Note what this is not. It is not "days she had symptoms", which is a claim
   * about her body that this app cannot make about a day with no entry on it.
   * It is days she RECORDED symptoms, and the copy that renders it says so.
   */
  daysWithSymptomsLogged: number

  /** Entries carrying the greasy, floating, or pale stool chip. At most entryCount. */
  malabsorptionEntries: number

  /** Logged days carrying at least one such entry. At most daysLogged. */
  daysWithMalabsorptionFlag: number
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const total = values.reduce((running, value) => running + value, 0)
  return Math.round((total / values.length) * 10) / 10
}

export function summarize(window: PatternWindow): LoggedSummary {
  const logged = window.symptomDays.filter((day) => day.kind === 'logged')
  const withPain = logged.filter((day) => day.worstPain !== null)
  const fatLogged = window.fatDays.filter((day) => day.kind === 'logged')

  const hardest = withPain.reduce<{ pain: number; dateKey: string } | null>((worst, day) => {
    const pain = day.worstPain as number
    if (worst === null || pain > worst.pain) return { pain, dateKey: day.dateKey }
    return worst
  }, null)

  return {
    windowDays: window.days.length,
    daysLogged: logged.length,
    daysWithPainNumber: withPain.length,
    entryCount: logged.reduce((running, day) => running + day.events.length, 0),
    firstLoggedKey: logged.at(0)?.dateKey ?? null,
    lastLoggedKey: logged.at(-1)?.dateKey ?? null,
    averagePainAcrossLoggedDays: mean(withPain.map((day) => day.worstPain as number)),
    hardestLogged: hardest,
    daysWithFoodLogged: fatLogged.length,
    averageFatAcrossLoggedDays: mean(fatLogged.map((day) => day.grams)),

    daysWithSymptomsLogged: logged.filter((day) =>
      day.events.some((entry) => entry.symptoms.length > 0),
    ).length,

    malabsorptionEntries: logged.reduce(
      (running, day) =>
        running + day.events.filter((entry) => entry.symptoms.includes(MALABSORPTION_CHIP)).length,
      0,
    ),

    daysWithMalabsorptionFlag: logged.filter((day) =>
      day.events.some((entry) => entry.symptoms.includes(MALABSORPTION_CHIP)),
    ).length,
  }
}

/* -------------------------------------------------------------------------- */
/* Hardest logged days: a capped minority, selected by tie group               */
/* -------------------------------------------------------------------------- */

/**
 * The floor under the threshold, so a window where nothing went above a 3 does
 * not manufacture hard days out of an ordinary stretch.
 */
export const HARD_DAY_FLOOR = 4

/** Logged days carrying a pain number, below which no list is offered at all. */
export const MIN_DAYS_FOR_PATTERNS = 8

/** A food must appear this many times before it is worth naming. */
export const MIN_FOOD_APPEARANCES = 3

/**
 * The largest share of her logged days that may ever be called "hardest".
 *
 * At the MIN_DAYS_FOR_PATTERNS gate of 8 this is 2, and it guarantees at least
 * two thirds of her logged days survive as the counter-evidence every item is
 * compared against.
 */
export const HARD_DAY_SHARE = 1 / 3

/**
 * The 75th percentile, R-7 (linear interpolation), which is what most
 * implementations mean by "percentile".
 */
export function percentile75(values: readonly number[]): number | null {
  if (values.length === 0) return null

  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 1) return sorted[0] as number

  const position = (sorted.length - 1) * 0.75
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  const low = sorted[lower] as number
  const high = sorted[upper] as number

  return low + (high - low) * (position - lower)
}

export interface HardDays {
  /** The day keys selected. Empty when no honest group exists. */
  dateKeys: string[]
  /** The lowest pain in the selected group. Null when the group is empty. */
  threshold: number | null
}

/**
 * Her hardest logged days, or an empty group.
 *
 * WHY THIS IS NOT JUST "AT OR ABOVE THE 75TH PERCENTILE".
 *
 * At this sample size a bare percentile breaks on ties, and pain logs are full
 * of ties. With 8 logged days at [5,6,6,6,6,6,6,6] the 75th percentile is 6.0
 * and "at or above" selects 7 of 8 days. At [6,6,6,6,6,6,6,6] it selects all 8.
 * The floor does not help, because 6 clears it, and nearest-rank has the same
 * problem, so this is not fixed by picking a different percentile definition.
 *
 * That last case is the one that does real harm. If every logged day is a
 * hardest day then every food she ate lands in the list, and the counter-
 * evidence denominator collapses to zero because there are no other logged days
 * left to compare against. The guard that is supposed to stop her eliminating a
 * food she loves would be satisfied on paper while doing nothing.
 *
 * So: rank into tie groups, take whole groups highest first, and stop before
 * exceeding a cap of a third of her logged days. If the top tie group alone
 * exceeds the cap, return nothing. Splitting a tie would manufacture a
 * distinction that is not in the data, and "no clear hardest group" is the
 * honest answer for seven days that all sat at 6.
 */
export function hardestLoggedDays(window: PatternWindow): HardDays {
  const withPain = window.symptomDays.filter(
    (day): day is Extract<SymptomDay, { kind: 'logged' }> =>
      day.kind === 'logged' && day.worstPain !== null,
  )

  const empty: HardDays = { dateKeys: [], threshold: null }
  if (withPain.length < MIN_DAYS_FOR_PATTERNS) return empty

  const painValues = withPain.map((day) => day.worstPain as number)
  const percentile = percentile75(painValues)
  if (percentile === null) return empty

  const threshold = Math.max(percentile, HARD_DAY_FLOOR)
  const cap = Math.floor(withPain.length * HARD_DAY_SHARE)
  if (cap < 1) return empty

  /* Distinct pain values at or above the threshold, hardest first. */
  const distinct = [...new Set(painValues.filter((pain) => pain >= threshold))].sort(
    (a, b) => b - a,
  )

  const chosen: string[] = []
  let lowest: number | null = null

  for (const pain of distinct) {
    const group = withPain.filter((day) => day.worstPain === pain)
    // Whole groups only. Taking part of a tie invents a ranking.
    if (chosen.length + group.length > cap) break

    chosen.push(...group.map((day) => day.dateKey))
    lowest = pain
  }

  if (chosen.length === 0) return empty
  return { dateKeys: chosen.sort(), threshold: lowest }
}

/* -------------------------------------------------------------------------- */
/* Possible patterns                                                           */
/* -------------------------------------------------------------------------- */

/**
 * One food that showed up before her hardest logged days.
 *
 * beforeOtherDays IS REQUIRED, and that is the point of the type.
 *
 * The addendum: "A sample of one produces spurious associations constantly, and
 * the harm of her wrongly eliminating a food she loves is real." A list that
 * reports only the hits is the exact mechanism by which that harm happens. She
 * reads "chicken salad, 3 times before your worst days", stops eating chicken
 * salad, and never learns it also appeared on eleven ordinary days.
 *
 * Making the counter-count a required field means an item cannot be built
 * without it, so the balancing number cannot be dropped in a later refactor of
 * the rendering.
 */
export interface PossiblePattern {
  name: string
  /** Days in the hardest group where this appeared in the prior 24 hours. */
  beforeHardDays: number
  /** Other logged days where it appeared. The number that keeps her honest. */
  beforeOtherDays: number
}

export interface PatternFindings {
  /** Empty whenever there is not enough logged to say anything. */
  patterns: PossiblePattern[]
  hardDays: HardDays
  /** True when the gate stopped this before any comparison was made. */
  belowGate: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Distinct food names logged in the 24 hours before a moment.
 *
 * Anchored to a timestamp rather than to a calendar day, because "within 24
 * hours" of a 9am entry is mostly the previous evening, and a midnight to
 * midnight window would miss the dinner before it entirely while sweeping in a
 * dinner she ate hours after the pain started.
 *
 * Distinct per day: eating toast three times before one hard day is one day on
 * which toast appeared, not three. Counting servings would let a staple she eats
 * constantly outrank anything else purely by frequency.
 */
function foodsBefore(foodLog: FoodLog, anchorMs: number): Set<string> {
  const start = anchorMs - DAY_MS

  const names = new Set<string>()
  for (const entries of Object.values(foodLog)) {
    for (const entry of entries) {
      const when = Date.parse(entry.loggedAt)
      if (Number.isNaN(when)) continue
      if (when >= start && when <= anchorMs) names.add(entry.name)
    }
  }
  return names
}

/**
 * The moment a logged day is anchored on: her FIRST entry that day.
 *
 * The first entry is when she first said something was going on, so the 24
 * hours before it is the stretch worth looking at. Anchoring on the last entry
 * would drag in food she ate while already unwell.
 */
function anchorOf(day: Extract<SymptomDay, { kind: 'logged' }>): number | null {
  const first = day.events.at(0)
  if (first === undefined) return null

  const when = Date.parse(first.at)
  return Number.isNaN(when) ? null : when
}

/**
 * Foods that showed up before her hardest logged days, with the counter-count.
 *
 * Never causal, and the copy that renders this says so. This function only ever
 * reports co-occurrence counts; it has no notion of a cause and returns no
 * ranking beyond how often something appeared.
 *
 * The same anchoring rule is applied to hard days and to ordinary ones, which is
 * what makes the two counts comparable. If the hard days used one window and the
 * rest used another, the balancing number would be measuring something else and
 * would be worse than not showing it.
 */
export function findPatterns(window: PatternWindow, foodLog: FoodLog): PatternFindings {
  const hardDays = hardestLoggedDays(window)

  if (hardDays.dateKeys.length === 0) {
    const withPain = window.symptomDays.filter(
      (day) => day.kind === 'logged' && day.worstPain !== null,
    ).length
    return { patterns: [], hardDays, belowGate: withPain < MIN_DAYS_FOR_PATTERNS }
  }

  const hard = new Set(hardDays.dateKeys)
  const loggedDays = window.symptomDays.filter(
    (day): day is Extract<SymptomDay, { kind: 'logged' }> => day.kind === 'logged',
  )

  const counts = new Map<string, { hard: number; other: number }>()

  for (const day of loggedDays) {
    const anchor = anchorOf(day)
    if (anchor === null) continue

    const isHard = hard.has(day.dateKey)
    for (const name of foodsBefore(foodLog, anchor)) {
      const running = counts.get(name) ?? { hard: 0, other: 0 }
      if (isHard) running.hard += 1
      else running.other += 1
      counts.set(name, running)
    }
  }

  const patterns: PossiblePattern[] = [...counts.entries()]
    .filter(([, count]) => count.hard > 0)
    .filter(([, count]) => count.hard + count.other >= MIN_FOOD_APPEARANCES)
    .map(([name, count]) => ({
      name,
      beforeHardDays: count.hard,
      beforeOtherDays: count.other,
    }))
    .sort((a, b) => b.beforeHardDays - a.beforeHardDays || a.name.localeCompare(b.name))

  return { patterns, hardDays, belowGate: false }
}

/* -------------------------------------------------------------------------- */
/* Copy                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * All pattern view copy in one place, the way RATING_COPY and BUDGET_COPY do it.
 *
 * patterns.test.ts runs five guards over every string here: DASH_PATTERN
 * (invariant 9), SCOLDING_PATTERN (invariant 10), CALENDAR_RATE_PATTERN
 * (invariant 5 as prose), CAUSAL_PATTERN and OBLIGATION_PATTERN (addendum B).
 *
 * Note what the empty and gate lines do NOT say. Neither suggests she would get
 * more out of the app by logging more often, and neither carries a "yet", which
 * quietly frames the present as a shortfall against some state she is supposed
 * to reach. The gate line faults the LIST, not her.
 */
export const PATTERN_COPY = {
  title: 'What you have logged',

  empty:
    'Nothing logged here. What you record shows up here. There is no schedule and nothing to keep up.',

  /*
   * Every line reporting a statistic names its denominator in words, and
   * patterns.test.ts asserts that each one contains "you logged". A negative
   * guard catches the phrasings someone thought of; that positive assertion
   * catches the ones nobody did.
   */
  daysLine: 'You logged on {daysLogged} of the last {windowDays} days.',
  daysLineAll: 'You logged on {daysLogged} days, from {first} to {last}.',
  entriesLine: 'That is {entryCount} entries you logged in that time.',
  painLine: 'Across the days you logged a number, your pain averaged {average}.',
  painNoNumbers: 'No pain numbers in what you logged here, which is completely fine.',
  hardestLine: 'The highest you logged was {pain}, on {date}.',
  fatLine: 'Across the days you logged food, that came to about {average} grams.',

  /*
   * The gap legend. This is the sentence that keeps the chart honest, so it
   * says plainly what an empty column is and, just as plainly, what it is not.
   */
  gapLegend: 'No entry that day',
  gapExplainer:
    'Days with no entry are shown as blank hatched columns. They are not calm days or quiet days. They are days with nothing recorded, and the app does not guess at them.',

  painLegend: 'Pain you logged',
  skippedLegend: 'Logged, no pain number',
  fatLegend: 'Fat you logged',

  patternsTitle: 'Possible patterns worth mentioning to your doctor',
  patternsFraming:
    'These are things that showed up around the same time as each other in your own log. That is all they are. A log from one person cannot show what is behind anything, and the useful move is to bring this to your doctor rather than to act on it alone.',

  /*
   * The gate line. It faults the list rather than her, and offers nothing to
   * catch up on, because there is nothing she is behind on.
   */
  belowGate:
    'With this few days logged, a list here would be noise rather than a pattern. There is nothing to catch up on.',

  noHardGroup:
    'The pain you logged sits at much the same level throughout, so there is no harder group to compare the rest against.',

  hardDaysLine: 'Compared against the {count} hardest days you logged, the ones at {threshold} or above.',

  patternItem: '{name} shows up before {hard} of those. It also shows up on {other} other days you logged.',
  /*
   * The singular. Found in Phase 10 by reading the appointment export out loud:
   * "It also shows up on 1 other days you logged" was printing on the page that
   * goes to her gastroenterologist. The counter-evidence number is the one that
   * keeps this list honest, so the sentence carrying it should not be the one
   * that reads as a bug.
   */
  patternItemOneOther:
    '{name} shows up before {hard} of those. It also shows up on 1 other day you logged.',
  patternItemNoOthers: '{name} shows up before {hard} of those, and on no other day you logged.',

  historyTitle: 'Your entries',
  bareEntry: 'Logged, nothing else recorded.',
  noPainNumber: 'No pain number',
  attachedTitle: 'What you had attached',
} as const

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

/** The window line. Names both numbers, divides by neither. */
export function daysLineText(summary: LoggedSummary, isAllTime: boolean): string {
  if (isAllTime && summary.firstLoggedKey !== null && summary.lastLoggedKey !== null) {
    return PATTERN_COPY.daysLineAll
      .replace('{daysLogged}', String(summary.daysLogged))
      .replace('{first}', formatDayLong(summary.firstLoggedKey))
      .replace('{last}', formatDayLong(summary.lastLoggedKey))
  }

  return PATTERN_COPY.daysLine
    .replace('{daysLogged}', String(summary.daysLogged))
    .replace('{windowDays}', String(summary.windowDays))
}

export function painLineText(summary: LoggedSummary): string {
  if (summary.averagePainAcrossLoggedDays === null) return PATTERN_COPY.painNoNumbers

  return PATTERN_COPY.painLine.replace(
    '{average}',
    formatNumber(summary.averagePainAcrossLoggedDays),
  )
}

export function hardestLineText(summary: LoggedSummary): string | null {
  if (summary.hardestLogged === null) return null

  return PATTERN_COPY.hardestLine
    .replace('{pain}', String(summary.hardestLogged.pain))
    .replace('{date}', formatDayLong(summary.hardestLogged.dateKey))
}

export function fatLineText(summary: LoggedSummary): string | null {
  if (summary.averageFatAcrossLoggedDays === null) return null

  return PATTERN_COPY.fatLine.replace(
    '{average}',
    formatNumber(summary.averageFatAcrossLoggedDays),
  )
}

export function hardDaysLineText(hardDays: HardDays): string | null {
  if (hardDays.dateKeys.length === 0 || hardDays.threshold === null) return null

  return PATTERN_COPY.hardDaysLine
    .replace('{count}', String(hardDays.dateKeys.length))
    .replace('{threshold}', String(hardDays.threshold))
}

/** Always renders both counts. The type makes the second one unskippable. */
export function patternItemText(pattern: PossiblePattern): string {
  const template =
    pattern.beforeOtherDays === 0
      ? PATTERN_COPY.patternItemNoOthers
      : pattern.beforeOtherDays === 1
        ? PATTERN_COPY.patternItemOneOther
        : PATTERN_COPY.patternItem

  return template
    .replace('{name}', pattern.name)
    .replace('{hard}', String(pattern.beforeHardDays))
    .replace('{other}', String(pattern.beforeOtherDays))
}

/** The chip labels for one entry, in the vocabulary's order. */
export function chipLabels(symptoms: readonly SymptomChip[]): string[] {
  return symptoms.map((chip) => CHIP_LABELS[chip])
}
