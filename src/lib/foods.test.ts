import { describe, expect, it } from 'vitest'
import { FOOD_PROBLEMS, FOODS, FOODS_BY_ID, FOODS_META, parseFoods } from './foods.ts'
import { rateFoodEntry } from './rating.ts'
import { FOOD_CATEGORIES, FOOD_FLAGS } from '../types.ts'
import { DASH_PATTERN } from '../test/copyInvariants.ts'

/**
 * The dataset is the app. If it stops loading cleanly, every screen downstream
 * is wrong in a way that is hard to see, so this file is deliberately strict
 * about the real data even though the loader itself is deliberately forgiving
 * at runtime.
 *
 * CI runs npm test before npm run build, so a bad hand edit to data/ turns into
 * a red X on the pull request rather than a quietly shorter food list.
 */

function validEntry(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'test-food',
    name: 'Test food',
    aliases: [],
    servingDescription: '1 serving',
    fatGrams: 1,
    category: 'poultry',
    tags: [],
    flags: [],
    modifications: [],
    notes: null,
    ...patch,
  }
}

function fileWith(entries: unknown[]): unknown {
  return { _meta: { categories: FOOD_CATEGORIES, flagVocabulary: FOOD_FLAGS }, foods: entries }
}

describe('the real dataset', () => {
  it('loads every entry without a problem', () => {
    expect(FOOD_PROBLEMS).toEqual([])
    expect(FOODS).toHaveLength(211)
  })

  it('gives every entry a category from the vocabulary', () => {
    for (const food of FOODS) {
      expect(FOOD_CATEGORIES).toContain(food.category)
      expect(FOODS_META.categories).toContain(food.category)
    }
  })

  it('gives every entry a valid flag set with no repeats', () => {
    for (const food of FOODS) {
      for (const flag of food.flags) {
        expect(FOOD_FLAGS).toContain(flag)
        expect(FOODS_META.flagVocabulary).toContain(flag)
      }
      expect(new Set(food.flags).size).toBe(food.flags.length)
    }
  })

  it('keeps the literal unions in sync with _meta', () => {
    // The drift guard. If someone adds a category to the data, this fails until
    // types.ts is updated, and vice versa.
    expect([...FOOD_CATEGORIES]).toEqual([...FOODS_META.categories])
    expect([...FOOD_FLAGS]).toEqual([...FOODS_META.flagVocabulary])
  })

  it('has unique ids', () => {
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length)
  })

  it('has a finite non-negative fat number on every entry', () => {
    for (const food of FOODS) {
      expect(Number.isFinite(food.fatGrams)).toBe(true)
      expect(food.fatGrams).toBeGreaterThanOrEqual(0)
    }
  })

  it('treats notes as the only nullable field', () => {
    for (const food of FOODS) {
      expect(food.name).not.toBeNull()
      expect(food.servingDescription).not.toBeNull()
      expect(food.aliases).not.toBeNull()
      expect(food.tags).not.toBeNull()
      expect(food.flags).not.toBeNull()
      expect(food.modifications).not.toBeNull()
    }
  })

  it('indexes by id', () => {
    expect(FOODS_BY_ID.size).toBe(211)
    const first = FOODS.at(0)
    expect(first).toBeDefined()
    if (first === undefined) return
    expect(FOODS_BY_ID.get(first.id)).toEqual(first)
  })

  it('contains no em dashes or en dashes in anything she reads', () => {
    for (const food of FOODS) {
      const strings = [
        food.name,
        food.servingDescription,
        ...food.aliases,
        ...food.modifications,
        ...(food.notes === null ? [] : [food.notes]),
      ]
      for (const text of strings) {
        expect(text).not.toMatch(DASH_PATTERN)
      }
    }
  })
})

describe('the dataset through the rating engine', () => {
  it('rates the one alcohol entry red with no modifications in every mode', () => {
    const alcohol = FOODS.filter((f) => f.flags.includes('alcohol'))
    expect(alcohol).toHaveLength(1)

    for (const food of alcohol) {
      // The data ships a modification on this entry. Invariant 4 says none is
      // ever offered, so the engine has to drop it.
      expect(food.modifications.length).toBeGreaterThan(0)

      for (const mode of ['stable', 'recovering', 'flare'] as const) {
        const result = rateFoodEntry(food, { target: 30, mode })
        expect(result.rating).toBe('red')
        expect(result.modifications).toEqual([])
      }
    }
  })

  it('leaves a workable flare pantry', () => {
    // Sanity check on the amended thresholds: flare at T=15 should not rate
    // everything red, or the screen is useless on the day she needs it most.
    const greens = FOODS.filter(
      (f) => rateFoodEntry(f, { target: 15, mode: 'flare' }).rating === 'green',
    )
    expect(greens.length).toBeGreaterThan(20)
  })
})

describe('parseFoods', () => {
  it('does not throw on a non-object', () => {
    expect(() => parseFoods(null, 'test')).not.toThrow()
    expect(() => parseFoods('nope', 'test')).not.toThrow()
    expect(parseFoods(null, 'test').foods).toEqual([])
    expect(parseFoods(null, 'test').problems.length).toBeGreaterThan(0)
  })

  it('reports a missing foods array', () => {
    const result = parseFoods({ _meta: {} }, 'test')
    expect(result.foods).toEqual([])
    expect(result.problems.length).toBeGreaterThan(0)
  })

  it('reports an entry with no id', () => {
    const result = parseFoods(fileWith([validEntry({ id: '' })]), 'test')
    expect(result.foods).toEqual([])
    expect(result.problems.map((p) => p.field)).toContain('id')
  })

  it('reports a negative fat number', () => {
    const result = parseFoods(fileWith([validEntry({ fatGrams: -1 })]), 'test')
    expect(result.foods).toEqual([])
    expect(result.problems.map((p) => p.field)).toContain('fatGrams')
  })

  it('reports an unknown category', () => {
    const result = parseFoods(fileWith([validEntry({ category: 'invented' })]), 'test')
    expect(result.foods).toEqual([])
    expect(result.problems.map((p) => p.field)).toContain('category')
  })

  it('reports an unknown flag', () => {
    const result = parseFoods(fileWith([validEntry({ flags: ['made-up'] })]), 'test')
    expect(result.foods).toEqual([])
    expect(result.problems.map((p) => p.field)).toContain('flags')
  })

  it('reports a duplicate id and keeps the first', () => {
    const result = parseFoods(
      fileWith([validEntry({ name: 'First' }), validEntry({ name: 'Second' })]),
      'test',
    )
    expect(result.foods).toHaveLength(1)
    expect(result.foods.at(0)?.name).toBe('First')
    expect(result.problems.map((p) => p.field)).toContain('id')
  })

  it('drops one broken entry and keeps its valid siblings', () => {
    const result = parseFoods(
      fileWith([
        validEntry({ id: 'good-one' }),
        validEntry({ id: 'bad-one', fatGrams: 'lots' }),
        validEntry({ id: 'good-two' }),
      ]),
      'test',
    )
    expect(result.foods.map((f) => f.id)).toEqual(['good-one', 'good-two'])
    expect(result.problems).toHaveLength(1)
  })

  it('names the file and the entry in a problem', () => {
    const result = parseFoods(fileWith([validEntry({ id: 'broken', category: 'nope' })]), 'foods')
    expect(result.problems.at(0)?.source).toBe('foods')
    expect(result.problems.at(0)?.entry).toBe('broken')
  })

  it('accepts a well formed entry', () => {
    const result = parseFoods(fileWith([validEntry()]), 'test')
    expect(result.problems).toEqual([])
    expect(result.foods).toHaveLength(1)
  })
})
