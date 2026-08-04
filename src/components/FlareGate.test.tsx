/**
 * INVARIANT 1, END TO END. THIS IS THE TEST THAT PROVES IT.
 *
 * "Flare mode opens the triage screen BEFORE any food content. Always."
 *
 * CLAUDE.md carried that invariant as structural-but-unverified from Phase 1 to
 * Phase 9, because until the triage screen existed there was nothing to verify
 * it against. This file is the answer, and it is deliberately not a unit test.
 * lib/triage.test.ts already proves the POLICY is defined correctly;
 * foodGuidanceAllowed returns the right booleans. That is not the same claim.
 * The claim here is that the policy is APPLIED correctly, by every component
 * that renders, in the real tree, with the real providers. A rule about what
 * appears on a screen can only be checked by rendering the screen.
 *
 * So these tests mount the actual <App />. No stubs, no shallow rendering, no
 * mocked providers. If a future change mounts something food-bearing above the
 * gate, this suite is what catches it, and catching it is the whole point.
 *
 * THREE THINGS ARE ALLOWED ABOVE THE GATE, and the suite knows about all three:
 *
 *   DailyLift      no food guidance, and it is the one thing she should still
 *                  see on her worst day
 *   LogFeelingBar  no food guidance; pain, chips, and a note are not food, and
 *                  the day she most needs to record how she feels is the day
 *                  the gate is closed
 *   FatBudgetBar   IS food guidance, and carries its own guard, so it must
 *                  disappear entirely while the gate is closed
 *
 * See the header notes in each of those files.
 */

import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../App.tsx'
import { FOODS } from '../lib/foods.ts'

/* -------------------------------------------------------------------------- */
/* Driving the app the way she would                                           */
/* -------------------------------------------------------------------------- */

/** The mode selector, by its visible label. Two taps from anywhere, spec 4. */
function selectMode(label: 'Feeling good' | 'Being careful' | 'A bad time') {
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(label) }))
}

/**
 * Everything on screen EXCEPT the Daily Lift, as one lowercased string.
 *
 * The Lift is excluded, and the exclusion is the narrowed rule from CLAUDE.md's
 * working agreement rather than a convenience. 24 of the 365 entries in
 * data/daily-lift*.json name a food incidentally: "Bananas are berries",
 * "Corn was bred from a grass called teosinte", "Mantis shrimp have sixteen
 * types of color receptor". None of that is food GUIDANCE. It carries no
 * rating, no gram value, no portion, and answers no question about what she
 * should eat.
 *
 * Reading the rule strictly enough to fail on the word "banana" would move the
 * Daily Lift inside the gate and take away the one thing she should still see
 * on her worst day, which would be a worse app in the name of a cleaner test.
 *
 * Note that the Lift already carries the half of this that DOES matter:
 * liftRotation.ts withholds the entries that instruct her to eat something,
 * in flare mode only. See instructsEating there.
 */
function pageTextOutsideTheLift(): string {
  const lift = screen.queryByTestId('daily-lift')
  lift?.remove()
  return (document.body.textContent ?? '').toLowerCase()
}

/* -------------------------------------------------------------------------- */
/* The negative-space assertion                                                */
/* -------------------------------------------------------------------------- */

/**
 * THE MOST IMPORTANT ASSERTION IN THIS BUILD.
 *
 * It sweeps the rendered page for the name of every food in the dataset, and it
 * exists to catch a component that somebody mounts above the gate in 2027
 * without knowing why the gate is there. The other tests in this file check
 * things we already know to look for. This one checks the things we do not.
 *
 * It fails with an explanation rather than a diff, on purpose. Somebody is
 * going to hit this on an unrelated change, in a hurry, and the message they
 * read in that moment decides whether they move their component inside the gate
 * or delete the assertion. A red build that just prints two strings invites the
 * second choice.
 */
function expectNoFoodContent(where: string): void {
  const text = pageTextOutsideTheLift()

  const found = FOODS.find((food) => text.includes(food.name.toLowerCase()))
  if (found !== undefined) {
    throw new Error(
      [
        `INVARIANT 1: flare mode opens the triage screen BEFORE any food content. Always.`,
        ``,
        `Found the food "${found.name}" rendered ${where}.`,
        ``,
        `Something in the app now renders food guidance above FlareGate, or inside`,
        `it before triage has been answered. Fix it one of these two ways:`,
        ``,
        `  1. Move the component inside FlareGate, which is where food content`,
        `     belongs by default.`,
        `  2. If it genuinely has to render outside the gate for another reason,`,
        `     give it its own guard the way FatBudgetBar and AttachFoodSection do:`,
        ``,
        `         const { foodAllowed } = useTriage()`,
        `         if (!foodAllowed) return null`,
        ``,
        `Do not weaken this test, and do not add the component to an exclusion`,
        `list. The one existing exclusion, the Daily Lift, is documented above`,
        `pageTextOutsideTheLift and was a decision made on the record. See`,
        `CLAUDE.md's working agreement and the header of src/lib/triage.ts.`,
      ].join('\n'),
    )
  }

  /*
   * Gram values, separately from names. A component could render "18g of 30g
   * used today" without naming a single food, and the budget bar is exactly
   * that component.
   */
  const grams = text.match(/\b\d+(?:\.\d+)?\s?g(?:rams)?\b/)
  if (grams !== null) {
    throw new Error(
      [
        `INVARIANT 1: flare mode opens the triage screen BEFORE any food content. Always.`,
        ``,
        `Found the gram value "${grams[0]}" rendered ${where}.`,
        ``,
        `A gram count is food guidance even when no food is named. See the note`,
        `in FatBudgetBar.tsx: a grams-used-today readout above the red flag check`,
        `is precisely the ordering this invariant exists to prevent.`,
      ].join('\n'),
    )
  }
}

/* -------------------------------------------------------------------------- */

describe('FlareGate, invariant 1', () => {
  it('shows food content in stable mode', () => {
    render(<App />)

    expect(screen.getByRole('tablist', { name: 'Screens' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Your daily fat target' })).toBeDefined()
  })

  it('closes on entering flare mode, from every tab', () => {
    render(<App />)

    const tabs = within(screen.getByRole('tablist', { name: 'Screens' })).getAllByRole('tab')
    expect(tabs.length).toBeGreaterThan(0)

    for (const tab of tabs) {
      selectMode('Feeling good')
      fireEvent.click(tab)

      selectMode('A bad time')

      expect(screen.queryByRole('tablist', { name: 'Screens' })).toBeNull()
      expectNoFoodContent(`in flare mode, entered from the "${tab.textContent}" tab`)
    }
  })

  it('withholds the fat budget bar while the gate is closed', () => {
    render(<App />)
    /*
      Present first, so the assertion below is about the gate and not about a
      bar that was never there. getAllByText because the bar renders its readout
      twice: once to look at, and once in an sr-only live region so logging a
      food is announced without moving focus.
    */
    expect(screen.getAllByText(/used today|logged today/).length).toBeGreaterThan(0)

    selectMode('A bad time')
    expect(screen.queryAllByText(/used today|logged today/)).toHaveLength(0)
  })

  it('keeps the three things that belong above the gate', () => {
    render(<App />)
    selectMode('A bad time')

    /* The Lift, the log bar, the mode selector, and the disclaimer footer. */
    expect(screen.getByTestId('daily-lift')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Log how I am feeling' })).toBeDefined()
    expect(screen.getByRole('radiogroup', { name: /How are you doing/ })).toBeDefined()
    expect(screen.getByText(/General information only/)).toBeDefined()
  })

  /*
   * The in-memory decision, and the reason state/triage.tsx derives the stage
   * during render instead of resetting it in an effect. An effect-based reset
   * would pass this test while still painting one frame of the cleared stage
   * under the new mode, so this is necessary but not sufficient; the comment in
   * that file is the rest of the argument.
   */
  it('re-arms when she leaves flare mode and comes back', () => {
    render(<App />)

    selectMode('A bad time')
    expectNoFoodContent('in flare mode')

    selectMode('Feeling good')
    expect(screen.getByRole('tablist', { name: 'Screens' })).toBeDefined()

    selectMode('A bad time')
    expect(screen.queryByRole('tablist', { name: 'Screens' })).toBeNull()
    expectNoFoodContent('in flare mode, after leaving and returning')
  })

  /*
   * The symptom sheet renders outside the gate and must keep working during a
   * flare, minus AttachFoodSection, which carries its own guard. This is the
   * one place where "above the gate" and "food content" meet inside the same
   * component, so it gets its own check.
   */
  it('opens the symptom sheet in flare mode without the attach-food section', () => {
    render(<App />)
    selectMode('A bad time')

    fireEvent.click(screen.getByRole('button', { name: 'Log how I am feeling' }))

    expect(screen.getByRole('heading', { name: 'How are you doing?' })).toBeDefined()
    expect(screen.queryByText(/Attach what you ate/)).toBeNull()
    expectNoFoodContent('in the symptom sheet during a flare')
  })
})
