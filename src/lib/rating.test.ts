import { describe, expect, it } from 'vitest'
import {
  budgetNoteText,
  mathRating,
  rateFood,
  rateFoodEntry,
  RATING_COPY,
  RATING_PRESENTATION,
  thresholdsFor,
} from './rating.ts'
import { BUDGET_WARNING_GRAMS, THRESHOLD_FRACTIONS } from './ratingThresholds.ts'
import type { Food } from '../types.ts'

/**
 * The traffic light, main spec section 2, as amended: there is no per-mode
 * threshold multiplier. Each mode brings its own target T and the same two
 * fractions apply to it. See the comment at the top of ratingThresholds.ts.
 *
 * Every threshold in here is written out longhand rather than computed, so a
 * change to the arithmetic has to be an explicit decision rather than a test
 * that quietly follows the implementation.
 */

/** A minimal food with no flags, for the cases that are purely about grams. */
function foodWith(patch: Partial<Food>): Food {
  return {
    id: 'test-food',
    name: 'Test food',
    aliases: [],
    servingDescription: '1 serving',
    fatGrams: 0,
    category: 'poultry',
    tags: [],
    flags: [],
    modifications: [],
    notes: null,
    ...patch,
  }
}

describe('thresholdsFor', () => {
  it('splits T at one tenth and one quarter', () => {
    expect(thresholdsFor(30)).toEqual({ target: 30, greenMax: 3, yellowMax: 7.5 })
  })

  it('has no multiplier field and takes no mode argument', () => {
    // toEqual is exact on keys, so a reintroduced multiplier fails here. The
    // arity check pins the signature itself.
    expect(thresholdsFor(30)).toEqual({ target: 30, greenMax: 3, yellowMax: 7.5 })
    expect(thresholdsFor).toHaveLength(1)
  })

  it('scales to each mode own target', () => {
    // A 40g stable person: 40 stable, 30 recovering, 15 flare.
    expect(thresholdsFor(40)).toEqual({ target: 40, greenMax: 4, yellowMax: 10 })
    expect(thresholdsFor(30)).toEqual({ target: 30, greenMax: 3, yellowMax: 7.5 })
    expect(thresholdsFor(15)).toEqual({ target: 15, greenMax: 1.5, yellowMax: 3.75 })
  })

  it('moves when the daily target changes from 30 to 50', () => {
    expect(thresholdsFor(50)).toEqual({ target: 50, greenMax: 5, yellowMax: 12.5 })
  })

  it('reads its fractions from THRESHOLD_FRACTIONS rather than retyped literals', () => {
    const t = thresholdsFor(37)
    expect(t.greenMax).toBeCloseTo(37 * THRESHOLD_FRACTIONS.green, 10)
    expect(t.yellowMax).toBeCloseTo(37 * THRESHOLD_FRACTIONS.yellow, 10)
  })

  it('carries the target through unmodified', () => {
    expect(thresholdsFor(42).target).toBe(42)
  })
})

describe('mathRating', () => {
  const t30 = thresholdsFor(30)

  it('rates 2g against a 30g target as green', () => {
    expect(mathRating(2, t30)).toBe('green')
  })

  it('rates 5g against a 30g target as yellow', () => {
    expect(mathRating(5, t30)).toBe('yellow')
  })

  it('rates 10g against a 30g target as red', () => {
    expect(mathRating(10, t30)).toBe('red')
  })

  it('treats both bounds as inclusive', () => {
    // 0.10 * 30 is exactly 3 and 0.25 * 30 is exactly 7.5 in IEEE754, so these
    // are real boundary hits rather than float artifacts.
    expect(mathRating(3, t30)).toBe('green')
    expect(mathRating(7.5, t30)).toBe('yellow')
  })

  it('flips band just past each bound', () => {
    expect(mathRating(3.01, t30)).toBe('yellow')
    expect(mathRating(7.51, t30)).toBe('red')
  })

  it('rates zero grams green', () => {
    expect(mathRating(0, t30)).toBe('green')
  })
})

describe('rateFood, per-mode targets', () => {
  it('rates 5g yellow in stable at T=30 and red in flare at T=15', () => {
    // The mode adjustment lives entirely in T. Stable yellowMax is 7.5, flare
    // yellowMax is 3.75.
    expect(rateFood({ fatGrams: 5, target: 30, mode: 'stable' }).rating).toBe('yellow')
    expect(rateFood({ fatGrams: 5, target: 15, mode: 'flare' }).rating).toBe('red')
  })

  it('walks one 3.5g food across a 40g person three modes', () => {
    // greenMax 4 / greenMax 3 / yellowMax 3.75
    expect(rateFood({ fatGrams: 3.5, target: 40, mode: 'stable' }).rating).toBe('green')
    expect(rateFood({ fatGrams: 3.5, target: 30, mode: 'recovering' }).rating).toBe('yellow')
    expect(rateFood({ fatGrams: 3.5, target: 15, mode: 'flare' }).rating).toBe('yellow')
  })

  it('is identical across modes at the same target when no flare flag is present', () => {
    // The regression guard against reintroducing a per-mode multiplier.
    const at = (mode: 'stable' | 'recovering' | 'flare') =>
      rateFood({ fatGrams: 5, target: 30, mode }).rating
    expect(at('stable')).toBe('yellow')
    expect(at('recovering')).toBe('yellow')
    expect(at('flare')).toBe('yellow')
  })

  it('turns the same 5g item green when the target moves from 30 to 50', () => {
    // 0.10 * 50 is exactly 5, and the green bound is inclusive.
    expect(rateFood({ fatGrams: 5, target: 30, mode: 'stable' }).rating).toBe('yellow')
    expect(rateFood({ fatGrams: 5, target: 50, mode: 'stable' }).rating).toBe('green')
  })
})

describe('rateFood, hard RED overrides', () => {
  it('rates anything flagged alcohol red at zero grams with no modifications', () => {
    const result = rateFood({
      fatGrams: 0,
      target: 30,
      mode: 'stable',
      flags: ['alcohol'],
      modifications: ['Club soda with lime looks like a drink and is not one'],
    })
    expect(result.rating).toBe('red')
    expect(result.modifications).toEqual([])
    expect(result.reasons.map((r) => r.code)).toContain('alcohol')
  })

  it('keeps alcohol red at an implausibly generous target', () => {
    expect(rateFood({ fatGrams: 0, target: 200, mode: 'stable', flags: ['alcohol'] }).rating).toBe(
      'red',
    )
  })

  it('keeps alcohol red in every mode', () => {
    for (const mode of ['stable', 'recovering', 'flare'] as const) {
      const result = rateFood({ fatGrams: 0, target: 30, mode, flags: ['alcohol'] })
      expect(result.rating).toBe('red')
      expect(result.modifications).toEqual([])
    }
  })

  it('rates anything flagged deep-fried red regardless of grams', () => {
    expect(rateFood({ fatGrams: 1, target: 30, mode: 'stable', flags: ['deep-fried'] }).rating).toBe(
      'red',
    )
    expect(rateFood({ fatGrams: 0, target: 30, mode: 'stable', flags: ['deep-fried'] }).rating).toBe(
      'red',
    )
  })

  it('still offers modifications on a deep-fried item', () => {
    // Only alcohol loses its modifications. The whole point of the app is to
    // say here is the version of this you can have.
    const result = rateFood({
      fatGrams: 17,
      target: 30,
      mode: 'stable',
      flags: ['deep-fried'],
      modifications: ['Ask for it grilled instead'],
    })
    expect(result.modifications).toEqual(['Ask for it grilled instead'])
  })
})

describe('rateFood, YELLOW floor', () => {
  const floorFlags = ['hidden-fat', 'full-fat-dairy', 'processed-meat'] as const

  it('promotes a green to yellow for each floor flag', () => {
    for (const flag of floorFlags) {
      const result = rateFood({ fatGrams: 1, target: 30, mode: 'stable', flags: [flag] })
      expect(result.mathRating).toBe('green')
      expect(result.rating).toBe('yellow')
      expect(result.reasons.map((r) => r.code)).toContain('yellow-floor')
    }
  })

  it('does not demote a red reached by arithmetic', () => {
    const result = rateFood({
      fatGrams: 20,
      target: 30,
      mode: 'stable',
      flags: ['full-fat-dairy'],
    })
    expect(result.mathRating).toBe('red')
    expect(result.rating).toBe('red')
  })

  it('does not demote a forced red', () => {
    const result = rateFood({
      fatGrams: 1,
      target: 30,
      mode: 'stable',
      flags: ['alcohol', 'full-fat-dairy'],
      modifications: ['anything at all'],
    })
    expect(result.rating).toBe('red')
    expect(result.modifications).toEqual([])
  })

  it('never consults category', () => {
    // Pins the decision that red-meat is not a yellow floor. A lean cut rated
    // on grams alone stays green.
    const leanRedMeat = foodWith({ fatGrams: 2, category: 'red-meat' })
    expect(rateFoodEntry(leanRedMeat, { target: 30, mode: 'stable' }).rating).toBe('green')
  })
})

describe('rateFood, flare-only RED', () => {
  const flareFlags = ['high-fiber', 'high-sugar', 'spicy', 'raw', 'large-portion'] as const

  it('is green in stable and red in flare for each flare flag', () => {
    for (const flag of flareFlags) {
      expect(rateFood({ fatGrams: 0.5, target: 30, mode: 'stable', flags: [flag] }).rating).toBe(
        'green',
      )
      expect(rateFood({ fatGrams: 0.5, target: 15, mode: 'flare', flags: [flag] }).rating).toBe(
        'red',
      )
    }
  })

  it('is inert in recovering', () => {
    for (const flag of flareFlags) {
      expect(rateFood({ fatGrams: 0.5, target: 30, mode: 'recovering', flags: [flag] }).rating).toBe(
        'green',
      )
    }
  })

  it('names the triggering flag in the reason', () => {
    const result = rateFood({
      fatGrams: 0.5,
      target: 15,
      mode: 'flare',
      flags: ['high-fiber'],
    })
    const reason = result.reasons.find((r) => r.code === 'flare-restricted')
    expect(reason?.flag).toBe('high-fiber')
  })
})

describe('rateFood, budget note', () => {
  it('surfaces a note on a green food when under 5g remain', () => {
    const result = rateFood({
      fatGrams: 1,
      target: 30,
      mode: 'stable',
      gramsUsedToday: 26,
    })
    expect(result.rating).toBe('green')
    expect(result.budgetNote).not.toBeNull()
    expect(result.budgetNote?.remainingGrams).toBe(4)
    expect(result.budgetNote?.wouldRemainGrams).toBe(3)
  })

  it('uses a strict comparison at the warning boundary', () => {
    const atFive = rateFood({ fatGrams: 1, target: 30, mode: 'stable', gramsUsedToday: 25 })
    expect(atFive.budgetNote).toBeNull()

    const justUnder = rateFood({ fatGrams: 1, target: 30, mode: 'stable', gramsUsedToday: 25.1 })
    expect(justUnder.budgetNote).not.toBeNull()
    expect(justUnder.budgetNote?.remainingGrams).toBeCloseTo(4.9, 10)
  })

  it('has no note when the day total is not being tracked', () => {
    expect(rateFood({ fatGrams: 1, target: 30, mode: 'stable' }).budgetNote).toBeNull()
  })

  it('reports a negative remainder once the target is used up', () => {
    const result = rateFood({ fatGrams: 1, target: 30, mode: 'stable', gramsUsedToday: 32 })
    expect(result.budgetNote?.remainingGrams).toBe(-2)
    expect(result.rating).toBe('green')
  })

  it('never changes the rating', () => {
    const withNote = rateFood({ fatGrams: 20, target: 30, mode: 'stable', gramsUsedToday: 29 })
    const withoutNote = rateFood({ fatGrams: 20, target: 30, mode: 'stable' })
    expect(withNote.rating).toBe('red')
    expect(withNote.rating).toBe(withoutNote.rating)
  })

  it('matches BUDGET_WARNING_GRAMS rather than a retyped literal', () => {
    const exactlyAtLimit = 30 - BUDGET_WARNING_GRAMS
    expect(
      rateFood({ fatGrams: 1, target: 30, mode: 'stable', gramsUsedToday: exactlyAtLimit })
        .budgetNote,
    ).toBeNull()
  })
})

describe('reason ordering', () => {
  it('puts the dominant reason first and the arithmetic last', () => {
    const result = rateFood({
      fatGrams: 0.5,
      target: 15,
      mode: 'flare',
      flags: ['high-fiber', 'hidden-fat'],
    })
    expect(result.reasons.map((r) => r.code)).toEqual([
      'flare-restricted',
      'yellow-floor',
      'within-target',
    ])
  })

  it('gives a plain green food exactly one reason', () => {
    const result = rateFood({ fatGrams: 1, target: 30, mode: 'stable' })
    expect(result.reasons.map((r) => r.code)).toEqual(['within-target'])
  })
})

describe('presentation and copy invariants', () => {
  const allCopy = [
    ...Object.values(RATING_COPY),
    ...Object.values(RATING_PRESENTATION).map((p) => p.label),
    budgetNoteText(4),
    budgetNoteText(1),
    budgetNoteText(0),
    budgetNoteText(-2),
  ]

  it('carries a colour, an icon, and a word for every rating', () => {
    for (const rating of ['green', 'yellow', 'red'] as const) {
      const p = RATING_PRESENTATION[rating]
      expect(p.rating).toBe(rating)
      expect(p.icon.length).toBeGreaterThan(0)
      expect(p.label.length).toBeGreaterThan(0)
      expect(p.fillVar.startsWith('--')).toBe(true)
      expect(p.textVar.startsWith('--')).toBe(true)
    }
  })

  it('uses the darker gold variant for yellow wording', () => {
    // --gold at #B5762C does not meet AA against --paper for small text.
    expect(RATING_PRESENTATION.yellow.fillVar).toBe('--gold')
    expect(RATING_PRESENTATION.yellow.textVar).toBe('--gold-text')
  })

  it('contains no em dashes or en dashes', () => {
    for (const text of allCopy) {
      expect(text).not.toMatch(/[—–]/)
    }
  })

  it('never scolds', () => {
    for (const text of allCopy) {
      expect(text).not.toMatch(/you should have|too much|bad choice|cheat|failed|guilt/i)
    }
  })

  it('attaches the matching presentation to a result', () => {
    expect(rateFood({ fatGrams: 1, target: 30, mode: 'stable' }).presentation).toEqual(
      RATING_PRESENTATION.green,
    )
  })
})

describe('rateFoodEntry', () => {
  it('agrees with rateFood on the same fields', () => {
    const food = foodWith({
      fatGrams: 9,
      flags: ['full-fat-dairy'],
      modifications: ['Ask for half the cheese'],
      category: 'dairy',
    })
    expect(rateFoodEntry(food, { target: 30, mode: 'stable' })).toEqual(
      rateFood({
        fatGrams: 9,
        target: 30,
        mode: 'stable',
        flags: ['full-fat-dairy'],
        modifications: ['Ask for half the cheese'],
      }),
    )
  })

  it('passes the day total through', () => {
    const food = foodWith({ fatGrams: 1 })
    const result = rateFoodEntry(food, { target: 30, mode: 'stable', gramsUsedToday: 27 })
    expect(result.budgetNote?.remainingGrams).toBe(3)
  })
})
