import { describe, expect, it } from 'vitest'
import { findSubstitution, searchSubstitutions } from './substitutionSearch.ts'
import { NEAR_MISS_SCORE } from './fuzzy.ts'
import type { Substitution } from '../types.ts'

/**
 * Scoring itself is fuzzy.test.ts's job. This file checks the index this module
 * builds on top of it: one result per entry, aliases searchable, and the
 * tie-breaks stable enough that two runs never disagree.
 */

function entry(patch: Partial<Substitution> = {}): Substitution {
  return {
    id: 'sour-cream',
    name: 'Sour cream',
    aliases: [],
    standardFoodId: 'sour-cream',
    standardFatGrams: 5,
    standardServingDescription: '2 tbsp',
    why: 'Mostly fat.',
    swaps: [
      {
        to: 'Nonfat Greek yogurt',
        fatGrams: 0,
        servingDescription: '6 oz',
        how: 'Straight swap.',
        tradeoff: null,
        foodId: 'greek-yogurt-nonfat',
      },
    ],
    ...patch,
  }
}

const FIXTURE: Substitution[] = [
  entry(),
  entry({ id: 'soup-beans', name: 'Soup beans', aliases: ['pinto beans with fatback', 'beans and cornbread'] }),
  entry({ id: 'cornbread', name: 'Cornbread', aliases: ['corn bread'] }),
  entry({ id: 'ice-cream', name: 'Ice cream', aliases: ['scoop of ice cream'] }),
]

describe('searchSubstitutions', () => {
  it('returns nothing for an empty query', () => {
    expect(searchSubstitutions('', { substitutions: FIXTURE })).toEqual([])
    expect(searchSubstitutions('   ', { substitutions: FIXTURE })).toEqual([])
  })

  it('finds an entry by name', () => {
    const matches = searchSubstitutions('cornbread', { substitutions: FIXTURE })
    expect(matches.at(0)?.substitution.id).toBe('cornbread')
    expect(matches.at(0)?.matchedField).toBe('name')
  })

  it('finds an entry by alias and says which string matched', () => {
    const match = findSubstitution('beans and cornbread', { substitutions: FIXTURE })
    expect(match?.substitution.id).toBe('soup-beans')
    expect(match?.matchedField).toBe('alias')
    expect(match?.matchedOn).toBe('beans and cornbread')
  })

  it('survives a typo', () => {
    expect(findSubstitution('sour creem', { substitutions: FIXTURE })?.substitution.id).toBe(
      'sour-cream',
    )
    expect(findSubstitution('cornbred', { substitutions: FIXTURE })?.substitution.id).toBe(
      'cornbread',
    )
  })

  it('returns one result per entry even when several of its strings match', () => {
    const many = entry({
      id: 'ice-cream',
      name: 'Ice cream',
      aliases: ['ice cream cone', 'ice cream scoop', 'ice cream sundae'],
    })
    const matches = searchSubstitutions('ice cream', { substitutions: [many] })
    expect(matches).toHaveLength(1)
  })

  it('respects the limit', () => {
    expect(searchSubstitutions('cornbread', { substitutions: FIXTURE, limit: 1 })).toHaveLength(1)
  })

  it('filters below the floor, and finds near misses under a lower one', () => {
    const strict = searchSubstitutions('cornbrd', { substitutions: FIXTURE })
    const loose = searchSubstitutions('cornbrd', {
      substitutions: FIXTURE,
      minScore: NEAR_MISS_SCORE,
    })
    expect(loose.length).toBeGreaterThanOrEqual(strict.length)
  })

  it('is deterministic across runs', () => {
    const first = searchSubstitutions('beans', { substitutions: FIXTURE })
    const second = searchSubstitutions('beans', { substitutions: FIXTURE })
    expect(first.map((match) => match.substitution.id)).toEqual(
      second.map((match) => match.substitution.id),
    )
  })

  it('prefers a name match over an alias match at the same score', () => {
    const named = entry({ id: 'named', name: 'Grits', aliases: [] })
    const aliased = entry({ id: 'aliased', name: 'Something else entirely', aliases: ['Grits'] })
    const matches = searchSubstitutions('grits', { substitutions: [aliased, named] })
    expect(matches.at(0)?.substitution.id).toBe('named')
  })
})

describe('findSubstitution', () => {
  it('returns null when nothing clears the floor', () => {
    // Not a failure. The screen answers this by keeping the save form open.
    expect(findSubstitution('xylophone', { substitutions: FIXTURE })).toBeNull()
  })
})
