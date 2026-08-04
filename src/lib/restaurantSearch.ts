/**
 * Matches a typed restaurant name against the bundled chain list.
 *
 * Reuses the food checker's matcher unchanged. The problem is the same shape,
 * one-handed typing at a table, and 46 chains is a smaller haystack than 211
 * foods, so nothing new belongs in fuzzy.ts for this.
 *
 * A null is not a failure. It means "not a chain I know", which is exactly the
 * seam Phase 11 hands to the Worker. Until then the screen falls back to the
 * universal strategy and a cuisine she picks herself, which is the honest
 * answer and never an error state.
 */

import type { RestaurantChain } from '../types.ts'
import { MIN_MATCH_SCORE, normalize, scoreMatch } from './fuzzy.ts'
import { RESTAURANT_CHAINS } from './restaurantPlaybook.ts'

export interface ChainMatch {
  chain: RestaurantChain
  score: number
  /** The exact string that matched, so the UI can say why. */
  matchedOn: string
  matchedField: 'name' | 'alias'
}

export interface ChainSearchOptions {
  minScore?: number | undefined
  /** For tests, so scoring can be checked against a fixture. */
  chains?: readonly RestaurantChain[] | undefined
}

interface Candidate {
  chain: RestaurantChain
  text: string
  field: 'name' | 'alias'
  normalizedLength: number
}

function buildIndex(chains: readonly RestaurantChain[]): Candidate[] {
  const index: Candidate[] = []
  for (const chain of chains) {
    index.push({
      chain,
      text: chain.name,
      field: 'name',
      normalizedLength: normalize(chain.name).length,
    })
    for (const alias of chain.aliases) {
      index.push({
        chain,
        text: alias,
        field: 'alias',
        normalizedLength: normalize(alias).length,
      })
    }
  }
  return index
}

const DEFAULT_INDEX = buildIndex(RESTAURANT_CHAINS)

interface Scored extends ChainMatch {
  normalizedLength: number
}

/**
 * Tie-breaks, in order, so two runs never disagree:
 *   1. higher score
 *   2. a name match over an alias match, a stronger identity claim
 *   3. the shorter candidate, as the more specific one
 *   4. chain id, lexicographic, purely for determinism
 *
 * Same ladder as foodSearch.isBetter.
 */
function isBetter(a: Scored, b: Scored): boolean {
  if (a.score !== b.score) return a.score > b.score
  if (a.matchedField !== b.matchedField) return a.matchedField === 'name'
  if (a.normalizedLength !== b.normalizedLength) return a.normalizedLength < b.normalizedLength
  return a.chain.id < b.chain.id
}

/** Every chain scoring at or above the floor, best first, one entry per chain. */
export function searchChains(
  query: string,
  options: ChainSearchOptions = {},
): ChainMatch[] {
  if (normalize(query) === '') return []

  const minScore = options.minScore ?? MIN_MATCH_SCORE
  const index = options.chains === undefined ? DEFAULT_INDEX : buildIndex(options.chains)

  const bestByChain = new Map<string, Scored>()

  for (const candidate of index) {
    const score = scoreMatch(query, candidate.text)
    if (score < minScore) continue

    const contender: Scored = {
      chain: candidate.chain,
      score,
      matchedOn: candidate.text,
      matchedField: candidate.field,
      normalizedLength: candidate.normalizedLength,
    }

    const existing = bestByChain.get(candidate.chain.id)
    if (existing === undefined || isBetter(contender, existing)) {
      bestByChain.set(candidate.chain.id, contender)
    }
  }

  return [...bestByChain.values()]
    .sort((a, b) => (isBetter(a, b) ? -1 : isBetter(b, a) ? 1 : 0))
    .map(({ chain, score, matchedOn, matchedField }) => ({ chain, score, matchedOn, matchedField }))
}

/** The single best chain, or null when this is not one the playbook knows. */
export function findChain(query: string, options: ChainSearchOptions = {}): ChainMatch | null {
  return searchChains(query, options).at(0) ?? null
}
