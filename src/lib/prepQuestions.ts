/**
 * The questions she brings to the appointment. Spec section 5.6:
 *
 *   "A questions section she can fill in beforehand, pre-seeded with useful
 *   ones (What is my target fat intake? Do I need pancreatic enzymes? Should I
 *   be checked for fat-soluble vitamin deficiencies? Should I see a registered
 *   dietitian?)"
 *
 * SEEDED AND EDITABLE, THE SAME SHAPE AS staples.ts, AND FOR THE SAME REASON.
 * Storage holds only the DIFF: which seeded questions she has hidden and which
 * ones she wrote herself. The four shipped questions stay in code, so improving
 * their wording later improves them for her rather than leaving a frozen copy
 * in her device forever.
 *
 * A seeded question is HIDDEN, never deleted, so it can come back. One she
 * wrote is removed outright. She wrote it, so she can unwrite it. Same rule and
 * same reasoning as staples.ts.
 *
 * The printed page also ends with WRITE_IN_LINES blank ruled lines. The list
 * here is for the questions she thinks of in advance; the blank lines are for
 * the ones she thinks of in the waiting room, and neither replaces the other.
 *
 * NOTHING HERE COUNTS ANYTHING OR NAGS. There is no "you have not added any
 * questions", no suggestion that four is too few, and no completion state. It
 * is a list she may leave exactly as it came.
 *
 * Invariant 3: localStorage only, through storage.ts. Nothing here throws.
 */

import { newId } from './ids.ts'
import * as storage from './storage.ts'
import { isNonEmptyString, isRecord, isStringArray } from './validate.ts'

export const PREP_QUESTIONS_STORAGE_KEY = 'prepQuestions'

/**
 * Spec 5.6's four, verbatim.
 *
 * Phrased as she would ask them, first person, because she is the one reading
 * them off the page in the room. The app is not asking the doctor anything.
 */
export const SEED_QUESTIONS: readonly { id: string; text: string }[] = [
  { id: 'fat-target', text: 'What is my target fat intake?' },
  { id: 'enzymes', text: 'Do I need pancreatic enzymes?' },
  {
    id: 'fat-soluble-vitamins',
    text: 'Should I be checked for fat-soluble vitamin deficiencies?',
  },
  { id: 'dietitian', text: 'Should I see a registered dietitian?' },
]

/** Blank ruled lines printed under the list, for whatever she thinks of later. */
export const WRITE_IN_LINES = 4

/** One line on the list, after the seed and her edits are resolved. */
export interface PrepQuestion {
  id: string
  text: string
  /** True when she typed it. Hers to remove; seeded ones are hidden instead. */
  own: boolean
}

/** What storage actually holds: her edits, not the list. */
export interface PrepQuestionsState {
  /** Seeded ids she does not want to see. Never deleted, so they can come back. */
  hidden: string[]
  /** Questions she typed. */
  added: { id: string; text: string }[]
  /**
   * An optional name for the printed page, so a loose second page is not
   * anonymous. Blank is the default and is never treated as missing: nothing in
   * the app asks her for this, and the footer falls back to the date range.
   */
  printName: string
}

export const EMPTY_PREP_QUESTIONS: PrepQuestionsState = { hidden: [], added: [], printName: '' }

function hydrateAdded(raw: unknown): PrepQuestionsState['added'] {
  if (!Array.isArray(raw)) return []

  const seen = new Set<string>()
  const added: PrepQuestionsState['added'] = []

  for (const candidate of raw) {
    if (!isRecord(candidate)) continue
    if (!isNonEmptyString(candidate.id)) continue
    // Her own writing. A question with no text is not a question, so it goes.
    if (!isNonEmptyString(candidate.text)) continue
    if (seen.has(candidate.id)) continue

    seen.add(candidate.id)
    added.push({ id: candidate.id, text: candidate.text })
  }

  return added
}

/** Degrades one item at a time rather than blanking her list. */
export function hydratePrepQuestions(raw: unknown): PrepQuestionsState {
  if (!isRecord(raw)) return { ...EMPTY_PREP_QUESTIONS }

  return {
    hidden: isStringArray(raw.hidden) ? [...new Set(raw.hidden)] : [],
    added: hydrateAdded(raw.added),
    printName: typeof raw.printName === 'string' ? raw.printName : '',
  }
}

export function readPrepQuestions(): PrepQuestionsState {
  return hydratePrepQuestions(storage.get<unknown>(PREP_QUESTIONS_STORAGE_KEY, null))
}

/** False when the write did not stick. The caller decides whether to say so. */
export function writePrepQuestions(state: PrepQuestionsState): boolean {
  return storage.set(PREP_QUESTIONS_STORAGE_KEY, { schemaVersion: 1, ...state })
}

/** The list she sees: the seed minus what she hid, plus what she added. */
export function resolveQuestions(state: PrepQuestionsState): PrepQuestion[] {
  const hidden = new Set(state.hidden)

  return [
    ...SEED_QUESTIONS.filter((question) => !hidden.has(question.id)).map((question) => ({
      ...question,
      own: false,
    })),
    ...state.added.map((question) => ({ ...question, own: true })),
  ]
}

/** Seeded questions she has hidden, so the screen can offer them back. */
export function hiddenQuestions(state: PrepQuestionsState): { id: string; text: string }[] {
  const hidden = new Set(state.hidden)
  return SEED_QUESTIONS.filter((question) => hidden.has(question.id)).map(({ id, text }) => ({
    id,
    text,
  }))
}

/* -------------------------------------------------------------------------- */
/* Pure updates                                                                */
/* -------------------------------------------------------------------------- */

/** Adds a question she typed. A blank one is a no-op rather than a blank row. */
export function addQuestion(
  state: PrepQuestionsState,
  text: string,
  when: Date = new Date(),
): PrepQuestionsState {
  const trimmed = text.trim()
  if (trimmed === '') return state

  return { ...state, added: [...state.added, { id: newId(when), text: trimmed }] }
}

/** Hides a seeded question. NOT a delete: the id is remembered so it can return. */
export function hideQuestion(state: PrepQuestionsState, id: string): PrepQuestionsState {
  if (state.hidden.includes(id)) return state
  return { ...state, hidden: [...state.hidden, id] }
}

export function restoreQuestion(state: PrepQuestionsState, id: string): PrepQuestionsState {
  if (!state.hidden.includes(id)) return state
  return { ...state, hidden: state.hidden.filter((value) => value !== id) }
}

/** Removes one of her own questions outright. She wrote it, so she can unwrite it. */
export function removeQuestion(state: PrepQuestionsState, id: string): PrepQuestionsState {
  return { ...state, added: state.added.filter((question) => question.id !== id) }
}

/** The name for the printed page. Trimmed, and blank is a valid value. */
export function setPrintName(state: PrepQuestionsState, name: string): PrepQuestionsState {
  return { ...state, printName: name.trim() }
}
