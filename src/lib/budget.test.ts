import { describe, expect, it } from 'vitest'
import {
  budgetBarReadoutWithoutTarget,
  budgetBarState,
  budgetImpact,
  budgetImpactText,
  BAR_COPY,
  BUDGET_COPY,
} from './budget.ts'
import { RATING_COPY } from './rating.ts'
import { BUDGET_WARNING_GRAMS } from './ratingThresholds.ts'
import { DASH_PATTERN, SCOLDING_PATTERN } from '../test/copyInvariants.ts'

describe('budgetImpact', () => {
  it('reports what is left before and after the item', () => {
    const impact = budgetImpact(30, 12, 5)
    expect(impact.remainingBefore).toBe(18)
    expect(impact.remainingAfter).toBe(13)
  })

  it('goes negative rather than clamping at zero', () => {
    // The UI needs to know how far past, so it can say how far past.
    const impact = budgetImpact(30, 28, 9)
    expect(impact.remainingBefore).toBe(2)
    expect(impact.remainingAfter).toBe(-7)
  })

  it('handles a day that was already over before this item', () => {
    const impact = budgetImpact(30, 34, 5)
    expect(impact.remainingBefore).toBe(-4)
    expect(impact.remainingAfter).toBe(-9)
  })

  it('rounds away floating point drift on one decimal values', () => {
    const impact = budgetImpact(30, 0.1, 3.5)
    expect(impact.remainingBefore).toBe(29.9)
    expect(impact.remainingAfter).toBe(26.4)
  })
})

describe('budgetImpactText', () => {
  it('says what would be left when it fits', () => {
    expect(budgetImpactText(budgetImpact(30, 12, 5))).toBe(
      'You have 18 grams left today. This one would leave you about 13 grams.',
    )
  })

  it('says it uses the rest when it lands exactly on the target', () => {
    expect(budgetImpactText(budgetImpact(30, 12, 18))).toBe(
      'You have 18 grams left today. This one would use the rest of it.',
    )
  })

  it('says how far past, and offers a way forward, when it goes over', () => {
    expect(budgetImpactText(budgetImpact(30, 28, 9))).toBe(
      'You have 2 grams left today. This one runs about 7 grams past that. A smaller portion closes most of the gap.',
    )
  })

  it('falls back to the neutral line once the day is already spoken for', () => {
    expect(budgetImpactText(budgetImpact(30, 30, 5))).toBe(BUDGET_COPY.usedUp)
    expect(budgetImpactText(budgetImpact(30, 41, 5))).toBe(BUDGET_COPY.usedUp)
  })

  it('reuses the engine wording for a used up day rather than inventing a second one', () => {
    expect(BUDGET_COPY.usedUp).toBe(RATING_COPY.budgetUsedUp)
  })

  it('says gram, singular, for exactly one', () => {
    expect(budgetImpactText(budgetImpact(30, 29, 0.5))).toContain('1 gram left')
  })
})

describe('budgetBarState', () => {
  it('reads out the compact glanceable form from spec section 5.4', () => {
    expect(budgetBarState(40, 18).readout).toBe('18g of 40g used today')
  })

  it('fills proportionally', () => {
    expect(budgetBarState(40, 0).fillPercent).toBe(0)
    expect(budgetBarState(40, 20).fillPercent).toBe(50)
    expect(budgetBarState(40, 40).fillPercent).toBe(100)
  })

  it('pins the fill at the end of the track rather than drawing past it', () => {
    const state = budgetBarState(40, 62)
    expect(state.fillPercent).toBe(100)
    expect(state.overflow).toBe(true)
    // The number still tells the truth even though the bar has run out of room.
    expect(state.readout).toBe('62g of 40g used today')
    expect(state.remainingGrams).toBe(-22)
  })

  it('does not divide by a target of zero', () => {
    const state = budgetBarState(0, 12)
    expect(state.fillPercent).toBe(0)
    expect(Number.isNaN(state.fillPercent)).toBe(false)
  })

  it('turns cautionary at the same point the rating engine does', () => {
    // BUDGET_WARNING_GRAMS is 5. Exactly 5 left is still under; below it is close.
    expect(budgetBarState(40, 35).remainingGrams).toBe(BUDGET_WARNING_GRAMS)
    expect(budgetBarState(40, 35).tone).toBe('under')
    expect(budgetBarState(40, 35.1).tone).toBe('close')
    expect(budgetBarState(40, 39).tone).toBe('close')
  })

  it('is full at exactly the target and stays full past it', () => {
    expect(budgetBarState(40, 40).tone).toBe('full')
    expect(budgetBarState(40, 44).tone).toBe('full')
    expect(budgetBarState(40, 40).overflow).toBe(false)
  })

  it('says what is left in words, so the colour is never carrying it alone', () => {
    expect(budgetBarState(40, 18).note).toBe('You have 22 grams left today.')
    expect(budgetBarState(40, 39).note).toBe('You have 1 gram left today.')
    expect(budgetBarState(40, 40).note).toBe(BUDGET_COPY.usedUp)
    expect(budgetBarState(40, 51).note).toBe(BUDGET_COPY.usedUp)
  })

  it('rounds away floating point drift in the readout', () => {
    expect(budgetBarState(40, 0.1 + 3.5 + 16).readout).toBe('19.6g of 40g used today')
  })
})

describe('budgetBarReadoutWithoutTarget', () => {
  it('drops the denominator rather than inventing one', () => {
    expect(budgetBarReadoutWithoutTarget(18)).toBe('18g logged today.')
    expect(budgetBarReadoutWithoutTarget(0)).toBe('0g logged today.')
  })
})

describe('budget copy', () => {
  const strings = [...Object.values(BUDGET_COPY), ...Object.values(BAR_COPY)]

  it('contains no em dashes or en dashes (invariant 9)', () => {
    for (const line of strings) expect(line).not.toMatch(DASH_PATTERN)
  })

  it('never scolds (invariant 10)', () => {
    // Not a proof, but it pins the phrases most likely to creep in on a rewrite.
    for (const line of strings) expect(line).not.toMatch(SCOLDING_PATTERN)
  })
})
