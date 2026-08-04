import { describe, expect, it } from 'vitest'
import {
  SUBSTITUTIONS,
  SUBSTITUTIONS_BY_ID,
  SUBSTITUTIONS_META,
  SUBSTITUTION_PROBLEMS,
  SUBSTITUTION_RESOURCES,
  parseSubstitutionsFile,
} from './substitutions.ts'
import { FOODS_BY_ID } from './foods.ts'
import { DASH_PATTERN, SCOLDING_PATTERN, namesAlcohol } from '../test/copyInvariants.ts'

/**
 * Strict about the real data even though the loader is deliberately forgiving at
 * runtime, the same split foods.test.ts and restaurantPlaybook.test.ts use.
 *
 * CI runs npm test before npm run build, so a bad hand edit to
 * data/substitutions.json turns into a red X on the pull request rather than a
 * quietly shorter list of workarounds.
 */

/**
 * The nine swaps spec section 5.3 names outright. Pinned by id so a future edit
 * cannot quietly drop one while the file still looks healthy.
 */
const SPEC_REQUIRED_IDS = [
  'sour-cream',
  'mayonnaise',
  'oil-saute',
  'butter',
  'ground-beef',
  'cream-sauce',
  'cheese',
  'ice-cream',
  'fried-foods',
] as const

/** The four resources spec section 5.3 says to seed the list with. */
const SPEC_REQUIRED_RESOURCE_IDS = [
  'npf-nutrition',
  'npf-cookbook',
  'npf-inspire',
  'healthunlocked-cp',
  'mission-cure-nutrition',
] as const

function validSwap(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    to: 'Nonfat Greek yogurt',
    foodId: 'greek-yogurt-nonfat',
    how: 'Straight swap on a potato.',
    tradeoff: null,
    ...patch,
  }
}

function validEntry(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'sour-cream',
    name: 'Sour cream',
    aliases: [],
    standardFoodId: 'sour-cream',
    why: 'It is about a fifth fat by weight.',
    swaps: [validSwap()],
    ...patch,
  }
}

function validResource(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'test-resource',
    name: 'Test Resource',
    url: 'https://example.com',
    note: 'A note.',
    ...patch,
  }
}

function fileWith(substitutions: unknown[], resources: unknown[] = []): unknown {
  return {
    _meta: { maintenanceNote: 'Links move.' },
    resources,
    substitutions,
  }
}

/** Every string on this screen that she actually reads. */
function everyUserFacingString(): string[] {
  const strings: string[] = []
  for (const entry of SUBSTITUTIONS) {
    strings.push(entry.name, entry.why, ...entry.aliases)
    for (const swap of entry.swaps) {
      strings.push(swap.to, swap.how)
      if (swap.tradeoff !== null) strings.push(swap.tradeoff)
    }
  }
  for (const resource of SUBSTITUTION_RESOURCES) {
    strings.push(resource.name, resource.note)
  }
  return strings
}

describe('the real substitutions file', () => {
  it('loads every entry without a problem', () => {
    expect(SUBSTITUTION_PROBLEMS).toEqual([])
    expect(SUBSTITUTIONS.length).toBeGreaterThan(0)
    expect(SUBSTITUTIONS_BY_ID.size).toBe(SUBSTITUTIONS.length)
  })

  it('carries every swap spec 5.3 names', () => {
    for (const id of SPEC_REQUIRED_IDS) {
      expect(SUBSTITUTIONS_BY_ID.get(id), `spec 5.3 requires ${id}`).toBeDefined()
    }
  })

  it('gives every entry a real swap list rather than a thin one', () => {
    for (const entry of SUBSTITUTIONS) {
      // A heading with nothing under it is worse than no entry at all.
      expect(entry.swaps.length, entry.id).toBeGreaterThanOrEqual(1)
      expect(entry.why.length, entry.id).toBeGreaterThan(0)
    }
  })

  it('reads its grams from foods.json rather than storing its own', () => {
    /*
     * The load bearing claim of this file's _meta.maintenanceNote. If a
     * standardFoodId ever stopped agreeing with foods.json, the screen would
     * show one number while the checker showed another for the same food.
     */
    for (const entry of SUBSTITUTIONS) {
      const food = FOODS_BY_ID.get(entry.standardFoodId)
      expect(food, entry.id).toBeDefined()
      expect(entry.standardFatGrams).toBe(food?.fatGrams)
      expect(entry.standardServingDescription).toBe(food?.servingDescription)
    }

    for (const entry of SUBSTITUTIONS) {
      for (const swap of entry.swaps) {
        if (swap.foodId === null) continue
        const food = FOODS_BY_ID.get(swap.foodId)
        expect(food, `${entry.id} / ${swap.to}`).toBeDefined()
        expect(swap.fatGrams).toBe(food?.fatGrams)
        expect(swap.servingDescription).toBe(food?.servingDescription)
      }
    }
  })

  it('offers no workaround for alcohol, invariant 4', () => {
    for (const entry of SUBSTITUTIONS) {
      expect(FOODS_BY_ID.get(entry.standardFoodId)?.flags, entry.id).not.toContain('alcohol')
      for (const swap of entry.swaps) {
        if (swap.foodId === null) continue
        expect(FOODS_BY_ID.get(swap.foodId)?.flags, swap.to).not.toContain('alcohol')
      }
    }
    for (const text of everyUserFacingString()) {
      expect(namesAlcohol(text), text).toBe(false)
    }
  })

  it('seeds the resource list spec 5.3 asks for', () => {
    const ids = SUBSTITUTION_RESOURCES.map((resource) => resource.id)
    for (const id of SPEC_REQUIRED_RESOURCE_IDS) {
      expect(ids, `spec 5.3 requires ${id}`).toContain(id)
    }
  })

  it('links only to https resources, or to none at all', () => {
    for (const resource of SUBSTITUTION_RESOURCES) {
      if (resource.url === null) continue
      expect(resource.url.startsWith('https://'), resource.id).toBe(true)
    }
  })

  it('keeps the instruction for a dead link in the file', () => {
    /*
     * These URLs rot exactly the way the chain nutrition links do. The note is
     * how whoever finds a broken one knows what to do, so it is not allowed to
     * be dropped in a future edit. Same guard as restaurantPlaybook.test.ts.
     *
     * CI cannot check that the links are still live: the suite runs offline and
     * a network assertion would make it flaky. Shape is what a test can hold.
     */
    expect(SUBSTITUTIONS_META.maintenanceNote.length).toBeGreaterThan(0)
  })

  it('contains no em dashes or en dashes in anything she reads', () => {
    for (const text of everyUserFacingString()) {
      expect(text).not.toMatch(DASH_PATTERN)
    }
  })

  it('never scolds her', () => {
    for (const text of everyUserFacingString()) {
      expect(text).not.toMatch(SCOLDING_PATTERN)
    }
  })
})

describe('the pot liquor case in the invariant 4 guard', () => {
  it('does not fire on the broth left in a bean pot', () => {
    // Added in Phase 8. The smoked turkey swap for soup beans and collards is
    // about preserving the pot liquor, and it is not a drink.
    expect(namesAlcohol('The fat ends up in the pot liquor as much as the meat')).toBe(false)
    expect(namesAlcohol('Save the potlikker for the cornbread')).toBe(false)
  })

  it('still catches a drink sitting next to it', () => {
    expect(namesAlcohol('Pot liquor and a glass of wine')).toBe(true)
  })
})

describe('parseSubstitutionsFile', () => {
  it('does not throw on a non-object', () => {
    expect(() => parseSubstitutionsFile(null, 'test')).not.toThrow()
    expect(() => parseSubstitutionsFile('nope', 'test')).not.toThrow()
    expect(parseSubstitutionsFile(null, 'test').substitutions).toEqual([])
    expect(parseSubstitutionsFile(null, 'test').problems.length).toBeGreaterThan(0)
  })

  it('resolves grams from foods.json for a foodId swap', () => {
    const result = parseSubstitutionsFile(fileWith([validEntry()]), 'test')
    expect(result.problems).toEqual([])
    const entry = result.substitutions.at(0)
    expect(entry?.standardFatGrams).toBe(FOODS_BY_ID.get('sour-cream')?.fatGrams)
    expect(entry?.swaps.at(0)?.fatGrams).toBe(FOODS_BY_ID.get('greek-yogurt-nonfat')?.fatGrams)
    expect(entry?.swaps.at(0)?.foodId).toBe('greek-yogurt-nonfat')
  })

  it('accepts a literal swap for something foods.json does not have', () => {
    const result = parseSubstitutionsFile(
      fileWith([
        validEntry({
          swaps: [
            {
              to: 'Broth and cornstarch base',
              fatGrams: 1,
              servingDescription: '1 cup sauce',
              how: 'Thicken fat free broth with a cornstarch slurry.',
              tradeoff: 'Silky rather than rich.',
            },
          ],
        }),
      ]),
      'test',
    )
    expect(result.problems).toEqual([])
    expect(result.substitutions.at(0)?.swaps.at(0)?.fatGrams).toBe(1)
    expect(result.substitutions.at(0)?.swaps.at(0)?.foodId).toBeNull()
  })

  it('rejects a swap carrying both forms, and one carrying neither', () => {
    const both = parseSubstitutionsFile(
      fileWith([
        validEntry({
          swaps: [validSwap({ fatGrams: 2, servingDescription: '1 cup' })],
        }),
      ]),
      'test',
    )
    expect(both.substitutions).toEqual([])
    expect(both.problems.map((problem) => problem.field)).toContain('foodId')

    const neither = parseSubstitutionsFile(
      fileWith([
        validEntry({
          swaps: [{ to: 'Something', how: 'Somehow.', tradeoff: null }],
        }),
      ]),
      'test',
    )
    expect(neither.substitutions).toEqual([])
    expect(neither.problems.map((problem) => problem.field)).toContain('foodId')
  })

  it('rejects an unknown food id on either side', () => {
    const standard = parseSubstitutionsFile(
      fileWith([validEntry({ standardFoodId: 'unicorn-steak' })]),
      'test',
    )
    expect(standard.substitutions).toEqual([])
    expect(standard.problems.map((problem) => problem.field)).toContain('standardFoodId')

    const swap = parseSubstitutionsFile(
      fileWith([validEntry({ swaps: [validSwap({ foodId: 'unicorn-yogurt' })] })]),
      'test',
    )
    expect(swap.substitutions).toEqual([])
    expect(swap.problems.map((problem) => problem.field)).toContain('foodId')
  })

  it('drops an alcohol entry outright, invariant 4', () => {
    // The structural half of invariant 4 on this screen. A hand edit that adds a
    // workaround for a drink loses it at load rather than shipping it.
    const alcoholId = [...FOODS_BY_ID.values()].find((food) =>
      food.flags.includes('alcohol'),
    )?.id
    expect(alcoholId).toBeDefined()

    const result = parseSubstitutionsFile(
      fileWith([validEntry({ id: 'a-drink', standardFoodId: alcoholId })]),
      'test',
    )
    expect(result.substitutions).toEqual([])
    expect(result.problems.map((problem) => problem.field)).toContain('standardFoodId')
  })

  it('rejects an empty swap list', () => {
    const result = parseSubstitutionsFile(fileWith([validEntry({ swaps: [] })]), 'test')
    expect(result.substitutions).toEqual([])
    expect(result.problems.map((problem) => problem.field)).toContain('swaps')
  })

  it('requires tradeoff to be present, as a string or an explicit null', () => {
    const missing = parseSubstitutionsFile(
      fileWith([validEntry({ swaps: [{ to: 'X', foodId: 'mustard', how: 'Somehow.' }] })]),
      'test',
    )
    expect(missing.substitutions).toEqual([])
    expect(missing.problems.map((problem) => problem.field)).toContain('tradeoff')
  })

  it('drops one broken entry and keeps its valid siblings', () => {
    const result = parseSubstitutionsFile(
      fileWith([
        validEntry({ id: 'first' }),
        validEntry({ id: 'broken', why: '' }),
        validEntry({ id: 'third' }),
      ]),
      'test',
    )
    expect(result.substitutions.map((entry) => entry.id)).toEqual(['first', 'third'])
    expect(result.problems).toHaveLength(1)
  })

  it('reports a duplicate id and keeps the first', () => {
    const result = parseSubstitutionsFile(
      fileWith([validEntry({ name: 'First' }), validEntry({ name: 'Second' })]),
      'test',
    )
    expect(result.substitutions).toHaveLength(1)
    expect(result.substitutions.at(0)?.name).toBe('First')
    expect(result.problems.map((problem) => problem.field)).toContain('id')
  })

  it('rejects an http resource url but accepts null', () => {
    const withHttp = parseSubstitutionsFile(
      fileWith([validEntry()], [validResource({ url: 'http://example.com' })]),
      'test',
    )
    expect(withHttp.resources).toEqual([])
    expect(withHttp.problems.map((problem) => problem.field)).toContain('url')

    const withNull = parseSubstitutionsFile(
      fileWith([validEntry()], [validResource({ url: null })]),
      'test',
    )
    expect(withNull.resources).toHaveLength(1)
    expect(withNull.problems).toEqual([])
  })

  it('names the file and the entry in a problem', () => {
    const result = parseSubstitutionsFile(
      fileWith([validEntry({ id: 'nope', standardFoodId: 'not-a-food' })]),
      'substitutions',
    )
    expect(result.problems.at(0)?.source).toBe('substitutions')
    expect(result.problems.at(0)?.entry).toBe('nope')
  })
})
