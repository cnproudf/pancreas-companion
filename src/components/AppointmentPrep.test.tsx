/**
 * The appointment prep export, rendered. Spec section 5.6, addendum section B.
 *
 * lib/appointmentPrep.test.ts already proves the document is ASSEMBLED
 * correctly: the right numbers, the right denominators, no zeros for an empty
 * window. That is not the same claim as this one. What is checked here is what
 * actually reaches the page a gastroenterologist reads, in the real tree, with
 * the real providers and her real stored log, because a correct sentence that
 * never renders protects nobody.
 *
 * These tests drive the app the way she would: pick the tab, tap the button,
 * read the page.
 */

import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from '../App.tsx'
import { PREP_COPY } from '../lib/appointmentPrep.ts'
import { dateKey } from '../lib/days.ts'
import { PATTERN_COPY } from '../lib/patterns.ts'
import { PREP_QUESTIONS_STORAGE_KEY, SEED_QUESTIONS } from '../lib/prepQuestions.ts'
import {
  SYMPTOM_COPY,
  SYMPTOM_LOG_STORAGE_KEY,
  type SymptomEntry,
  type SymptomLog,
} from '../lib/symptomLog.ts'
import * as storage from '../lib/storage.ts'
import { SETTINGS_STORAGE_KEY } from '../state/settingsModel.ts'

afterEach(() => {
  storage.remove(SYMPTOM_LOG_STORAGE_KEY)
  storage.remove(PREP_QUESTIONS_STORAGE_KEY)
  storage.remove(SETTINGS_STORAGE_KEY)
})

/** Days back from today, so seeded entries always land inside every window. */
function daysAgo(days: number): Date {
  const when = new Date()
  when.setDate(when.getDate() - days)
  when.setHours(12, 0, 0, 0)
  return when
}

function entry(when: Date, pain: number | null, symptoms: SymptomEntry['symptoms'] = []): SymptomEntry {
  return {
    id: `s-${when.getTime()}-${pain ?? 'none'}`,
    at: when.toISOString(),
    pain,
    symptoms,
    note: '',
    attachedFoods: [],
  }
}

/** Seeds the symptom log before the app mounts, the way a returning visit is. */
function seedSymptoms(entries: readonly SymptomEntry[]): void {
  const log: SymptomLog = {}
  for (const item of entries) {
    const key = dateKey(new Date(item.at))
    log[key] = [...(log[key] ?? []), item]
  }
  storage.set(SYMPTOM_LOG_STORAGE_KEY, { schemaVersion: 1, days: log })
}

/** Patterns tab, then the one button spec 5.6 asks for. */
function openPrepSheet(): HTMLElement {
  fireEvent.click(screen.getByRole('tab', { name: 'How I have been' }))
  fireEvent.click(screen.getByRole('button', { name: PREP_COPY.openAction }))
  return screen.getByTestId('prep-sheet')
}

/* ========================================================================== */

describe('appointment prep, spec 5.6', () => {
  it('opens from one button on the Patterns tab', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('tab', { name: 'How I have been' }))
    expect(screen.queryByTestId('prep-sheet')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: PREP_COPY.openAction }))
    expect(screen.getByTestId('prep-sheet')).toBeDefined()
  })

  it('closes on the button and on Escape', () => {
    render(<App />)
    const sheet = openPrepSheet()

    fireEvent.click(within(sheet).getByRole('button', { name: PREP_COPY.closeAction }))
    expect(screen.queryByTestId('prep-sheet')).toBeNull()

    openPrepSheet()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('prep-sheet')).toBeNull()
  })

  /*
   * ADDENDUM SECTION B'S THREE ADDITIONS, ALL ON THE PAGE AND ALL ABOVE THE
   * STATISTICS. The date range, the entry count, and the plain statement that
   * this is logged events only.
   */
  it('states the range, the count, and that this is logged events only', () => {
    seedSymptoms([entry(daysAgo(1), 6), entry(daysAgo(3), 4), entry(daysAgo(3), 7)])
    render(<App />)
    const sheet = openPrepSheet()

    expect(within(sheet).getByText(PREP_COPY.loggedOnly)).toBeDefined()
    expect(within(sheet).getByText(/Covers .* through /)).toBeDefined()
    expect(within(sheet).getByText(/3 entries you logged/)).toBeDefined()
  })

  /*
   * The load bearing rendering assertion. Every statistic that reaches the page
   * names what it is out of, in words. The arithmetic is guarded in
   * patterns.ts and the wording in appointmentPrep.ts; this is the check that
   * both halves survived being put on screen together.
   */
  it('carries a denominator on every statistic that renders', () => {
    seedSymptoms([
      entry(daysAgo(1), 8, ['nausea']),
      entry(daysAgo(2), 4),
      entry(daysAgo(5), 6, ['stool-greasy-floating-pale']),
    ])
    render(<App />)
    const sheet = openPrepSheet()

    /* Each of spec 5.6's own statistics, each naming its denominator. */
    expect(within(sheet).getByText(/Of the 3 days you logged, 2 carried a symptom\./)).toBeDefined()
    expect(within(sheet).getByText(/Across the days you logged a number/)).toBeDefined()
    expect(within(sheet).getByText(/The highest you logged was 8/)).toBeDefined()
    expect(
      within(sheet).getByText(/stool note is on 1 of the 3 entries you logged/),
    ).toBeDefined()
  })

  /*
   * Spec 5.6's "any flagged malabsorption entries". Two tests rather than one,
   * because they are two different renderings and the absent case is the one
   * that would rot quietly: an explainer for a note that appears nowhere on the
   * page is a sentence about a symptom she never reported.
   */
  it('says plainly when nothing carried the stool note, with no explainer', () => {
    seedSymptoms([entry(daysAgo(1), 5)])
    render(<App />)
    const sheet = openPrepSheet()

    expect(within(sheet).getByText(PREP_COPY.malabsorptionNone)).toBeDefined()
    expect(within(sheet).queryByText(SYMPTOM_COPY.stoolInfo)).toBeNull()
  })

  it('counts the note and explains it in one plain sentence when it appears', () => {
    seedSymptoms([
      entry(daysAgo(1), 5, ['stool-greasy-floating-pale']),
      entry(daysAgo(2), 3),
    ])
    render(<App />)
    const sheet = openPrepSheet()

    expect(within(sheet).getByText(/stool note is on 1 of the 2 entries you logged/)).toBeDefined()
    expect(within(sheet).getByText(/Those fall on 1 of the 2 days you logged/)).toBeDefined()
    /* Reused from the sheet that collects the chip, not rewritten here. */
    expect(within(sheet).getByText(SYMPTOM_COPY.stoolInfo)).toBeDefined()
  })

  /*
   * INVARIANT 5, ON THE PAGE THAT GOES TO HER DOCTOR. An empty window says so
   * in words. It does not print a page of zeros, because a zero on a clinical
   * summary reads as an observation rather than as an absence.
   */
  it('says there is nothing logged rather than printing zeros', () => {
    render(<App />)
    const sheet = openPrepSheet()

    expect(within(sheet).getByText(PREP_COPY.nothingLogged)).toBeDefined()
    expect(within(sheet).queryByText(/averaged 0/)).toBeNull()
    expect(within(sheet).queryByText(/The highest you logged was 0/)).toBeNull()
    /* Still a usable page: the questions are the point of taking it in. */
    expect(within(sheet).getByText(SEED_QUESTIONS[0]?.text as string)).toBeDefined()
  })

  /* Invariant 2. Print hides the shell, so the sheet carries its own. */
  it('carries the disclaimer on the page itself', () => {
    render(<App />)
    const sheet = openPrepSheet()

    expect(within(sheet).getByText(/General information only/)).toBeDefined()
  })

  /*
   * The correlation framing travels with the correlations. This is the most
   * dangerous content in the app and it is more dangerous here than on the
   * pattern view, because a clinician may act on it.
   */
  it('keeps the never-causal framing above any food it names', () => {
    seedSymptoms([entry(daysAgo(1), 6)])
    render(<App />)
    const sheet = openPrepSheet()

    expect(within(sheet).getByText(PATTERN_COPY.patternsTitle)).toBeDefined()
    expect(within(sheet).getByText(PATTERN_COPY.patternsFraming)).toBeDefined()
  })
})

/* ========================================================================== */
/* The questions section                                                      */
/* ========================================================================== */

describe('the questions section', () => {
  it('pre-seeds the four questions spec 5.6 names', () => {
    render(<App />)
    const sheet = openPrepSheet()

    for (const question of SEED_QUESTIONS) {
      expect(within(sheet).getByText(question.text), question.id).toBeDefined()
    }
  })

  it('leaves blank lines for anything she thinks of later', () => {
    render(<App />)
    const sheet = openPrepSheet()

    expect(within(sheet).getByText(PREP_COPY.writeInTitle)).toBeDefined()
  })

  it('adds one of her own and keeps it', () => {
    render(<App />)
    const sheet = openPrepSheet()

    fireEvent.change(within(sheet).getByLabelText(PREP_COPY.addLabel), {
      target: { value: 'Should I get an MRCP?' },
    })
    fireEvent.click(within(sheet).getByRole('button', { name: PREP_COPY.addSubmit }))

    expect(within(sheet).getByText('Should I get an MRCP?')).toBeDefined()
    expect(storage.get<{ added?: unknown[] }>(PREP_QUESTIONS_STORAGE_KEY, {}).added).toHaveLength(1)
  })

  /*
   * Seeded questions hide rather than delete, so she can put one back.
   *
   * Asserted on the controls rather than on the text, because a hidden question
   * is still on screen: it moves to the "taken out" list so she can restore it.
   * Which list it is in is the actual claim, and the buttons say which.
   */
  it('takes a seeded question out and offers it back', () => {
    render(<App />)
    const sheet = openPrepSheet()
    const question = SEED_QUESTIONS[1]?.text as string

    fireEvent.click(within(sheet).getByRole('button', { name: `${PREP_COPY.hide}: ${question}` }))

    expect(
      within(sheet).queryByRole('button', { name: `${PREP_COPY.hide}: ${question}` }),
    ).toBeNull()
    expect(within(sheet).getByText(PREP_COPY.hiddenTitle)).toBeDefined()

    fireEvent.click(
      within(sheet).getByRole('button', { name: `${PREP_COPY.restore}: ${question}` }),
    )

    expect(
      within(sheet).getByRole('button', { name: `${PREP_COPY.hide}: ${question}` }),
    ).toBeDefined()
    expect(within(sheet).queryByText(PREP_COPY.hiddenTitle)).toBeNull()
  })
})

/* ========================================================================== */
/* The running footer                                                         */
/* ========================================================================== */

describe('the running footer', () => {
  /*
   * A second page that comes apart from the first has to say what it is. The
   * page number comes from the browser; the identification comes from here.
   */
  it('names the range on every page, and her name once she sets one', () => {
    render(<App />)
    const sheet = openPrepSheet()

    const footer = within(sheet).getByText(/to /, { selector: '[data-print-footer]' })
    expect(footer.textContent).not.toBe('')

    fireEvent.change(within(sheet).getByLabelText(PREP_COPY.nameLabel), {
      target: { value: 'Sam' },
    })

    expect(
      within(sheet).getByText(/^Sam, /, { selector: '[data-print-footer]' }),
    ).toBeDefined()
  })
})
