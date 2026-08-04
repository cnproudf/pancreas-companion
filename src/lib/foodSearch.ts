/**
 * Fuzzy lookup over the food dataset.
 *
 * Answering "can I eat this" in under five seconds is the whole point of the
 * app, so this has to survive a one-handed typo at a restaurant table.
 */

import type { Food } from '../types.ts'
import { FOODS } from './foods.ts'
import { MIN_MATCH_SCORE, normalize, scoreMatch } from './fuzzy.ts'

export interface FoodMatch {
  food: Food
  score: number
  /** The exact string that matched, so the UI can say why. */
  matchedOn: string
  matchedField: 'name' | 'alias'
}

export interface SearchOptions {
  limit?: number | undefined
  minScore?: number | undefined
  /** For tests, so scoring can be checked against a fixture. */
  foods?: readonly Food[] | undefined
}

interface Candidate {
  food: Food
  text: string
  field: 'name' | 'alias'
  /** Precomputed so search does no normalizing per keystroke. */
  normalizedLength: number
}

function buildIndex(foods: readonly Food[]): Candidate[] {
  const index: Candidate[] = []
  for (const food of foods) {
    index.push({
      food,
      text: food.name,
      field: 'name',
      normalizedLength: normalize(food.name).length,
    })
    for (const alias of food.aliases) {
      index.push({
        food,
        text: alias,
        field: 'alias',
        normalizedLength: normalize(alias).length,
      })
    }
  }
  return index
}

// Built once at module scope. 211 foods, roughly 330 searchable strings.
const DEFAULT_INDEX = buildIndex(FOODS)

/**
 * Best matches, one entry per food.
 *
 * Deduplicating by food rather than by candidate string matters: alcohol-any
 * carries nine aliases and would otherwise take the whole result list.
 *
 * Tie-breaks, in order, so two runs never disagree:
 *   1. higher score
 *   2. a name match over an alias match, a stronger identity claim
 *   3. the shorter candidate, as the more specific one
 *   4. food id, lexicographic, purely for determinism
 */
export function searchFoods(query: string, options: SearchOptions = {}): FoodMatch[] {
  if (normalize(query) === '') return []

  const minScore = options.minScore ?? MIN_MATCH_SCORE
  const index = options.foods === undefined ? DEFAULT_INDEX : buildIndex(options.foods)

  const bestByFood = new Map<string, FoodMatch & { normalizedLength: number }>()

  for (const candidate of index) {
    const score = scoreMatch(query, candidate.text)
    if (score < minScore) continue

    const existing = bestByFood.get(candidate.food.id)
    const contender = {
      food: candidate.food,
      score,
      matchedOn: candidate.text,
      matchedField: candidate.field,
      normalizedLength: candidate.normalizedLength,
    }

    if (existing === undefined || isBetter(contender, existing)) {
      bestByFood.set(candidate.food.id, contender)
    }
  }

  const matches = [...bestByFood.values()].sort((a, b) => (isBetter(a, b) ? -1 : isBetter(b, a) ? 1 : 0))

  const limit = options.limit
  const trimmed = limit === undefined ? matches : matches.slice(0, limit)
  return trimmed.map(({ food, score, matchedOn, matchedField }) => ({
    food,
    score,
    matchedOn,
    matchedField,
  }))
}

function isBetter(
  a: FoodMatch & { normalizedLength: number },
  b: FoodMatch & { normalizedLength: number },
): boolean {
  if (a.score !== b.score) return a.score > b.score
  if (a.matchedField !== b.matchedField) return a.matchedField === 'name'
  if (a.normalizedLength !== b.normalizedLength) return a.normalizedLength < b.normalizedLength
  return a.food.id < b.food.id
}

/**
 * The single best match, or null. A null is not a failure: it is the signal
 * that the local dataset does not have this one, which is what Phase 11 uses to
 * decide whether to ask the Worker.
 */
export function findFood(query: string, options: SearchOptions = {}): FoodMatch | null {
  return searchFoods(query, { ...options, limit: 1 }).at(0) ?? null
}
