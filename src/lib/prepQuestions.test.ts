import { afterEach, describe, expect, it } from 'vitest'
import {
  addQuestion,
  EMPTY_PREP_QUESTIONS,
  hiddenQuestions,
  hideQuestion,
  hydratePrepQuestions,
  PREP_QUESTIONS_STORAGE_KEY,
  readPrepQuestions,
  removeQuestion,
  resolveQuestions,
  restoreQuestion,
  SEED_QUESTIONS,
  setPrintName,
  WRITE_IN_LINES,
  writePrepQuestions,
  type PrepQuestionsState,
} from './prepQuestions.ts'
import * as storage from './storage.ts'
import { DASH_PATTERN, OBLIGATION_PATTERN, SCOLDING_PATTERN } from '../test/copyInvariants.ts'

afterEach(() => {
  storage.remove(PREP_QUESTIONS_STORAGE_KEY)
})

function state(patch: Partial<PrepQuestionsState> = {}): PrepQuestionsState {
  return { ...EMPTY_PREP_QUESTIONS, ...patch }
}

describe('SEED_QUESTIONS', () => {
  /*
   * Spec 5.6 names these four. Asserted verbatim rather than by count, because
   * "pre-seeded with useful ones" plus a list is a list, and a reworded version
   * of the vitamin question is a different question in a room where she has ten
   * minutes.
   */
  it('carries spec 5.6 four, word for word', () => {
    expect(SEED_QUESTIONS.map((question) => question.text)).toEqual([
      'What is my target fat intake?',
      'Do I need pancreatic enzymes?',
      'Should I be checked for fat-soluble vitamin deficiencies?',
      'Should I see a registered dietitian?',
    ])
  })

  it('gives every seeded question a distinct id', () => {
    const ids = SEED_QUESTIONS.map((question) => question.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('leaves room for her own', () => {
    expect(WRITE_IN_LINES).toBeGreaterThan(0)
  })

  /*
   * Invariants 9 and 10, and addendum B's no-obligation rule, over the seeded
   * wording. These print on a page she hands to a doctor.
   */
  it('holds the copy invariants', () => {
    for (const question of SEED_QUESTIONS) {
      expect(question.text, question.id).not.toMatch(DASH_PATTERN)
      expect(question.text, question.id).not.toMatch(SCOLDING_PATTERN)
      expect(question.text, question.id).not.toMatch(OBLIGATION_PATTERN)
    }
  })
})

describe('hydratePrepQuestions', () => {
  it('returns the empty state for anything that is not a record', () => {
    for (const junk of [null, undefined, 42, 'nope', []]) {
      expect(hydratePrepQuestions(junk)).toEqual(EMPTY_PREP_QUESTIONS)
    }
  })

  it('drops only the damaged items, keeping the rest of her list', () => {
    const hydrated = hydratePrepQuestions({
      hidden: ['enzymes'],
      added: [
        { id: 'a', text: 'Is my B12 worth checking?' },
        { id: 'b' }, // no text, so not a question
        { text: 'no id' },
        { id: 'a', text: 'duplicate id' },
        'not a record',
      ],
      printName: 'Sam',
    })

    expect(hydrated.hidden).toEqual(['enzymes'])
    expect(hydrated.added).toEqual([{ id: 'a', text: 'Is my B12 worth checking?' }])
    expect(hydrated.printName).toBe('Sam')
  })

  it('treats a missing or non-string name as blank rather than as missing', () => {
    expect(hydratePrepQuestions({}).printName).toBe('')
    expect(hydratePrepQuestions({ printName: 7 }).printName).toBe('')
  })

  it('survives a round trip through storage', () => {
    const written = state({ hidden: ['dietitian'], added: [{ id: 'a', text: 'Ask about pain' }] })
    expect(writePrepQuestions(written)).toBe(true)

    const read = readPrepQuestions()
    expect(read.hidden).toEqual(['dietitian'])
    expect(read.added).toEqual([{ id: 'a', text: 'Ask about pain' }])
  })
})

describe('resolveQuestions', () => {
  it('shows the whole seed by default', () => {
    const resolved = resolveQuestions(EMPTY_PREP_QUESTIONS)

    expect(resolved).toHaveLength(SEED_QUESTIONS.length)
    expect(resolved.every((question) => !question.own)).toBe(true)
  })

  it('puts her own questions after the seeded ones', () => {
    const resolved = resolveQuestions(state({ added: [{ id: 'a', text: 'Mine' }] }))

    expect(resolved.at(-1)).toEqual({ id: 'a', text: 'Mine', own: true })
  })

  it('leaves out a hidden seeded question', () => {
    const resolved = resolveQuestions(state({ hidden: ['enzymes'] }))
    expect(resolved.map((question) => question.id)).not.toContain('enzymes')
  })
})

describe('pure updates', () => {
  it('adds a question she typed, trimmed', () => {
    const next = addQuestion(EMPTY_PREP_QUESTIONS, '  Should I get an MRCP?  ')
    expect(next.added.at(0)?.text).toBe('Should I get an MRCP?')
  })

  it('ignores a blank one rather than adding a blank row', () => {
    expect(addQuestion(EMPTY_PREP_QUESTIONS, '   ')).toBe(EMPTY_PREP_QUESTIONS)
  })

  /*
   * A seeded question is hidden, never deleted, so she can put it back. Her own
   * is removed outright: she wrote it, so she can unwrite it. Same rule and
   * same reasoning as staples.ts.
   */
  it('hides a seeded question without losing it', () => {
    const hiddenState = hideQuestion(EMPTY_PREP_QUESTIONS, 'dietitian')

    expect(hiddenQuestions(hiddenState).map((question) => question.id)).toEqual(['dietitian'])
    expect(resolveQuestions(restoreQuestion(hiddenState, 'dietitian'))).toHaveLength(
      SEED_QUESTIONS.length,
    )
  })

  it('removes one of her own outright', () => {
    const withHers = addQuestion(EMPTY_PREP_QUESTIONS, 'Mine')
    const id = withHers.added.at(0)?.id as string

    expect(removeQuestion(withHers, id).added).toHaveLength(0)
  })

  it('trims the print name and accepts blank as a real value', () => {
    expect(setPrintName(EMPTY_PREP_QUESTIONS, '  Sam  ').printName).toBe('Sam')
    expect(setPrintName(state({ printName: 'Sam' }), '').printName).toBe('')
  })
})
