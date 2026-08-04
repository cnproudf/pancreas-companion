/**
 * INVARIANT 1, FOR THE HALF FlareGate CANNOT COVER, and invariant 7 in the real
 * tree. Phase 11.
 *
 * FlareGate.test.tsx proves that nothing food-bearing RENDERS while triage is
 * unanswered. It cannot prove that nothing food-bearing is IN FLIGHT, because it
 * never awaits: every one of its assertions runs synchronously after a click, so
 * a fetch started a moment before the mode changed would resolve after the suite
 * had already finished looking.
 *
 * That gap is the one this file fills, and it is a real gap rather than a
 * theoretical one. A request does not care that its component unmounted. Without
 * the guards in useAiLookup.ts, a lookup started on the food tab and answered
 * four seconds later would call setState on a screen that is now the red flag
 * check, and the only reason nothing appeared would be that React had thrown the
 * subtree away. That is luck, not enforcement.
 *
 * These tests deliberately resolve the fetch AFTER entering flare mode.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.tsx'
import { AI_COPY } from '../lib/aiAdvice.ts'
import { FOODS } from '../lib/foods.ts'
import * as storage from '../lib/storage.ts'
import { SETTINGS_STORAGE_KEY } from '../state/settingsModel.ts'

/** Nothing in the 211 scores against this, so the screen lands on near-miss. */
const UNKNOWN_FOOD = 'zzyzx casserole'

const WORKER_BODY = {
  rating: 'yellow',
  estimatedFatGrams: 14,
  servingAssumed: 'one serving',
  reasoning: 'Casseroles are usually built on cheese or cream, so this is a guess on the high side.',
  modifications: ['Ask whether it is made with milk rather than cream'],
  confidence: 'low',
  source: 'ai-estimate',
}

/** A fetch whose response this test decides when to deliver. */
function deferredFetch() {
  let deliver: (body: unknown) => void = () => {}
  const ready = new Promise<unknown>((resolve) => {
    deliver = resolve
  })

  const fetchMock = vi.fn(async () => {
    const body = await ready
    return { ok: true, status: 200, json: async () => body } as unknown as Response
  })

  return { fetchMock, deliver: (body: unknown) => deliver(body) }
}

function seedTarget() {
  storage.set(SETTINGS_STORAGE_KEY, {
    schemaVersion: 1,
    dailyFatTarget: 40,
    currentMode: 'stable',
  })
}

function selectMode(label: 'Feeling good' | 'A bad time') {
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(label) }))
}

function typeUnknownFood() {
  fireEvent.change(screen.getByLabelText(/What are you thinking about eating/), {
    target: { value: UNKNOWN_FOOD },
  })
}

let warn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  seedTarget()
})

afterEach(() => {
  storage.remove(SETTINGS_STORAGE_KEY)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the AI lookup and the flare gate', () => {
  it('offers the lookup only once the local dataset has come up empty', () => {
    vi.stubGlobal('fetch', vi.fn())
    render(<App />)

    // Idle. Nothing has been searched, so there is nothing to look up.
    expect(screen.queryByRole('button', { name: AI_COPY.lookupAction })).toBeNull()

    // A LOCAL HIT. The button must not appear: 211 hand authored entries beat a
    // model's guess at the same food, and asking anyway would spend a request to
    // second guess them.
    fireEvent.change(screen.getByLabelText(/What are you thinking about eating/), {
      target: { value: (FOODS[0] as { name: string }).name },
    })
    expect(screen.queryByRole('button', { name: AI_COPY.lookupAction })).toBeNull()

    typeUnknownFood()
    expect(screen.getByRole('button', { name: AI_COPY.lookupAction })).toBeDefined()
  })

  it('never calls the Worker while triage is unanswered', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

    typeUnknownFood()
    selectMode('A bad time')

    // The button is gone with the rest of the screen, so there is nothing to
    // click. The assertion that matters is the one below it: even the payload
    // was never built.
    expect(screen.queryByRole('button', { name: AI_COPY.lookupAction })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  /*
   * THE TEST THIS FILE EXISTS FOR.
   */
  it('discards a response that arrives after flare mode began', async () => {
    const { fetchMock, deliver } = deferredFetch()
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

    typeUnknownFood()
    fireEvent.click(screen.getByRole('button', { name: AI_COPY.lookupAction }))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // She switches to flare mode with the request still in the air.
    selectMode('A bad time')

    // The Worker answers anyway. It does not know or care what the app is doing.
    deliver(WORKER_BODY)
    await Promise.resolve()
    await Promise.resolve()

    expect(screen.getByTestId('redflag-check')).toBeDefined()

    const text = (document.body.textContent ?? '').toLowerCase()
    expect(text).not.toContain('casserole')
    expect(text).not.toContain(AI_COPY.heading.toLowerCase())
    // A gram count is food guidance even when no food is named. Same regex as
    // FlareGate.test.tsx.
    expect(text).not.toMatch(/\b\d+(?:\.\d+)?\s?g(?:rams)?\b/)
  })

  it('does not repaint the discarded answer when triage later clears', async () => {
    const { fetchMock, deliver } = deferredFetch()
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

    typeUnknownFood()
    fireEvent.click(screen.getByRole('button', { name: AI_COPY.lookupAction }))
    selectMode('A bad time')
    deliver(WORKER_BODY)
    await Promise.resolve()
    await Promise.resolve()

    // Answers the red flag check, which reopens the app.
    fireEvent.click(screen.getByRole('button', { name: 'No, but I feel off' }))

    // The question she asked belonged to a different moment. It must not surface
    // now as though she had just asked it.
    expect(screen.queryByText(AI_COPY.heading)).toBeNull()
  })
})

describe('the AI lookup, in the working case', () => {
  it('renders the estimate under the local near miss list, never instead of it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => WORKER_BODY,
      })),
    )
    render(<App />)

    typeUnknownFood()
    fireEvent.click(screen.getByRole('button', { name: AI_COPY.lookupAction }))

    await waitFor(() => expect(screen.getByText(AI_COPY.heading)).toBeDefined())

    // Invariant 7's positive half: the local answer is still there.
    expect(screen.getByRole('heading', { name: 'Not in my list yet' })).toBeDefined()
    // Labelled an estimate, next to the number.
    expect(screen.getByText(/14/)).toBeDefined()
    expect(screen.getByText(new RegExp(AI_COPY.gramsNote))).toBeDefined()

    /*
     * INVARIANT 8, and the reconciliation rule, in one assertion.
     *
     * The rating is a WORD next to the icon, not a colour on its own. And the
     * word is "Red" although the Worker said yellow: 14 grams against a 40 gram
     * target is past the yellow threshold, so the local engine said red and the
     * model does not get to lower it. It does not know her budget. The engine
     * does.
     */
    expect(screen.getByText('Red')).toBeDefined()
    expect(screen.queryByText('Yellow')).toBeNull()
  })

  /*
   * INVARIANT 7. Every one of these leaves the screen exactly as it was, with
   * the local near miss list and no trace that anything was attempted.
   */
  it.each([
    ['a 403 from an origin that is not allowed', { ok: false, status: 403 }],
    ['a 500', { ok: false, status: 500 }],
  ])('shows her nothing at all after %s', async (_label, response) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ...response, json: async () => ({ error: 'no' }) })),
    )
    render(<App />)

    typeUnknownFood()
    fireEvent.click(screen.getByRole('button', { name: AI_COPY.lookupAction }))

    await waitFor(() => expect(warn).toHaveBeenCalled())

    expect(screen.queryByText(AI_COPY.heading)).toBeNull()
    expect(screen.queryByText(AI_COPY.pending)).toBeNull()
    expect(screen.getByRole('heading', { name: 'Not in my list yet' })).toBeDefined()
    // No error, no apology, no retry prompt. The word "sorry" and the word
    // "error" must not be anywhere on this screen.
    expect(document.body.textContent).not.toMatch(/sorry|error|failed|try again/i)
  })

  it('shows her nothing at all when the model writes copy the guards refuse', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          ...WORKER_BODY,
          reasoning: 'You should skip this one, it sounds like pancreatitis.',
        }),
      })),
    )
    render(<App />)

    typeUnknownFood()
    fireEvent.click(screen.getByRole('button', { name: AI_COPY.lookupAction }))

    await waitFor(() => expect(warn).toHaveBeenCalled())

    // A refused result and a dead Worker are the same screen, on purpose.
    expect(screen.queryByText(AI_COPY.heading)).toBeNull()
    expect(document.body.textContent).not.toContain('pancreatitis')
  })

  it('drops the result when her query changes underneath it', async () => {
    const { fetchMock, deliver } = deferredFetch()
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

    typeUnknownFood()
    fireEvent.click(screen.getByRole('button', { name: AI_COPY.lookupAction }))

    fireEvent.change(screen.getByLabelText(/What are you thinking about eating/), {
      target: { value: 'qqqxyz stew' },
    })

    deliver(WORKER_BODY)
    await Promise.resolve()
    await Promise.resolve()

    // An answer to the previous question is a wrong answer to this one.
    expect(screen.queryByText(AI_COPY.heading)).toBeNull()
  })
})
