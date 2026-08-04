/**
 * Loads data/foods.json.
 *
 * The loader never throws. It validates, drops anything malformed, and collects
 * what it dropped into FOOD_PROBLEMS. Throwing at module scope would be a white
 * screen, and invariant 7 sets the house style of degrading quietly rather than
 * showing her an error state. Rendering 210 of 211 foods is the right runtime
 * behaviour.
 *
 * Silently losing data forever would not be, which is what foods.test.ts is
 * for: it asserts FOOD_PROBLEMS is empty against the real file. CI runs the
 * tests before the build, so a bad hand edit fails the pull request. The
 * permissive runtime and the strict test are one policy seen from two sides.
 */

import foodsJson from '@data/foods.json'
import { FOOD_CATEGORIES, FOOD_FLAGS, type Food, type FoodCategory, type FoodFlag } from '../types.ts'
import {
  isFiniteNumber,
  isNonEmptyString,
  isRecord,
  isStringArray,
  type DataProblem,
} from './validate.ts'

export type { DataProblem } from './validate.ts'

export interface FoodsMeta {
  categories: readonly string[]
  flagVocabulary: readonly string[]
}

/**
 * Vocabularies are read from the file's own _meta where possible, so the
 * validator cannot drift from the data it is validating. The literal unions in
 * types.ts are a separate concern, guarded by a drift test.
 */
function readMeta(raw: unknown): FoodsMeta {
  const meta = isRecord(raw) && isRecord(raw._meta) ? raw._meta : {}
  return {
    categories: isStringArray(meta.categories) ? meta.categories : [...FOOD_CATEGORIES],
    flagVocabulary: isStringArray(meta.flagVocabulary)
      ? meta.flagVocabulary
      : [...FOOD_FLAGS],
  }
}

export function parseFoods(
  raw: unknown,
  source: string,
): { foods: Food[]; problems: DataProblem[]; meta: FoodsMeta } {
  const problems: DataProblem[] = []
  const foods: Food[] = []
  const meta = readMeta(raw)

  if (!isRecord(raw) || !Array.isArray(raw.foods)) {
    problems.push({
      source,
      entry: 'file',
      field: 'foods',
      message: 'Expected an object with a foods array.',
    })
    return { foods, problems, meta }
  }

  const seen = new Set<string>()

  raw.foods.forEach((candidate, index) => {
    const label = isRecord(candidate) && isNonEmptyString(candidate.id) ? candidate.id : `index ${index}`
    const fail = (field: string, message: string): void => {
      problems.push({ source, entry: label, field, message })
    }

    if (!isRecord(candidate)) {
      fail('entry', 'Expected an object.')
      return
    }

    if (!isNonEmptyString(candidate.id)) {
      fail('id', 'Missing or empty id.')
      return
    }
    if (seen.has(candidate.id)) {
      fail('id', 'Duplicate id. The first one wins.')
      return
    }

    if (!isNonEmptyString(candidate.name)) return fail('name', 'Missing or empty name.')
    if (!isNonEmptyString(candidate.servingDescription)) {
      return fail('servingDescription', 'Missing or empty serving description.')
    }
    if (!isFiniteNumber(candidate.fatGrams) || candidate.fatGrams < 0) {
      return fail('fatGrams', 'Expected a finite number of grams, zero or more.')
    }
    if (!isStringArray(candidate.aliases)) return fail('aliases', 'Expected an array of strings.')
    if (!isStringArray(candidate.tags)) return fail('tags', 'Expected an array of strings.')
    if (!isStringArray(candidate.modifications)) {
      return fail('modifications', 'Expected an array of strings.')
    }
    if (candidate.notes !== null && !isNonEmptyString(candidate.notes)) {
      return fail('notes', 'Expected a string or null.')
    }
    if (!isNonEmptyString(candidate.category) || !meta.categories.includes(candidate.category)) {
      return fail('category', `Unknown category: ${String(candidate.category)}`)
    }
    if (!isStringArray(candidate.flags)) return fail('flags', 'Expected an array of strings.')
    const unknownFlag = candidate.flags.find((flag) => !meta.flagVocabulary.includes(flag))
    if (unknownFlag !== undefined) return fail('flags', `Unknown flag: ${unknownFlag}`)
    if (new Set(candidate.flags).size !== candidate.flags.length) {
      return fail('flags', 'Repeated flag.')
    }

    seen.add(candidate.id)
    foods.push({
      id: candidate.id,
      name: candidate.name,
      aliases: candidate.aliases,
      servingDescription: candidate.servingDescription,
      fatGrams: candidate.fatGrams,
      category: candidate.category as FoodCategory,
      tags: candidate.tags,
      flags: candidate.flags as FoodFlag[],
      modifications: candidate.modifications,
      notes: candidate.notes,
    })
  })

  return { foods, problems, meta }
}

// Through unknown deliberately. resolveJsonModule infers a structural type from
// the literal, and depending on it here would make the runtime validation
// decorative. The validator is the source of type truth.
const parsed = parseFoods(foodsJson as unknown, 'data/foods.json')

export const FOODS: readonly Food[] = parsed.foods
export const FOOD_PROBLEMS: readonly DataProblem[] = parsed.problems
export const FOODS_META: FoodsMeta = parsed.meta
export const FOODS_BY_ID: ReadonlyMap<string, Food> = new Map(FOODS.map((food) => [food.id, food]))
