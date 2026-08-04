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
import { afterEach, describe, expect, it } from 'vitest'
import App from '../App.tsx'
import { PREP_COPY } from '../lib/appointmentPrep.ts'
import { FOODS } from '../lib/foods.ts'
import * as storage from '../lib/storage.ts'
import { RED_FLAGS, TRIAGE_COPY } from '../lib/triage.ts'
import { SETTINGS_STORAGE_KEY } from '../state/settingsModel.ts'

afterEach(() => {
  storage.remove(SETTINGS_STORAGE_KEY)
})

/** Both triage answers, by their visible label. */
function answerRedFlagCheck(answer: 'yes' | 'no') {
  fireEvent.click(
    screen.getByRole('button', {
      name: answer === 'yes' ? TRIAGE_COPY.answerYes : TRIAGE_COPY.answerNo,
    }),
  )
}

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

  it('opens on the red flag check, from every tab', () => {
    render(<App />)

    const tabs = within(screen.getByRole('tablist', { name: 'Screens' })).getAllByRole('tab')
    expect(tabs.length).toBeGreaterThan(0)

    for (const tab of tabs) {
      selectMode('Feeling good')
      fireEvent.click(tab)

      selectMode('A bad time')

      expect(screen.getByTestId('redflag-check')).toBeDefined()
      expect(screen.queryByRole('tablist', { name: 'Screens' })).toBeNull()
      expectNoFoodContent(`in flare mode, entered from the "${tab.textContent}" tab`)
    }
  })

  it('asks the five questions from spec section 4 and offers both answers', () => {
    render(<App />)
    selectMode('A bad time')

    const check = screen.getByTestId('redflag-check')
    expect(within(check).getAllByRole('listitem')).toHaveLength(RED_FLAGS.length)
    for (const flag of RED_FLAGS) {
      expect(within(check).getByText(flag)).toBeDefined()
    }

    expect(within(check).getByRole('button', { name: 'Yes, one or more' })).toBeDefined()
    expect(within(check).getByRole('button', { name: 'No, but I feel off' })).toBeDefined()
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

  it('keeps the four things that belong above the gate', () => {
    render(<App />)
    selectMode('A bad time')

    /* The Lift, the log bar, When To Call, the mode selector, and the footer. */
    expect(screen.getByTestId('daily-lift')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Log how I am feeling' })).toBeDefined()
    expect(screen.getByRole('button', { name: TRIAGE_COPY.whenToCallOpen })).toBeDefined()
    expect(screen.getByRole('radiogroup', { name: /How are you doing/ })).toBeDefined()
    expect(screen.getByText(/General information only/)).toBeDefined()
  })

  /*
   * Spec 5.10 wants this reachable from a persistent header icon. "Persistent"
   * has to include the triage stages, or it is a card she can only open once
   * she has answered a question, which is the wrong card.
   */
  it('reaches When To Call at every triage stage', () => {
    render(<App />)

    function openAndCheck(where: string) {
      fireEvent.click(screen.getByRole('button', { name: TRIAGE_COPY.whenToCallOpen }))

      const card = screen.getByTestId('when-to-call')
      for (const flag of RED_FLAGS) {
        expect(within(card).getByText(flag), `${flag} missing ${where}`).toBeDefined()
      }
      expect(within(card).getByText(TRIAGE_COPY.whenToCallUrgency)).toBeDefined()

      fireEvent.click(within(card).getByRole('button', { name: TRIAGE_COPY.whenToCallClose }))
    }

    openAndCheck('in stable mode')

    selectMode('A bad time')
    openAndCheck('at the red flag check')

    answerRedFlagCheck('yes')
    openAndCheck('on the urgent panel')

    fireEvent.click(screen.getByRole('button', { name: TRIAGE_COPY.urgentContinue }))
    openAndCheck('after triage cleared')
  })

  /*
   * The card and the gate read one constant. Two copies of this list would
   * drift silently: the card she reaches from the header would stop matching
   * the screen that gates her flare, and nobody would notice until it mattered.
   */
  it('lists the same red flags on the card and at the gate', () => {
    render(<App />)
    selectMode('A bad time')

    const atGate = within(screen.getByTestId('redflag-check'))
      .getAllByRole('listitem')
      .map((item) => item.textContent)

    fireEvent.click(screen.getByRole('button', { name: TRIAGE_COPY.whenToCallOpen }))
    const onCard = within(screen.getByTestId('when-to-call'))
      .getAllByRole('listitem')
      .map((item) => item.textContent)

    expect(onCard).toEqual(atGate)
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

  /* ------------------------------------------------------------------------ */
  /* The yes branch                                                            */
  /* ------------------------------------------------------------------------ */

  it('shows the contact panel on a yes, with no food content behind it', () => {
    render(<App />)
    selectMode('A bad time')
    answerRedFlagCheck('yes')

    expect(screen.getByTestId('urgent-panel')).toBeDefined()
    expect(screen.queryByRole('tablist', { name: 'Screens' })).toBeNull()
    expect(screen.queryByTestId('flare-guidance')).toBeNull()
    expectNoFoodContent('on the urgent contact panel')
  })

  /*
   * Spec section 4 wants a button that dials her doctor. With no numbers saved
   * the panel offers the editor instead of a dead control, because a contact
   * she cannot add during a flare is not much better than no contact.
   */
  it('offers a way to add a number when she has none saved', () => {
    render(<App />)
    selectMode('A bad time')
    answerRedFlagCheck('yes')

    const panel = screen.getByTestId('urgent-panel')
    expect(within(panel).getByText(/have not added your care team numbers/)).toBeDefined()
    expect(within(panel).getByRole('button', { name: TRIAGE_COPY.contactsAdd })).toBeDefined()
  })

  it('dials a saved number with a tel link', () => {
    render(<App />)
    selectMode('A bad time')
    answerRedFlagCheck('yes')

    fireEvent.click(screen.getByRole('button', { name: TRIAGE_COPY.contactsAdd }))
    fireEvent.change(screen.getByLabelText(TRIAGE_COPY.contactsName), {
      target: { value: 'Dr. Whitmore' },
    })
    fireEvent.change(screen.getByLabelText(TRIAGE_COPY.contactsPhone), {
      target: { value: '(555) 555-0134' },
    })
    fireEvent.click(screen.getByRole('button', { name: TRIAGE_COPY.contactsSave }))

    const dial = screen.getByRole('link', { name: 'Call Dr. Whitmore' })
    expect(dial.getAttribute('href')).toBe('tel:5555550134')
    /* Adding a number must not have opened the door to food content. */
    expectNoFoodContent('on the urgent panel after adding a number')
  })

  /*
   * Her assertion, not the app's conclusion. Section 4: "because sometimes she
   * has already called and is waiting."
   */
  it('continues to food guidance when she says she has already contacted them', () => {
    render(<App />)
    selectMode('A bad time')
    answerRedFlagCheck('yes')

    fireEvent.click(screen.getByRole('button', { name: TRIAGE_COPY.urgentContinue }))

    expect(screen.getByTestId('flare-guidance')).toBeDefined()
    expect(screen.getByRole('tablist', { name: 'Screens' })).toBeDefined()
  })

  /* ------------------------------------------------------------------------ */
  /* The no branch                                                             */
  /* ------------------------------------------------------------------------ */

  it('opens flare guidance on a no, and lets the app back in behind it', () => {
    render(<App />)
    selectMode('A bad time')
    answerRedFlagCheck('no')

    const guidance = screen.getByTestId('flare-guidance')
    expect(within(guidance).getByText(TRIAGE_COPY.guidanceLiquids)).toBeDefined()
    expect(within(guidance).getByText(TRIAGE_COPY.guidanceSchedule)).toBeDefined()
    expect(screen.getByRole('tablist', { name: 'Screens' })).toBeDefined()
  })

  /*
   * A no is not a clearance. The line that routes to a person and the way back
   * to the red flag list both stay visible rather than going behind the
   * disclosure.
   */
  it('keeps the route back to a person out of the disclosure', () => {
    render(<App />)
    selectMode('A bad time')
    answerRedFlagCheck('no')

    const guidance = screen.getByTestId('flare-guidance')
    const details = within(guidance).getByText(TRIAGE_COPY.guidanceMoreLabel).closest('details')

    expect(details).not.toBeNull()
    expect((details as HTMLDetailsElement).open).toBe(false)
    expect(within(guidance).getByText(TRIAGE_COPY.guidanceCannotEat).closest('details')).toBeNull()
    expect(
      within(guidance).getByText(/Still feel like something is wrong/).closest('details'),
    ).toBeNull()
  })

  it('goes back to the questions from the guidance screen', () => {
    render(<App />)
    selectMode('A bad time')
    answerRedFlagCheck('no')

    const guidance = screen.getByTestId('flare-guidance')
    fireEvent.click(
      within(guidance).getByRole('button', { name: TRIAGE_COPY.guidanceBackToCheck }),
    )

    expect(screen.getByTestId('redflag-check')).toBeDefined()
    expectNoFoodContent('after reopening the red flag check from flare guidance')
  })

  /*
   * The flare ceiling is an upper bound, not a goal (addendum section A). The
   * bar comes back after triage clears and has to say so, because a bar filling
   * toward a number reads as a goal without a line that says otherwise.
   */
  it('re-admits the budget bar after triage, framed as a ceiling', () => {
    render(<App />)
    selectMode('A bad time')
    answerRedFlagCheck('no')

    expect(screen.getAllByText(/of 15g used today/).length).toBeGreaterThan(0)
    expect(screen.getByText(/ceiling for today, not something to aim for/)).toBeDefined()
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

  /* ------------------------------------------------------------------------ */
  /* The appointment prep sheet, which portals itself to document.body         */
  /* ------------------------------------------------------------------------ */

  /**
   * Gives the prep sheet a gram value to print, so the sweep below has
   * something to catch.
   *
   * Without a target set, an empty log produces a prep sheet carrying no food
   * name and no number, and expectNoFoodContent would pass on a LEAKED sheet
   * for want of anything to find. Seeding a care team target makes the sheet
   * print "35 grams of fat.", which is exactly the kind of line invariant 1
   * exists to keep off the screen during a flare.
   */
  function seedTarget() {
    storage.set(SETTINGS_STORAGE_KEY, { schemaVersion: 1, dailyFatTarget: 35 })
  }

  function openPrepSheet() {
    fireEvent.click(screen.getByRole('tab', { name: 'How I have been' }))
    fireEvent.click(screen.getByRole('button', { name: PREP_COPY.openAction }))
    return screen.getByTestId('prep-sheet')
  }

  /*
   * PrepSheet renders through createPortal into document.body, which puts its
   * DOM outside the gate's subtree while leaving it inside the gate's REACT
   * tree. That combination is worth a test of its own: it is precisely the
   * shape somebody could later hoist above FlareGate without it looking like a
   * change to where anything renders.
   *
   * It stays correct because the sheet mounts from the Patterns tab, so closing
   * the gate unmounts the whole subtree and the portal with it. Note that
   * pageTextOutsideTheLift reads document.body.textContent, so a leaked portal
   * is inside the sweep rather than beside it.
   */
  it('takes the appointment prep sheet down with the gate', () => {
    seedTarget()
    render(<App />)

    const sheet = openPrepSheet()
    /* Present first, so the assertion below is about the gate. */
    expect(within(sheet).getByText(/35 grams of fat/)).toBeDefined()

    /*
     * Driven directly. In a browser the sheet sets `inert` on the app root, so
     * she would close it before reaching the mode selector; jsdom does not
     * enforce inert, which lets this assert the structural claim rather than
     * the click path: no prep sheet survives the gate closing, however she got
     * there.
     */
    selectMode('A bad time')

    expect(screen.queryByTestId('prep-sheet')).toBeNull()
    expectNoFoodContent('with the appointment prep sheet open when flare mode began')
  })

  it('offers no way to reach the prep sheet while the gate is closed', () => {
    seedTarget()
    render(<App />)
    selectMode('A bad time')

    expect(screen.queryByRole('button', { name: PREP_COPY.openAction })).toBeNull()
    expectNoFoodContent('looking for the appointment prep button during a flare')
  })

  /* And it comes back once triage has been answered, like the rest of the app. */
  it('lets the prep sheet open again after triage clears', () => {
    seedTarget()
    render(<App />)
    selectMode('A bad time')
    answerRedFlagCheck('no')

    expect(within(openPrepSheet()).getByText(/grams of fat/)).toBeDefined()
  })
})
