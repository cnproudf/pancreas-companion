import { describe, expect, it } from 'vitest'
import { findFood, searchFoods } from './foodSearch.ts'

/**
 * Search against the real 211 entries, because a scoring function that looks
 * reasonable on fixtures and picks the wrong chicken dish in a restaurant is
 * worse than no search at all.
 */

describe('searchFoods', () => {
  it('finds the anchor food by an alias', () => {
    const match = searchFoods('grilled chicken').at(0)
    expect(match?.food.id).toBe('chicken-breast-skinless-baked')
    expect(match?.matchedField).toBe('alias')
    expect(match?.matchedOn).toBe('grilled chicken')
  })

  it('finds it by name too', () => {
    expect(searchFoods('chicken breast').at(0)?.food.id).toBe('chicken-breast-skinless-baked')
  })

  it('tolerates a typo', () => {
    expect(searchFoods('chicken brest').at(0)?.food.id).toBe('chicken-breast-skinless-baked')
  })

  it('finds alcohol by any of its aliases', () => {
    for (const query of ['wine', 'beer', 'bourbon', 'hard seltzer']) {
      expect(searchFoods(query).at(0)?.food.id).toBe('alcohol-any')
    }
  })

  it('finds french fries', () => {
    expect(searchFoods('french fries').at(0)?.food.id).toBe('french-fries')
    expect(searchFoods('fries').at(0)?.food.id).toBe('french-fries')
  })

  it('returns nothing for gibberish', () => {
    expect(searchFoods('zzzqqq')).toEqual([])
    expect(findFood('zzzqqq')).toBeNull()
  })

  it('returns nothing for an empty or punctuation-only query', () => {
    expect(searchFoods('')).toEqual([])
    expect(searchFoods('   ')).toEqual([])
    expect(searchFoods('???')).toEqual([])
  })

  it('lists a food at most once even when several aliases hit', () => {
    // alcohol-any carries nine aliases and would otherwise flood the results.
    const ids = searchFoods('wine', { limit: 20 }).map((m) => m.food.id)
    expect(ids.filter((id) => id === 'alcohol-any')).toHaveLength(1)
  })

  it('honours the limit', () => {
    expect(searchFoods('chicken', { limit: 3 }).length).toBeLessThanOrEqual(3)
  })

  it('is deterministic', () => {
    const once = searchFoods('chicken', { limit: 10 }).map((m) => m.food.id)
    const twice = searchFoods('chicken', { limit: 10 }).map((m) => m.food.id)
    expect(once).toEqual(twice)
  })

  it('sorts by descending score', () => {
    const scores = searchFoods('chicken', { limit: 10 }).map((m) => m.score)
    const sorted = [...scores].sort((a, b) => b - a)
    expect(scores).toEqual(sorted)
  })

  it('prefers a name match over an alias match at the same score', () => {
    const matches = searchFoods('turkey', { limit: 20, foods: [
      {
        id: 'by-alias',
        name: 'Something else entirely',
        aliases: ['turkey'],
        servingDescription: '1',
        fatGrams: 1,
        category: 'poultry',
        tags: [],
        flags: [],
        modifications: [],
        notes: null,
      },
      {
        id: 'by-name',
        name: 'Turkey',
        aliases: [],
        servingDescription: '1',
        fatGrams: 1,
        category: 'poultry',
        tags: [],
        flags: [],
        modifications: [],
        notes: null,
      },
    ] })
    expect(matches.at(0)?.food.id).toBe('by-name')
  })

  it('respects a caller supplied minScore', () => {
    expect(searchFoods('chicken brest', { minScore: 0.99 })).toEqual([])
  })
})

describe('findFood', () => {
  it('returns the single best match', () => {
    expect(findFood('grilled chicken')?.food.id).toBe('chicken-breast-skinless-baked')
  })

  it('returns null rather than a bad guess', () => {
    expect(findFood('qqqqzzzz')).toBeNull()
  })
})
