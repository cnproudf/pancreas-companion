import { describe, expect, it } from 'vitest'
import { findChain, searchChains } from './restaurantSearch.ts'
import type { RestaurantChain } from '../types.ts'

/**
 * The matcher itself is fuzzy.ts, already covered by fuzzy.test.ts. What this
 * file checks is that the chain index is wired up correctly and that a null
 * means what the screen thinks it means.
 */

function chain(patch: Partial<RestaurantChain> = {}): RestaurantChain {
  return {
    id: 'test',
    name: 'Test',
    aliases: [],
    cuisine: 'american',
    nutritionUrl: null,
    ...patch,
  }
}

describe('findChain against the real list', () => {
  it('resolves a chain typed exactly', () => {
    expect(findChain('Olive Garden')?.chain.cuisine).toBe('italian')
    expect(findChain('Panda Express')?.chain.cuisine).toBe('chinese')
    expect(findChain('Outback Steakhouse')?.chain.cuisine).toBe('steakhouse')
  })

  it('survives a one-handed typo at a table', () => {
    expect(findChain('olive gardens')?.chain.id).toBe('olive-garden')
    expect(findChain('cracker barel')?.chain.id).toBe('cracker-barrel')
  })

  it('resolves through an alias', () => {
    // The name carries punctuation that a query never does. normalize strips it,
    // but the aliases are what make the bare spellings reliable.
    expect(findChain('mcdonalds')?.chain.id).toBe('mcdonalds')
    expect(findChain('chickfila')?.chain.id).toBe('chick-fil-a')
    expect(findChain('jimmy johns')?.chain.id).toBe('jimmy-johns')
  })

  it('returns null for a place the playbook does not know', () => {
    // Not a failure. This is the seam Phase 11 hands to the Worker, and until
    // then the screen falls back to the universal strategy.
    expect(findChain("Bob's place down the road")).toBeNull()
    expect(findChain('Zzzzqqq')).toBeNull()
  })

  it('returns null for an empty query rather than a first-entry match', () => {
    expect(findChain('')).toBeNull()
    expect(findChain('   ')).toBeNull()
  })
})

describe('searchChains', () => {
  it('returns one entry per chain even when several strings match', () => {
    const fixture = [chain({ id: 'a', name: 'Pizza Place', aliases: ['pizza', 'pizza place'] })]
    const matches = searchChains('pizza place', { chains: fixture })
    expect(matches).toHaveLength(1)
  })

  it('prefers a name match over an alias match at the same score', () => {
    const fixture = [
      chain({ id: 'by-alias', name: 'Something Else', aliases: ['taco spot'] }),
      chain({ id: 'by-name', name: 'Taco Spot' }),
    ]
    expect(searchChains('taco spot', { chains: fixture }).at(0)?.chain.id).toBe('by-name')
  })

  it('breaks a full tie deterministically by id', () => {
    const fixture = [
      chain({ id: 'zeta', name: 'Same Name' }),
      chain({ id: 'alpha', name: 'Same Name' }),
    ]
    const first = searchChains('same name', { chains: fixture }).at(0)?.chain.id
    const again = searchChains('same name', { chains: fixture }).at(0)?.chain.id
    expect(first).toBe('alpha')
    expect(again).toBe('alpha')
  })
})
