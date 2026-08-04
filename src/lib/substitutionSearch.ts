/**
 * Fuzzy lookup over the workarounds list.
 *
 * Deliberately a near copy of foodSearch.ts rather than a generalization of it.
 * The two indexes are built from different shapes, the tie-breaks would have to
 * be parameterized, and a shared generic would be harder to read than either
 * concrete version. If a third one ever appears, that is the time to extract.
 *
 * All the actual matching is reused: scoreMatch, normalize, and both thresholds
 * come from fuzzy.ts unchanged, so a typo at a grocery store shelf behaves the
 * same here as it does in the food checker.
 */

import type { Substitution } from '../types.ts'
import { MIN_MATCH_SCORE, normalize, scoreMatch } from './fuzzy.ts'
import { SUBSTITUTIONS } from './substitutions.ts'

export interface SubstitutionMatch {
  substitution: Substitution
  score: number
  /** The exact string that matched, so the UI can say why. */
  matchedOn: string
  matchedField: 'name' | 'alias'
}

export interface SubstitutionSearchOptions {
  limit?: number | undefined
  minScore?: number | undefined
  /** For tests, so scoring can be checked against a fixture. */
  substitutions?: readonly Substitution[] | undefined
}

interface Candidate {
  substitution: Substitution
  text: string
  field: 'name' | 'alias'
  /** Precomputed so search does no normalizing per keystroke. */
  normalizedLength: number
}

function buildIndex(substitutions: readonly Substitution[]): Candidate[] {
  const index: Candidate[] = []
  for (const substitution of substitutions) {
    index.push({
      substitution,
      text: substitution.name,
      field: 'name',
      normalizedLength: normalize(substitution.name).length,
    })
    for (const alias of substitution.aliases) {
      index.push({
        substitution,
        text: alias,
        field: 'alias',
        normalizedLength: normalize(alias).length,
      })
    }
  }
  return index
}

const DEFAULT_INDEX = buildIndex(SUBSTITUTIONS)

function isBetter(
  a: SubstitutionMatch & { normalizedLength: number },
  b: SubstitutionMatch & { normalizedLength: number },
): boolean {
  if (a.score !== b.score) return a.score > b.score
  if (a.matchedField !== b.matchedField) return a.matchedField === 'name'
  if (a.normalizedLength !== b.normalizedLength) return a.normalizedLength < b.normalizedLength
  return a.substitution.id < b.substitution.id
}

/**
 * Best matches, one entry per workaround. Same tie-break order as searchFoods,
 * for the same reasons: higher score, then a name match over an alias match,
 * then the shorter candidate as the more specific one, then id for determinism.
 */
export function searchSubstitutions(
  query: string,
  options: SubstitutionSearchOptions = {},
): SubstitutionMatch[] {
  if (normalize(query) === '') return []

  const minScore = options.minScore ?? MIN_MATCH_SCORE
  const index =
    options.substitutions === undefined ? DEFAULT_INDEX : buildIndex(options.substitutions)

  const bestById = new Map<string, SubstitutionMatch & { normalizedLength: number }>()

  for (const candidate of index) {
    const score = scoreMatch(query, candidate.text)
    if (score < minScore) continue

    const existing = bestById.get(candidate.substitution.id)
    const contender = {
      substitution: candidate.substitution,
      score,
      matchedOn: candidate.text,
      matchedField: candidate.field,
      normalizedLength: candidate.normalizedLength,
    }

    if (existing === undefined || isBetter(contender, existing)) {
      bestById.set(candidate.substitution.id, contender)
    }
  }

  const matches = [...bestById.values()].sort((a, b) =>
    isBetter(a, b) ? -1 : isBetter(b, a) ? 1 : 0,
  )

  const limit = options.limit
  const trimmed = limit === undefined ? matches : matches.slice(0, limit)
  return trimmed.map(({ substitution, score, matchedOn, matchedField }) => ({
    substitution,
    score,
    matchedOn,
    matchedField,
  }))
}

/**
 * The single best match, or null. A null is not a failure. It means the list
 * does not have this one yet, and the screen answers that by keeping the save
 * form open so she can write her own version of it anyway.
 */
export function findSubstitution(
  query: string,
  options: SubstitutionSearchOptions = {},
): SubstitutionMatch | null {
  return searchSubstitutions(query, { ...options, limit: 1 }).at(0) ?? null
}
