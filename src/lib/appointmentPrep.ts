/**
 * The appointment prep export. Spec section 5.6, as amended by addendum
 * section B.
 *
 * "One button: 'I have a doctor visit coming up.' Generates a clean, printable
 * one-page summary." The addendum adds the part that shapes this whole module:
 * "the summary reports the number of entries and the date range covered, and
 * states plainly that this reflects logged events only."
 *
 * THIS MODULE DOES NO ARITHMETIC, AND THAT IS THE DESIGN RATHER THAN AN
 * ACCIDENT OF HOW IT WAS WRITTEN.
 *
 * The pattern view is something she reads about herself. This is something a
 * gastroenterologist reads and acts on, which makes it the highest stakes
 * rendering of invariant 5 in the app. If a statistic here loses its
 * denominator, or a stretch she did not log reads as a quiet stretch, the app
 * has told her doctor something false in a format that carries authority.
 *
 * So there is no division, no rounding, and no counting below this line. Every
 * number comes out of `summarize` and `findPatterns` in patterns.ts, and every
 * sentence reporting a number is one of the `*Text` helpers already used by the
 * pattern view. The printed page and the on screen chart therefore state the
 * same denominators, from the same strings, by construction rather than by
 * anyone remembering to keep them in step.
 *
 * If this page ever needs a number patterns.ts does not have, it goes in
 * `summarize`, next to the comment explaining that daysLogged is the only
 * denominator. That is where daysWithSymptomsLogged and malabsorptionEntries
 * went in this phase, and it is the reason they are not here.
 *
 * WHAT IS NEW HERE IS COPY, and every statistic sentence below names what it is
 * out of. appointmentPrep.test.ts runs the five copy guards over all of it and
 * asserts that each statistic line contains "you logged", the same pair of
 * checks patterns.test.ts runs over PATTERN_COPY.
 *
 * Pure module. No React, no storage.
 */

import { formatDayFull } from './days.ts'
import { computeFatTarget } from './fatTarget.ts'
import type { FoodLog } from './foodLog.ts'
import {
  buildWindow,
  daysLineText,
  fatLineText,
  findPatterns,
  hardDaysLineText,
  hardestLineText,
  painLineText,
  PATTERN_COPY,
  spanFor,
  summarize,
  type LoggedSummary,
  type PatternFindings,
  type WindowChoice,
} from './patterns.ts'
import { SYMPTOM_COPY, type SymptomLog } from './symptomLog.ts'
import { SOURCE_ORIGIN } from './targetSource.ts'
import type { Settings } from '../types.ts'

/**
 * All prep sheet copy in one place, the way PATTERN_COPY and STAPLES_COPY do it.
 *
 * Note which lines are NOT here. The pain, worst pain, fat, entry count,
 * correlation framing and correlation items are all rendered from PATTERN_COPY
 * through the helpers below, deliberately unduplicated. A second wording of
 * "across the days you logged" is a second wording that can lose its
 * denominator in a rewrite.
 */
export const PREP_COPY = {
  /* Spec 5.6's words for the button. */
  openAction: 'I have a doctor visit coming up',

  title: 'For your appointment',

  /**
   * THE SENTENCE THIS PAGE TURNS ON. Addendum section B: the summary "states
   * plainly that this reflects logged events only."
   *
   * It sits directly under the date range and above every statistic, because a
   * clinician reads top to bottom and this has to reach them before any number
   * does. Two beats, no third clause: what this is, and what an empty day is
   * not. A longer version of the same point is a version that gets skimmed.
   */
  loggedOnly:
    'This shows only what was logged in the app. Days with nothing recorded are not days that went well, they are days with nothing recorded.',

  /** The window, gaps included. Deliberately not the same as the logged range. */
  coversLine: 'Covers {first} through {last}.',

  rangeLabel: 'How far back',

  nothingLogged:
    'There is nothing logged in this stretch, so there is nothing to summarize. The rest of the page is still yours to take with you.',

  statsTitle: 'What you logged',

  /*
   * Spec 5.6's "number of symptomatic days", denominated.
   *
   * Phrased as days she RECORDED symptoms rather than days she HAD them. The
   * second is a claim about her body, and this app cannot make one about a day
   * with no entry on it.
   */
  symptomaticLine: 'Of the {daysLogged} days you logged, {days} carried a symptom.',

  /* Spec 5.6's "any flagged malabsorption entries", denominated the same way. */
  malabsorptionLine:
    'The greasy, floating, or pale stool note is on {entries} of the {entryCount} entries you logged.',
  malabsorptionDaysLine: 'Those fall on {days} of the {daysLogged} days you logged.',
  malabsorptionNone:
    'Nothing you logged here carried the greasy, floating, or pale stool note.',

  /*
   * PHASE 11. WHERE THE FAT NUMBERS ON THIS PAGE CAME FROM.
   *
   * Most entries carry a gram value from the app's own list, which is hand
   * authored and openly approximate. Some now carry one a language model
   * estimated from a name she typed, because the list did not have that food.
   * Those are a weaker kind of number, and a clinician acting on a fat total has
   * a right to know how much of it is which.
   *
   * Denominated like every other statistic here, and rendered only when the
   * count is above zero, so a log with no estimates in it says nothing at all
   * rather than saying "0 of 12", which would invite the reading that estimates
   * are a thing she is doing wrong.
   */
  /*
   * Shaped like malabsorptionLine rather than like symptomaticLine, and for a
   * reason worth keeping: "Of the 1 food entries you logged, 1 carry" is
   * ungrammatical at a count of one, and a count of one is the common case here.
   * Putting the number after the verb makes the sentence read correctly at every
   * count without needing a plural rule.
   */
  aiEstimatedLine:
    'A fat value estimated from a description, rather than one from the app list, is on {entries} of the {foodEntryCount} food entries you logged.',
  aiEstimatedNote:
    'Those estimates come from a language model and were not measured. They are the ones worth checking.',

  targetTitle: 'Daily fat target',
  targetLine: '{grams} grams of fat.',
  targetNone:
    'No daily fat target is set in the app yet. This is the first question on the list below.',

  questionsTitle: 'Questions to ask',
  questionsIntro:
    'Yours to change. Take out anything you do not need, and add whatever you want to ask.',
  addLabel: 'Add a question',
  addPlaceholder: 'What do you want to ask?',
  addSubmit: 'Add it to the list',
  hide: 'Take out',
  restore: 'Put back',
  remove: 'Remove',
  hiddenTitle: 'Taken out',

  /* The blank ruled lines. For the ones she thinks of in the waiting room. */
  writeInTitle: 'Anything else you think of',

  nameLabel: 'Name for this printout',
  nameHint:
    'Optional. A name here appears at the bottom of every page, so a page that comes loose is not anonymous.',

  printAction: 'Print this, or save it as a PDF',
  /*
   * Page numbers come from the browser, not from this app. counter(page) is
   * only defined inside @page margin boxes and no browser implements those, so
   * promising "Page 1 of 2" in CSS would print nothing at all. See the note
   * above the print block in styles/theme.css.
   */
  printHint:
    'For page numbers, leave your browser’s "headers and footers" setting turned on.',
  closeAction: 'Close this',
} as const

/* -------------------------------------------------------------------------- */
/* Assembly                                                                    */
/* -------------------------------------------------------------------------- */

/** The daily target and where it came from, or null when none is set. */
export interface PrepTarget {
  line: string
  origin: string
}

export interface PrepDocument {
  /** The window covered, gaps and all. */
  coversLine: string
  /** True when the window holds nothing at all, in either series. */
  nothingLogged: boolean

  summary: LoggedSummary
  findings: PatternFindings

  /* Every one of these is a helper from patterns.ts, called, not rewritten. */
  daysLine: string
  entriesLine: string | null
  symptomaticLine: string | null
  painLine: string | null
  hardestLine: string | null
  fatLine: string | null
  hardDaysLine: string | null

  /** One of the two malabsorption sentences, always present. */
  malabsorptionLine: string
  /** The day breakdown, only when something carried the note. */
  malabsorptionDaysLine: string | null
  /** The plain sentence about what the note means. Only when it appears. */
  malabsorptionInfo: string | null

  /** Phase 11. Both null unless at least one entry carries an estimated value. */
  aiEstimatedLine: string | null
  aiEstimatedNote: string | null

  target: PrepTarget | null

  /**
   * The line repeated at the bottom of every printed page, so a page that comes
   * loose from the rest still says who it is about and what it covers.
   */
  footerLine: string
}

/**
 * Builds the document.
 *
 * Composes spanFor, buildWindow, summarize and findPatterns, and then formats.
 * It counts nothing itself, and the only numbers it touches are ones it is
 * substituting into a sentence that already names their denominator.
 */
export function buildPrep(
  choice: WindowChoice | 'all',
  symptomLog: SymptomLog,
  foodLog: FoodLog,
  todayKey: string,
  settings: Settings,
  printName: string,
): PrepDocument {
  const days = spanFor(choice, symptomLog, foodLog, todayKey)
  const window = buildWindow(days, symptomLog, foodLog)
  const summary = summarize(window)
  const findings = findPatterns(window, foodLog)

  const first = days.at(0) ?? todayKey
  const last = days.at(-1) ?? todayKey
  const range = PREP_COPY.coversLine
    .replace('{first}', formatDayFull(first))
    .replace('{last}', formatDayFull(last))

  const nothingLogged = summary.daysLogged === 0 && summary.daysWithFoodLogged === 0
  const flagged = summary.malabsorptionEntries > 0
  const anyEstimated = summary.aiEstimatedEntries > 0

  return {
    coversLine: range,
    nothingLogged,
    summary,
    findings,

    daysLine: daysLineText(summary, choice === 'all'),

    entriesLine:
      summary.entryCount > 0
        ? PATTERN_COPY.entriesLine.replace('{entryCount}', String(summary.entryCount))
        : null,

    symptomaticLine:
      summary.daysLogged > 0
        ? PREP_COPY.symptomaticLine
            .replace('{daysLogged}', String(summary.daysLogged))
            .replace('{days}', String(summary.daysWithSymptomsLogged))
        : null,

    painLine: summary.daysLogged > 0 ? painLineText(summary) : null,
    hardestLine: hardestLineText(summary),
    fatLine: fatLineText(summary),
    hardDaysLine: hardDaysLineText(findings.hardDays),

    malabsorptionLine: flagged
      ? PREP_COPY.malabsorptionLine
          .replace('{entries}', String(summary.malabsorptionEntries))
          .replace('{entryCount}', String(summary.entryCount))
      : PREP_COPY.malabsorptionNone,

    malabsorptionDaysLine: flagged
      ? PREP_COPY.malabsorptionDaysLine
          .replace('{days}', String(summary.daysWithMalabsorptionFlag))
          .replace('{daysLogged}', String(summary.daysLogged))
      : null,

    /* The one plain sentence, from the sheet that collects the chip. */
    malabsorptionInfo: flagged ? SYMPTOM_COPY.stoolInfo : null,

    /*
     * Substitution only. Both numbers come out of summarize, and the sentence
     * they go into names its own denominator, which is the whole rule this
     * module is built on.
     */
    aiEstimatedLine: anyEstimated
      ? PREP_COPY.aiEstimatedLine
          .replace('{foodEntryCount}', String(summary.foodEntryCount))
          .replace('{entries}', String(summary.aiEstimatedEntries))
      : null,
    aiEstimatedNote: anyEstimated ? PREP_COPY.aiEstimatedNote : null,

    target: targetFor(settings),
    footerLine: footerLineFor(printName, first, last),
  }
}

/**
 * The target and its provenance, or null.
 *
 * Addendum section A is emphatic that a number she typed must never read as
 * guidance from her care team, and that the calculated estimate must never read
 * as a published number. On a page a clinician acts on, that distinction is the
 * difference between "confirm this" and "this is what you told her", so the
 * origin sentence is not optional and there is no branch here that omits it.
 */
function targetFor(settings: Settings): PrepTarget | null {
  const target = computeFatTarget(settings)
  if (target.source === 'incomplete') return null

  return {
    line: PREP_COPY.targetLine.replace('{grams}', String(target.grams)),
    origin: SOURCE_ORIGIN[target.source],
  }
}

/**
 * The running footer. Her name and the range, or the range alone.
 *
 * The name is optional and nothing in the app asks her for it, so the blank
 * case is the normal one rather than a degraded one. Either way the page says
 * what it covers, which is the part that keeps a loose second page meaningful.
 */
function footerLineFor(printName: string, first: string, last: string): string {
  const range = `${formatDayFull(first)} to ${formatDayFull(last)}`
  const name = printName.trim()
  return name === '' ? range : `${name}, ${range}`
}
