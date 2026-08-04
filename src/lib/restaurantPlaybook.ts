/**
 * Loads data/restaurant-playbook.json.
 *
 * Same policy as foods.ts, for the same reasons: the loader never throws, it
 * validates entry by entry, drops what is malformed, and collects what it
 * dropped into PLAYBOOK_PROBLEMS. A bad hand edit should cost one cuisine, not
 * the screen. restaurantPlaybook.test.ts is the strict half of that policy, and
 * asserts PLAYBOOK_PROBLEMS is empty against the real file, so CI turns a bad
 * edit into a red X on the pull request rather than a quietly shorter playbook.
 *
 * This module stops at the data. Matching a typed restaurant name against the
 * chain list lives in restaurantSearch.ts.
 */

import playbookJson from '@data/restaurant-playbook.json'
import {
  CUISINES,
  type Cuisine,
  type CuisinePlaybook,
  type RestaurantChain,
  type UniversalPlaybook,
} from '../types.ts'
import { isNonEmptyString, isRecord, isStringArray, type DataProblem } from './validate.ts'

export type { DataProblem } from './validate.ts'

export interface PlaybookMeta {
  cuisines: readonly string[]
  /** Instructions for whoever finds a dead nutrition link. Asserted non-empty. */
  maintenanceNote: string
}

/**
 * The vocabulary is read from the file's own _meta where possible, so the
 * validator cannot drift from the data it is validating. The literal union in
 * types.ts is a separate concern, guarded by a drift test.
 */
function readMeta(raw: unknown): PlaybookMeta {
  const meta = isRecord(raw) && isRecord(raw._meta) ? raw._meta : {}
  return {
    cuisines: isStringArray(meta.cuisines) ? meta.cuisines : [...CUISINES],
    maintenanceNote: isNonEmptyString(meta.maintenanceNote) ? meta.maintenanceNote : '',
  }
}

export interface ParsedPlaybook {
  /**
   * Null only when the section is unparseable. The screen renders its empty
   * state rather than cuisine tips with no universal frame, because the
   * universal strategy is the part that is supposed to always be there.
   */
  universal: UniversalPlaybook | null
  cuisines: CuisinePlaybook[]
  chains: RestaurantChain[]
  problems: DataProblem[]
  meta: PlaybookMeta
}

function parseUniversal(
  raw: unknown,
  source: string,
  problems: DataProblem[],
): UniversalPlaybook | null {
  const fail = (field: string, message: string): null => {
    problems.push({ source, entry: 'universal', field, message })
    return null
  }

  if (!isRecord(raw)) return fail('universal', 'Missing or not an object.')
  if (!isNonEmptyString(raw.title)) return fail('title', 'Missing or empty title.')
  if (!isStringArray(raw.strategies) || raw.strategies.length === 0) {
    return fail('strategies', 'Expected a non-empty array of strings.')
  }
  if (!isNonEmptyString(raw.scriptLine)) return fail('scriptLine', 'Missing or empty script line.')

  return { title: raw.title, strategies: raw.strategies, scriptLine: raw.scriptLine }
}

function parseCuisines(
  raw: unknown,
  source: string,
  vocabulary: readonly string[],
  problems: DataProblem[],
): CuisinePlaybook[] {
  const cuisines: CuisinePlaybook[] = []

  if (!Array.isArray(raw)) {
    problems.push({ source, entry: 'file', field: 'cuisines', message: 'Expected an array.' })
    return cuisines
  }

  const seen = new Set<string>()

  raw.forEach((candidate, index) => {
    const label =
      isRecord(candidate) && isNonEmptyString(candidate.cuisine)
        ? candidate.cuisine
        : `index ${index}`
    const fail = (field: string, message: string): void => {
      problems.push({ source, entry: label, field, message })
    }

    if (!isRecord(candidate)) return fail('entry', 'Expected an object.')
    if (!isNonEmptyString(candidate.cuisine) || !vocabulary.includes(candidate.cuisine)) {
      return fail('cuisine', `Unknown cuisine: ${String(candidate.cuisine)}`)
    }
    if (seen.has(candidate.cuisine)) return fail('cuisine', 'Duplicate cuisine. The first one wins.')
    if (!isNonEmptyString(candidate.label)) return fail('label', 'Missing or empty label.')
    if (!isNonEmptyString(candidate.scriptLine)) {
      return fail('scriptLine', 'Missing or empty script line.')
    }

    /*
     * All three lists must be present and non-empty. A cuisine with an empty
     * safe bets list is worse than no entry at all: she would open it at a table
     * and find a heading with nothing under it.
     */
    for (const field of ['safeBets', 'avoid', 'askFor'] as const) {
      const value = candidate[field]
      if (!isStringArray(value) || value.length === 0) {
        return fail(field, 'Expected a non-empty array of strings.')
      }
    }

    seen.add(candidate.cuisine)
    cuisines.push({
      cuisine: candidate.cuisine as Cuisine,
      label: candidate.label,
      safeBets: candidate.safeBets as string[],
      avoid: candidate.avoid as string[],
      askFor: candidate.askFor as string[],
      scriptLine: candidate.scriptLine,
    })
  })

  return cuisines
}

function parseChains(
  raw: unknown,
  source: string,
  vocabulary: readonly string[],
  problems: DataProblem[],
): RestaurantChain[] {
  const chains: RestaurantChain[] = []

  if (!Array.isArray(raw)) {
    problems.push({ source, entry: 'file', field: 'chains', message: 'Expected an array.' })
    return chains
  }

  const seen = new Set<string>()

  raw.forEach((candidate, index) => {
    const label = isRecord(candidate) && isNonEmptyString(candidate.id) ? candidate.id : `index ${index}`
    const fail = (field: string, message: string): void => {
      problems.push({ source, entry: label, field, message })
    }

    if (!isRecord(candidate)) return fail('entry', 'Expected an object.')
    if (!isNonEmptyString(candidate.id)) return fail('id', 'Missing or empty id.')
    if (seen.has(candidate.id)) return fail('id', 'Duplicate id. The first one wins.')
    if (!isNonEmptyString(candidate.name)) return fail('name', 'Missing or empty name.')
    if (!isStringArray(candidate.aliases)) return fail('aliases', 'Expected an array of strings.')
    if (!isNonEmptyString(candidate.cuisine) || !vocabulary.includes(candidate.cuisine)) {
      return fail('cuisine', `Unknown cuisine: ${String(candidate.cuisine)}`)
    }

    /*
     * null is the deliberate value for "publishes nothing findable", not a
     * missing field. Anything else has to be an https URL: a chain page is
     * opened in a new tab from a health app, and http would be a downgrade she
     * has no reason to accept.
     */
    if (candidate.nutritionUrl !== null) {
      if (!isNonEmptyString(candidate.nutritionUrl)) {
        return fail('nutritionUrl', 'Expected an https URL or null.')
      }
      if (!candidate.nutritionUrl.startsWith('https://')) {
        return fail('nutritionUrl', 'Expected the URL to start with https://')
      }
    }

    seen.add(candidate.id)
    chains.push({
      id: candidate.id,
      name: candidate.name,
      aliases: candidate.aliases,
      cuisine: candidate.cuisine as Cuisine,
      nutritionUrl: candidate.nutritionUrl,
    })
  })

  return chains
}

export function parsePlaybook(raw: unknown, source: string): ParsedPlaybook {
  const problems: DataProblem[] = []
  const meta = readMeta(raw)

  if (!isRecord(raw)) {
    problems.push({ source, entry: 'file', field: 'file', message: 'Expected an object.' })
    return { universal: null, cuisines: [], chains: [], problems, meta }
  }

  return {
    universal: parseUniversal(raw.universal, source, problems),
    cuisines: parseCuisines(raw.cuisines, source, meta.cuisines, problems),
    chains: parseChains(raw.chains, source, meta.cuisines, problems),
    problems,
    meta,
  }
}

// Through unknown deliberately, exactly as foods.ts does. resolveJsonModule
// infers a structural type from the literal, and depending on it here would make
// the runtime validation decorative.
const parsed = parsePlaybook(playbookJson as unknown, 'data/restaurant-playbook.json')

export const UNIVERSAL_PLAYBOOK: UniversalPlaybook | null = parsed.universal
export const CUISINE_PLAYBOOKS: readonly CuisinePlaybook[] = parsed.cuisines
export const RESTAURANT_CHAINS: readonly RestaurantChain[] = parsed.chains
export const PLAYBOOK_PROBLEMS: readonly DataProblem[] = parsed.problems
export const PLAYBOOK_META: PlaybookMeta = parsed.meta

export const PLAYBOOK_BY_CUISINE: ReadonlyMap<Cuisine, CuisinePlaybook> = new Map(
  CUISINE_PLAYBOOKS.map((entry) => [entry.cuisine, entry]),
)

export const CHAINS_BY_ID: ReadonlyMap<string, RestaurantChain> = new Map(
  RESTAURANT_CHAINS.map((chain) => [chain.id, chain]),
)
