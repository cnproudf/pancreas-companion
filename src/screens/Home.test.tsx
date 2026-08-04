/**
 * The two Phase 9 additions to the home screen that have a rule attached.
 *
 * The rest of what these features do is covered by lib/hydration.test.ts and
 * lib/enzymeLog.test.ts. What needs a rendered tree is the conditional in spec
 * 5.7 ("only appears if she toggles it") and invariant 8's reasoning about the
 * glass row, both of which are claims about what is on the screen.
 */

import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../App.tsx'
import { ENZYME_COPY } from '../lib/enzymeLog.ts'
import { HYDRATION_COPY } from '../lib/hydration.ts'

describe('hydration row', () => {
  it('offers eight glasses', () => {
    render(<App />)
    const row = screen.getByTestId('hydration')
    expect(within(row).getAllByRole('button')).toHaveLength(8)
  })

  /*
   * Invariant 8's reasoning. A filled glass differs from an empty one by colour
   * and shape alone, so the count is written out as well. She should never have
   * to count icons to know where she is.
   */
  it('states the count in words, not in filled icons alone', () => {
    render(<App />)
    const row = screen.getByTestId('hydration')

    expect(within(row).getByText('0 of 8 glasses')).toBeDefined()
    fireEvent.click(within(row).getByRole('button', { name: /Set today to 5 of 8/ }))
    expect(within(row).getByText('5 of 8 glasses')).toBeDefined()
  })

  /* The only route back from one glass to none, and it has to be one thumb. */
  it('clears back to none when she taps the glass she is on', () => {
    render(<App />)
    const row = screen.getByTestId('hydration')

    fireEvent.click(within(row).getByRole('button', { name: /Set today to 3 of 8/ }))
    expect(within(row).getByText('3 of 8 glasses')).toBeDefined()

    fireEvent.click(within(row).getByRole('button', { name: HYDRATION_COPY.clearLabel }))
    expect(within(row).getByText('0 of 8 glasses')).toBeDefined()
  })
})

describe('enzyme log', () => {
  /* Spec 5.7: "Only appears if she toggles 'I take pancreatic enzymes'." */
  it('stays hidden until she says she takes them', () => {
    render(<App />)
    expect(screen.queryByTestId('enzyme-log')).toBeNull()

    fireEvent.click(screen.getByLabelText(new RegExp(ENZYME_COPY.toggleLabel)))
    expect(screen.getByTestId('enzyme-log')).toBeDefined()
  })

  /*
   * THE CENTRAL CLAIM OF THE ENZYME LOG. A slot she has not tapped reads "not
   * recorded", never as a dose she did not take. She may show this to her
   * gastroenterologist, and those are different facts about her care.
   */
  it('reads an untapped slot as unrecorded rather than as a skipped dose', () => {
    render(<App />)
    fireEvent.click(screen.getByLabelText(new RegExp(ENZYME_COPY.toggleLabel)))

    const log = screen.getByTestId('enzyme-log')
    expect(within(log).getByText(/Breakfast: not recorded/)).toBeDefined()

    for (const button of within(log).getAllByRole('button')) {
      expect(button.getAttribute('aria-pressed')).toBe('false')
    }
  })

  it('records a slot and clears it again', () => {
    render(<App />)
    fireEvent.click(screen.getByLabelText(new RegExp(ENZYME_COPY.toggleLabel)))

    const log = screen.getByTestId('enzyme-log')
    const took = within(log).getByRole('button', { name: /Breakfast, took them/ })

    fireEvent.click(took)
    expect(within(log).getByText(/Breakfast: took them/)).toBeDefined()

    fireEvent.click(took)
    expect(within(log).getByText(/Breakfast: not recorded/)).toBeDefined()
  })
})
