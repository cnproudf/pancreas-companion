/**
 * The symptom log. Addendum section B, which REPLACES the daily journal in the
 * main spec.
 *
 * There is no daily prompt, no streak counter, and no "you missed a day."
 * Nothing in this module counts consecutive days, compares her to a schedule, or
 * knows what a missed day would even be. Those mechanics turn a health tool into
 * an obligation, and an obligation is the last thing she needs.
 *
 * The timestamp is the only required field. She can open the sheet, save
 * nothing, and close it, and that is a valid entry meaning "something was
 * happening here."
 *
 * Invariant 3: localStorage only, through storage.ts, which is the only module
 * allowed to touch it. Nothing here throws. A corrupted blob costs her one
 * entry, never the screen.
 */

import { DATE_KEY_PATTERN, dateKey } from './days.ts'
import type { FoodLog, FoodLogEntry } from './foodLog.ts'
import { newId } from './ids.ts'
import * as storage from './storage.ts'
import { isFiniteNumber, isNonEmptyString, isRecord } from './validate.ts'

export const SYMPTOM_LOG_STORAGE_KEY = 'symptomLog'

/**
 * Addendum section B, in the order it lists them. Stored as keys rather than
 * labels so the wording can be improved without rewriting her history.
 */
export const SYMPTOM_CHIPS = [
  'nausea',
  'vomiting',
  'bloating',
  'back-pain',
  'no-appetite',
  'fatigue',
  'fever-or-chills',
  'stool-greasy-floating-pale',
  'diarrhea',
  'other',
] as const

export type SymptomChip = (typeof SYMPTOM_CHIPS)[number]

export const CHIP_LABELS: Record<SymptomChip, string> = {
  nausea: 'Nausea',
  vomiting: 'Vomiting',
  bloating: 'Bloating',
  'back-pain': 'Back pain',
  'no-appetite': 'No appetite',
  fatigue: 'Fatigue',
  'fever-or-chills': 'Fever or chills',
  'stool-greasy-floating-pale': 'Greasy, floating, or pale stool',
  diarrhea: 'Diarrhea',
  other: 'Other',
}

/**
 * The pain scale. 0 is a real value meaning "nothing right now", which is
 * exactly why a day she did not log must never be drawn at 0. See patterns.ts.
 */
export const PAIN_MIN = 0
export const PAIN_MAX = 10

/**
 * All copy in one place so the tone can be reviewed at a glance, the way
 * RATING_COPY, BUDGET_COPY, and MEAL_COPY do it.
 *
 * Invariant 9: no em dashes. Invariant 10: never scold. Addendum B: nothing
 * here may imply she owes the app an entry, so there is no "don't forget", no
 * "keep it up", and no acknowledgement of a gap at all.
 */
export const SYMPTOM_COPY = {
  openButton: 'Log how I am feeling',
  sheetTitle: 'How are you doing?',
  sheetIntro:
    'Only the time is needed. Fill in as much or as little as you want, and close it whenever.',

  timeLabel: 'When',
  timeHint: 'Change this if you are recording something from earlier.',

  painLabel: 'Pain',
  painSkipped: 'No number given',
  painSkipAction: 'Skip this',
  painUnskipAction: 'Give a number',

  symptomsLabel: 'Anything going on?',
  noteLabel: 'Anything you want to note',
  notePlaceholder: 'Whatever is useful to you, or nothing at all.',

  /*
   * Addendum B: one plain sentence, no alarm, no color. It says what the sign
   * means and who to tell, and stops. Interpreting it further is When To Call's
   * job in Phase 9, and the app does not interpret symptoms at all.
   */
  stoolInfoLabel: 'What this one means',
  stoolInfo:
    'Stool that is greasy, floating, or pale can be a sign that fat is not being absorbed. It is worth telling your doctor about.',

  save: 'Save this',
  cancel: 'Close',
  saved: 'Saved.',
  savedAt: 'Saved for {time}.',
  undo: 'Undo',
  removed: 'Removed.',

  notPersisted:
    'This device is not letting the app save right now, so this may not be here next time.',
} as const

/**
 * A food she attached to a symptom entry.
 *
 * A SNAPSHOT, not a reference, for the same reason FoodLogEntry copies its name
 * and grams out of the dataset: this log is meant to be evidence for her doctor,
 * so it has to keep saying what was true at the time. It also means deleting a
 * row from the food log later cannot silently empty an attachment she made
 * months ago.
 */
export interface AttachedFood {
  /** The food log entry it came from. Provenance only, never resolved through. */
  sourceEntryId: string
  name: string
  servingDescription: string
  fatGrams: number
  /** ISO timestamp, copied from the food log entry. */
  loggedAt: string
}

export interface SymptomEntry {
  id: string
  /**
   * ISO timestamp. The only required field, and editable, so she can record
   * something from yesterday. The day it belongs to is derived from this.
   */
  at: string

  /**
   * Null means she skipped the slider. NEVER 0 for "skipped".
   *
   * This distinction is load bearing and is the reason the field is nullable
   * rather than defaulted. 0 means "no pain right now", which is a real
   * observation worth plotting. Collapsing the two would put every entry where
   * she did not feel like picking a number onto the bottom of the pain axis and
   * report it as a pain free moment.
   */
  pain: number | null

  /** Empty is valid and common. */
  symptoms: SymptomChip[]
  /** Hers. Free text, may be empty, never validated for content. */
  note: string
  /** Empty when she attached nothing, or when she logged during a flare. */
  attachedFoods: AttachedFood[]
}

/** What the sheet hands over. Everything except the id. */
export interface SymptomDraft {
  at: string
  pain: number | null
  symptoms: SymptomChip[]
  note: string
  attachedFoods: AttachedFood[]
}

/** Local date key, "YYYY-MM-DD", to the entries logged that day. */
export type SymptomLog = Record<string, SymptomEntry[]>

function isChip(value: unknown): value is SymptomChip {
  return typeof value === 'string' && (SYMPTOM_CHIPS as readonly string[]).includes(value)
}

/**
 * Pain, or null. Anything outside 0 to 10 becomes null rather than clamping.
 *
 * Clamping would invent a number she never gave. Null is the honest reading of
 * a damaged value, and null already has a defined rendering that is not zero.
 */
function hydratePain(raw: unknown): number | null {
  if (!isFiniteNumber(raw)) return null
  if (raw < PAIN_MIN || raw > PAIN_MAX) return null
  return Math.round(raw)
}

function hydrateAttached(raw: unknown): AttachedFood | null {
  if (!isRecord(raw)) return null
  if (!isNonEmptyString(raw.name)) return null
  // A negative would subtract from the day's total in the pattern view.
  if (!isFiniteNumber(raw.fatGrams) || raw.fatGrams < 0) return null

  return {
    sourceEntryId: isNonEmptyString(raw.sourceEntryId) ? raw.sourceEntryId : '',
    name: raw.name,
    servingDescription: isNonEmptyString(raw.servingDescription) ? raw.servingDescription : '',
    fatGrams: raw.fatGrams,
    loggedAt: isNonEmptyString(raw.loggedAt) ? raw.loggedAt : '',
  }
}

/**
 * One entry, or null if it is too damaged to keep.
 *
 * The bar is deliberately low: an id and a timestamp. Everything else has a
 * defined empty form, because the addendum says an entry carrying nothing but a
 * time is valid and means something was happening here. Dropping such an entry
 * because it had no pain number would delete exactly the entries made on the
 * days she was least able to fill anything in.
 */
function hydrateEntry(raw: unknown): SymptomEntry | null {
  if (!isRecord(raw)) return null
  if (!isNonEmptyString(raw.id)) return null
  if (!isNonEmptyString(raw.at)) return null
  if (Number.isNaN(Date.parse(raw.at))) return null

  return {
    id: raw.id,
    at: raw.at,
    pain: hydratePain(raw.pain),
    symptoms: Array.isArray(raw.symptoms) ? [...new Set(raw.symptoms.filter(isChip))] : [],
    note: typeof raw.note === 'string' ? raw.note : '',
    attachedFoods: Array.isArray(raw.attachedFoods)
      ? raw.attachedFoods
          .map(hydrateAttached)
          .filter((food): food is AttachedFood => food !== null)
      : [],
  }
}

/**
 * Turns whatever came out of storage into a usable log, dropping only the parts
 * that are actually damaged. Mirrors hydrateLog and hydrateSaved: a half
 * corrupted blob degrades one entry at a time instead of blanking her history.
 *
 * Duplicate ids are collapsed, and an entry filed under the wrong day is refiled
 * from its own timestamp rather than trusted, so a hand edited blob cannot put
 * an entry on a day the chart would then draw it on incorrectly.
 */
export function hydrateSymptomLog(raw: unknown): SymptomLog {
  const source = isRecord(raw) && isRecord(raw.days) ? raw.days : raw
  if (!isRecord(source)) return {}

  const log: SymptomLog = {}
  const seen = new Set<string>()

  for (const [key, value] of Object.entries(source)) {
    if (!DATE_KEY_PATTERN.test(key)) continue
    if (!Array.isArray(value)) continue

    for (const candidate of value) {
      const entry = hydrateEntry(candidate)
      if (entry === null) continue
      if (seen.has(entry.id)) continue
      seen.add(entry.id)

      const trueKey = dateKey(new Date(entry.at))
      log[trueKey] = [...(log[trueKey] ?? []), entry]
    }
  }

  return log
}

export function readSymptomLog(): SymptomLog {
  return hydrateSymptomLog(storage.get<unknown>(SYMPTOM_LOG_STORAGE_KEY, null))
}

/** False when the write did not stick. The caller decides whether to say so. */
export function writeSymptomLog(log: SymptomLog): boolean {
  return storage.set(SYMPTOM_LOG_STORAGE_KEY, { schemaVersion: 1, days: log })
}

export function makeEntry(draft: SymptomDraft, when: Date = new Date()): SymptomEntry {
  return {
    id: newId(when),
    at: draft.at,
    pain: draft.pain,
    symptoms: [...draft.symptoms],
    note: draft.note,
    attachedFoods: [...draft.attachedFoods],
  }
}

/** Pure. Files the entry under the day of its own timestamp. */
export function addEntry(log: SymptomLog, entry: SymptomEntry): SymptomLog {
  const key = dateKey(new Date(entry.at))
  return { ...log, [key]: [...(log[key] ?? []), entry] }
}

/**
 * Pure. Drops one entry, wherever it is filed.
 *
 * Scans rather than taking a day key, because the only id the UI has is the
 * entry's own, and an entry whose timestamp was edited across midnight is no
 * longer on the day the list thought it was. A day that empties is deleted
 * outright, since hydrateSymptomLog drops empty days on the way back in and a
 * write then read round trip should not change the shape of the log.
 */
export function removeEntry(log: SymptomLog, id: string): SymptomLog {
  const next: SymptomLog = {}
  let found = false

  for (const [key, entries] of Object.entries(log)) {
    const kept = entries.filter((entry) => entry.id !== id)
    if (kept.length !== entries.length) found = true
    if (kept.length > 0) next[key] = kept
  }

  return found ? next : log
}

/**
 * Pure. Replaces one entry's contents, keeping its id.
 *
 * Removes and re-adds rather than mapping in place, because editing the
 * timestamp can move the entry to a different day and leaving it filed under
 * the old one would put it on the wrong column of the chart.
 */
export function updateEntry(log: SymptomLog, id: string, draft: SymptomDraft): SymptomLog {
  const existing = findEntry(log, id)
  if (existing === null) return log

  return addEntry(removeEntry(log, id), {
    id: existing.id,
    at: draft.at,
    pain: draft.pain,
    symptoms: [...draft.symptoms],
    note: draft.note,
    attachedFoods: [...draft.attachedFoods],
  })
}

export function findEntry(log: SymptomLog, id: string): SymptomEntry | null {
  for (const entries of Object.values(log)) {
    const found = entries.find((entry) => entry.id === id)
    if (found !== undefined) return found
  }
  return null
}

export function entriesFor(log: SymptomLog, key: string): SymptomEntry[] {
  return [...(log[key] ?? [])].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}

/** Every entry, newest first. What the history list renders. */
export function allEntries(log: SymptomLog): SymptomEntry[] {
  return Object.values(log)
    .flat()
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

/**
 * True when the entry carries nothing but its timestamp.
 *
 * Not used to reject anything. The addendum is explicit that such an entry is
 * valid and means "something was happening here", so this exists only so the
 * history list can render it with words instead of an empty row.
 */
export function isBareEntry(entry: SymptomEntry): boolean {
  return (
    entry.pain === null &&
    entry.symptoms.length === 0 &&
    entry.note.trim() === '' &&
    entry.attachedFoods.length === 0
  )
}

/** How far back the attach list reaches. Addendum B: the last 24 hours. */
export const ATTACH_WINDOW_HOURS = 24

/**
 * The food log entries within the 24 hours BEFORE the given moment.
 *
 * Anchored to the entry's own timestamp rather than to now, and this is the
 * detail that makes the flare seam work. AttachFoodSection carries a flare guard
 * and renders nothing while the gate is closed, so on a bad day she logs the
 * symptom without attaching. Anchoring here means that when she opens that same
 * entry later, from outside flare mode, the list she is offered is still the 24
 * hours around when she actually felt unwell. The attachment is deferred, not
 * lost.
 *
 * Reaches across day keys on purpose. "The last 24 hours" from a 9am entry is
 * mostly yesterday.
 */
export function foodsInAttachWindow(foodLog: FoodLog, at: string): FoodLogEntry[] {
  const end = Date.parse(at)
  if (Number.isNaN(end)) return []

  const start = end - ATTACH_WINDOW_HOURS * 60 * 60 * 1000

  return Object.values(foodLog)
    .flat()
    .filter((entry) => {
      const when = Date.parse(entry.loggedAt)
      return !Number.isNaN(when) && when >= start && when <= end
    })
    .sort((a, b) => Date.parse(b.loggedAt) - Date.parse(a.loggedAt))
}

/** Snapshots a food log entry for attachment. Copies, never references. */
export function attachFood(entry: FoodLogEntry): AttachedFood {
  return {
    sourceEntryId: entry.id,
    name: entry.name,
    servingDescription: entry.servingDescription,
    fatGrams: entry.fatGrams,
    loggedAt: entry.loggedAt,
  }
}
