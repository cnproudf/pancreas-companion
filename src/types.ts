/**
 * Shared domain types. Kept in one place because the fat calculator, the
 * settings store, and (from Phase 2) the rating engine all key off the same
 * mode and activity vocabularies.
 */

/** Mode selector, spec section 4. Persisted, changeable in two taps. */
export type Mode = 'stable' | 'recovering' | 'flare'

export const MODES: readonly Mode[] = ['stable', 'recovering', 'flare'] as const

/** Addendum section A: mostly resting / light activity / moderately active. */
export type ActivityLevel = 'resting' | 'light' | 'moderate'

/**
 * Used only for the energy equation. "prefer-not-to-say" defaults to the female
 * equation, per addendum section A.
 */
export type BiologicalSex = 'female' | 'male' | 'prefer-not-to-say'

export interface CareTeamContact {
  id: string
  role: 'doctor' | 'dietitian' | 'hospital' | 'other'
  name: string
  phone: string
  notes: string
}

export interface Settings {
  /** Bumped when the persisted shape changes in a way that needs migrating. */
  schemaVersion: 1

  /**
   * Manual override. When set, this always takes precedence over the
   * calculation and is the authoritative value (addendum section A).
   * null means "use the calculator".
   */
  dailyFatTarget: number | null

  /**
   * A starting number she entered herself so the app can rate anything at all
   * before her body stats are in.
   *
   * Deliberately NOT dailyFatTarget. That field means a number from her care
   * team, and every screen that says "your care team's number wins" depends on
   * being able to tell the two apart. Merging them would make that claim a lie
   * and leave the settings screen no way to recover the provenance.
   *
   * Ranks below a real calculation, and is ignored in flare mode exactly as the
   * override is.
   */
  provisionalFatTarget: number | null

  age: number | null
  /** Stored in cm only. Feet and inches entry is a display-layer conversion. */
  heightCm: number | null
  /** Stored in kg only. Pounds entry is a display-layer conversion. */
  weightKg: number | null
  activityLevel: ActivityLevel
  biologicalSex: BiologicalSex

  takesEnzymes: boolean
  careTeamContacts: CareTeamContact[]

  currentMode: Mode

  /**
   * ISO timestamp of the last change to the body stats that feed the
   * calculator. Drives the 90 day soft prompt. Never nag.
   */
  bodyStatsUpdatedAt: string | null
}

/* -------------------------------------------------------------------------- */
/* Phase 2: food data and the rating engine                                    */
/* -------------------------------------------------------------------------- */

/**
 * The traffic light, main spec section 2. Invariant 8: a rating is never
 * rendered as colour alone, so every consumer takes the whole
 * RatingPresentation from rating.ts rather than this bare word.
 */
export type Rating = 'green' | 'yellow' | 'red'

/**
 * Mirrors data/foods.json _meta.categories, in order. foods.test.ts asserts
 * this stays in sync, so the literal union and the hand-authored data cannot
 * drift apart silently.
 */
export const FOOD_CATEGORIES = [
  'poultry',
  'seafood',
  'red-meat',
  'eggs',
  'plant-protein',
  'dairy',
  'grain-starch',
  'vegetable',
  'fruit',
  'condiment-fat',
  'soup',
  'composed-dish',
  'regional',
  'dessert',
  'beverage',
] as const

export type FoodCategory = (typeof FOOD_CATEGORIES)[number]

/**
 * Mirrors data/foods.json _meta.flagVocabulary, in order. Note "large-portion",
 * which the main spec's prose list omits but which its flare rule ("large
 * portion size") relies on. The data file is authoritative.
 */
export const FOOD_FLAGS = [
  'alcohol',
  'deep-fried',
  'full-fat-dairy',
  'high-fiber',
  'high-sugar',
  'spicy',
  'raw',
  'processed-meat',
  'hidden-fat',
  'large-portion',
] as const

export type FoodFlag = (typeof FOOD_FLAGS)[number]

/** One entry in data/foods.json. */
export interface Food {
  id: string
  name: string
  aliases: string[]
  servingDescription: string
  /**
   * An estimate, always. Values vary by brand, cut, and preparation, and every
   * surface that shows this number has to say so.
   */
  fatGrams: number
  category: FoodCategory
  tags: string[]
  flags: FoodFlag[]
  modifications: string[]
  /** The only nullable field in the dataset. */
  notes: string | null
}

/**
 * Daily Lift entry types actually present in the data.
 *
 * "from-a-friend" is deliberately absent. The main spec lists it as a sixth
 * type, but friends-notes.json entries have no `type` field at all and carry a
 * `from` instead. Rather than invent a field the hand-authored data does not
 * have, the two shapes stay distinct and are joined by the LiftItem union in
 * dailyLift.ts.
 */
export const LIFT_TYPES = [
  'encouragement',
  'fun-fact',
  'funny-story',
  'quote',
  'tiny-win',
] as const

export type LiftType = (typeof LIFT_TYPES)[number]

export interface LiftEntry {
  id: string
  type: LiftType
  content: string
  /**
   * Only on quotes. Absent rather than null on the other 353 entries, so with
   * exactOptionalPropertyTypes this must never be assigned an explicit
   * undefined. Build it with a conditional spread.
   */
  attribution?: string
}

/** One entry in data/friends-notes.json. The heart of the Daily Lift. */
export interface FriendNote {
  id: string
  /** The friend's first name, shown with warmer styling and no clinical chrome. */
  from: string
  content: string
  /** ISO date, YYYY-MM-DD. */
  dateAdded: string
}
