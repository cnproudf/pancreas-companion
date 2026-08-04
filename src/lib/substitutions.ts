/**
 * Loads data/substitutions.json.
 *
 * Same policy as foods.ts and restaurantPlaybook.ts, for the same reasons: the
 * loader never throws, it validates entry by entry, drops what is malformed, and
 * collects what it dropped into SUBSTITUTION_PROBLEMS. A bad hand edit should
 * cost one entry, not the screen. substitutions.test.ts is the strict half of
 * that policy and asserts SUBSTITUTION_PROBLEMS is empty against the real file,
 * so CI turns a bad edit into a red X on the pull request rather than a quietly
 * shorter list of workarounds.
 *
 * THIS MODULE IS ALSO WHERE THE GRAMS COME FROM.
 *
 * substitutions.json stores no fat numbers. An entry names an id from foods.json
 * and the grams and serving are read from there, so a value corrected in
 * foods.json corrects this screen too and the two files cannot drift. A swap
 * with no matching food entry (air fried, broth saute, a cornstarch cream base)
 * carries its own fatGrams and servingDescription instead, and carries exactly
 * one of the two forms. Resolution happens once, here, so no component ever
 * reaches into foods.json to finish an entry off.
 *
 * INVARIANT 4 IS ENFORCED HERE, NOT ONLY IN A TEST. An entry whose standard
 * version carries the alcohol flag is dropped outright, because this whole
 * screen exists to offer her a modified version of something and invariant 4
 * says alcohol never gets one. The copy test is the second line, not the first.
 */

import substitutionsJson from '@data/substitutions.json'
import type { Substitution, SubstitutionResource, SubstitutionSwap } from '../types.ts'
import { FOODS_BY_ID } from './foods.ts'
import {
  isFiniteNumber,
  isNonEmptyString,
  isRecord,
  isStringArray,
  type DataProblem,
} from './validate.ts'

export type { DataProblem } from './validate.ts'

export interface SubstitutionsMeta {
  /** Instructions for whoever finds a dead link. Asserted non-empty. */
  maintenanceNote: string
}

function readMeta(raw: unknown): SubstitutionsMeta {
  const meta = isRecord(raw) && isRecord(raw._meta) ? raw._meta : {}
  return {
    maintenanceNote: isNonEmptyString(meta.maintenanceNote) ? meta.maintenanceNote : '',
  }
}

export interface ParsedSubstitutions {
  substitutions: Substitution[]
  resources: SubstitutionResource[]
  problems: DataProblem[]
  meta: SubstitutionsMeta
}

function parseResources(
  raw: unknown,
  source: string,
  problems: DataProblem[],
): SubstitutionResource[] {
  const resources: SubstitutionResource[] = []

  if (!Array.isArray(raw)) {
    problems.push({ source, entry: 'file', field: 'resources', message: 'Expected an array.' })
    return resources
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
    if (!isNonEmptyString(candidate.note)) return fail('note', 'Missing or empty note.')

    /*
     * Identical rule to parseChains in restaurantPlaybook.ts. null is the
     * deliberate value for a resource that has closed, not a missing field.
     * Anything else has to be an https URL: these open in a new tab from a
     * health app, and http would be a downgrade she has no reason to accept.
     */
    if (candidate.url !== null) {
      if (!isNonEmptyString(candidate.url)) return fail('url', 'Expected an https URL or null.')
      if (!candidate.url.startsWith('https://')) {
        return fail('url', 'Expected the URL to start with https://')
      }
    }

    seen.add(candidate.id)
    resources.push({
      id: candidate.id,
      name: candidate.name,
      url: candidate.url,
      note: candidate.note,
    })
  })

  return resources
}

/**
 * One swap, resolved. Returns null on any problem, and the caller drops the
 * whole entry rather than showing her a swap list with a hole in it.
 */
function parseSwap(
  raw: unknown,
  source: string,
  entry: string,
  problems: DataProblem[],
): SubstitutionSwap | null {
  const fail = (field: string, message: string): null => {
    problems.push({ source, entry, field, message })
    return null
  }

  if (!isRecord(raw)) return fail('swaps', 'Expected an object.')
  if (!isNonEmptyString(raw.to)) return fail('to', 'Missing or empty target.')
  if (!isNonEmptyString(raw.how)) return fail('how', 'Missing or empty how.')
  // Null is the deliberate value for "nothing honest to warn about". A missing
  // field is an edit that forgot, and those read the same at a glance, so the
  // key has to be present.
  if (raw.tradeoff !== null && !isNonEmptyString(raw.tradeoff)) {
    return fail('tradeoff', 'Expected a string or null.')
  }

  const hasFoodId = raw.foodId !== undefined
  const hasLiteral = raw.fatGrams !== undefined

  if (hasFoodId && hasLiteral) {
    return fail('foodId', 'A swap carries either foodId or fatGrams, never both.')
  }

  if (hasFoodId) {
    if (!isNonEmptyString(raw.foodId)) return fail('foodId', 'Expected a foods.json id.')
    const food = FOODS_BY_ID.get(raw.foodId)
    if (food === undefined) return fail('foodId', `Unknown food id: ${raw.foodId}`)
    return {
      to: raw.to,
      fatGrams: food.fatGrams,
      servingDescription: food.servingDescription,
      how: raw.how,
      tradeoff: raw.tradeoff,
      foodId: food.id,
    }
  }

  if (hasLiteral) {
    if (!isFiniteNumber(raw.fatGrams) || raw.fatGrams < 0) {
      return fail('fatGrams', 'Expected a finite number of grams, zero or more.')
    }
    if (!isNonEmptyString(raw.servingDescription)) {
      return fail('servingDescription', 'A literal swap must say what the serving is.')
    }
    return {
      to: raw.to,
      fatGrams: raw.fatGrams,
      servingDescription: raw.servingDescription,
      how: raw.how,
      tradeoff: raw.tradeoff,
      foodId: null,
    }
  }

  return fail('foodId', 'A swap carries either foodId or fatGrams. This one has neither.')
}

function parseSubstitutions(
  raw: unknown,
  source: string,
  problems: DataProblem[],
): Substitution[] {
  const substitutions: Substitution[] = []

  if (!Array.isArray(raw)) {
    problems.push({ source, entry: 'file', field: 'substitutions', message: 'Expected an array.' })
    return substitutions
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
    if (!isNonEmptyString(candidate.why)) return fail('why', 'Missing or empty why.')

    if (!isNonEmptyString(candidate.standardFoodId)) {
      return fail('standardFoodId', 'Missing or empty standardFoodId.')
    }
    const standard = FOODS_BY_ID.get(candidate.standardFoodId)
    if (standard === undefined) {
      return fail('standardFoodId', `Unknown food id: ${candidate.standardFoodId}`)
    }
    /*
     * Invariant 4, structurally. This screen offers a modified version of the
     * thing she names, and alcohol never gets one. A future edit that adds an
     * alcohol entry here loses it at load rather than shipping it.
     */
    if (standard.flags.includes('alcohol')) {
      return fail('standardFoodId', 'Invariant 4: no workaround is ever offered for alcohol.')
    }

    if (!Array.isArray(candidate.swaps) || candidate.swaps.length === 0) {
      return fail('swaps', 'Expected a non-empty array of swaps.')
    }

    const swaps: SubstitutionSwap[] = []
    for (const rawSwap of candidate.swaps) {
      const swap = parseSwap(rawSwap, source, candidate.id, problems)
      // parseSwap has already recorded why. Drop the whole entry rather than
      // rendering a swap list with a gap in it.
      if (swap === null) return
      swaps.push(swap)
    }

    seen.add(candidate.id)
    substitutions.push({
      id: candidate.id,
      name: candidate.name,
      aliases: candidate.aliases,
      standardFoodId: standard.id,
      standardFatGrams: standard.fatGrams,
      standardServingDescription: standard.servingDescription,
      why: candidate.why,
      swaps,
    })
  })

  return substitutions
}

export function parseSubstitutionsFile(raw: unknown, source: string): ParsedSubstitutions {
  const problems: DataProblem[] = []
  const meta = readMeta(raw)

  if (!isRecord(raw)) {
    problems.push({ source, entry: 'file', field: 'file', message: 'Expected an object.' })
    return { substitutions: [], resources: [], problems, meta }
  }

  return {
    substitutions: parseSubstitutions(raw.substitutions, source, problems),
    resources: parseResources(raw.resources, source, problems),
    problems,
    meta,
  }
}

// Through unknown deliberately, exactly as foods.ts and restaurantPlaybook.ts
// do. resolveJsonModule infers a structural type from the literal, and depending
// on it here would make the runtime validation decorative.
const parsed = parseSubstitutionsFile(substitutionsJson as unknown, 'data/substitutions.json')

export const SUBSTITUTIONS: readonly Substitution[] = parsed.substitutions
export const SUBSTITUTION_RESOURCES: readonly SubstitutionResource[] = parsed.resources
export const SUBSTITUTION_PROBLEMS: readonly DataProblem[] = parsed.problems
export const SUBSTITUTIONS_META: SubstitutionsMeta = parsed.meta

export const SUBSTITUTIONS_BY_ID: ReadonlyMap<string, Substitution> = new Map(
  SUBSTITUTIONS.map((entry) => [entry.id, entry]),
)
