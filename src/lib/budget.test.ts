import { describe, expect, it } from 'vitest'
import { budgetImpact, budgetImpactText, BUDGET_COPY } from './budget.ts'
import { RATING_COPY } from './rating.ts'

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

describe('budget copy', () => {
  const strings = Object.values(BUDGET_COPY)

  it('contains no em dashes anywhere (invariant 9)', () => {
    for (const line of strings) expect(line).not.toContain('—')
  })

  it('never scolds (invariant 10)', () => {
    // Not a proof, but it pins the words most likely to creep in on a rewrite.
    for (const line of strings) {
      expect(line.toLowerCase()).not.toMatch(/should|too much|avoid|careful|exceed|limit|allowance/)
    }
  })
})
