/**
 * Safe staples. Spec section 5.9:
 *
 *   "A pre-built, editable grocery list of reliable items, organized by store
 *   section, that she can check off. Seed it and let her edit freely. Include
 *   an 'add from my saved favorites' path."
 *
 * SEEDED FROM foods.json, NOT COPIED OUT OF IT.
 *
 * The 24 items tagged `pantry-staple` are the seed, and storage holds only the
 * DIFF: what she has checked, what she has hidden, and what she has added
 * herself. Same philosophy as savedRestaurants.ts storing a cuisine key rather
 * than a snapshot: the shipped list is general guidance that should get better
 * underneath her, and copying it into storage would freeze today's version of
 * it in her device forever.
 *
 * THE STORE SECTIONS ARE HAND AUTHORED HERE, AND DELIBERATELY NOT IN data/.
 *
 * A food's category is what it IS; a store section is where it is SHELVED, and
 * the two disagree often enough to matter. Canned tuna is `seafood` and lives
 * in the pantry aisle. Applesauce is `fruit` and is nowhere near the produce
 * section. Getting that wrong would send her to the wrong end of the store
 * while she is already tired, which is the one thing this screen exists to
 * prevent.
 *
 * data/ is hand-authored and off limits without asking, and a store layout is a
 * display concern rather than a fact about the food, so the mapping lives here.
 * Anything not in the table falls back to its category, so a staple added to
 * foods.json later lands somewhere sensible instead of breaking the list.
 *
 * SPEC 5.9'S "ADD FROM MY SAVED FAVORITES" IS IMPLEMENTED AS "ADD FROM WHAT YOU
 * HAVE LOGGED", AND THE SUBSTITUTION IS DELIBERATE.
 *
 * There is no food-favorites store in this app. `liftFavorites` holds Daily Lift
 * entries, and `myVersions` holds her own recipe writing, which is a workaround
 * for a dish rather than something she buys. The honest mapping for "things she
 * already knows work for her" is her food log, so that is what the add path
 * pulls from. Recorded here rather than done quietly.
 *
 * Invariant 3: localStorage only, through storage.ts. Nothing here throws.
 */

import { FOODS } from './foods.ts'
import { newId } from './ids.ts'
import * as storage from './storage.ts'
import type { FoodCategory } from '../types.ts'
import { isNonEmptyString, isRecord, isStringArray } from './validate.ts'

export const STAPLES_STORAGE_KEY = 'staples'

/** The tag in foods.json that seeds this list. */
export const STAPLE_TAG = 'pantry-staple'

/**
 * Store sections, in the order she would walk them.
 *
 * Produce first and frozen last is the route through most American grocery
 * stores, and a list that matches the walk is a list she does not have to
 * double back through.
 */
export const STORE_SECTIONS = [
  'produce',
  'meat-seafood',
  'dairy-eggs',
  'bakery',
  'canned',
  'dry-goods',
  'condiments',
  'frozen',
  'other',
] as const

export type StoreSection = (typeof STORE_SECTIONS)[number]

export const SECTION_LABELS: Record<StoreSection, string> = {
  produce: 'Produce',
  'meat-seafood': 'Meat and seafood',
  'dairy-eggs': 'Dairy and eggs',
  bakery: 'Bread and bakery',
  canned: 'Canned and jarred',
  'dry-goods': 'Pantry and dry goods',
  condiments: 'Condiments',
  frozen: 'Frozen',
  other: 'Other',
}

/**
 * Where each seeded staple is actually shelved.
 *
 * Only the ones whose category would send her to the wrong aisle strictly need
 * to be here, but all 24 are listed so the list reads as one authored thing and
 * a reviewer can check it against a real store rather than against a fallback
 * rule.
 */
const SECTION_BY_FOOD_ID: Readonly<Record<string, StoreSection>> = {
  /* Refrigerated */
  'deli-turkey': 'meat-seafood',
  'egg-substitute': 'dairy-eggs',
  'skim-milk': 'dairy-eggs',
  'greek-yogurt-nonfat': 'dairy-eggs',
  'cottage-cheese-1': 'dairy-eggs',

  'english-muffin': 'bakery',

  /* Shelf stable, and this is where the category would mislead */
  'tuna-canned-water': 'canned', // category seafood, shelved in the pantry aisle
  'black-beans': 'canned',
  'pinto-beans': 'canned',
  applesauce: 'canned', // category fruit, nowhere near produce
  'peaches-canned-juice': 'canned',
  salsa: 'canned',
  'chicken-broth': 'canned',

  'white-rice': 'dry-goods',
  'pasta-plain': 'dry-goods',
  saltines: 'dry-goods',
  pretzels: 'dry-goods',
  'popcorn-air-popped': 'dry-goods',
  oatmeal: 'dry-goods',
  'graham-crackers': 'dry-goods',
  gelatin: 'dry-goods',

  mustard: 'condiments',
  'cooking-spray': 'condiments',
  'butter-spray-fat-free': 'condiments',
}

/**
 * The fallback for anything not in the table above, so a staple added to
 * foods.json later lands somewhere sensible instead of vanishing.
 */
const SECTION_BY_CATEGORY: Readonly<Record<FoodCategory, StoreSection>> = {
  poultry: 'meat-seafood',
  seafood: 'meat-seafood',
  'red-meat': 'meat-seafood',
  eggs: 'dairy-eggs',
  'plant-protein': 'canned',
  dairy: 'dairy-eggs',
  'grain-starch': 'dry-goods',
  vegetable: 'produce',
  fruit: 'produce',
  'condiment-fat': 'condiments',
  soup: 'canned',
  'composed-dish': 'other',
  regional: 'other',
  dessert: 'dry-goods',
  beverage: 'other',
}

/** One line on the list, after seeding and her edits have been resolved. */
export interface StapleItem {
  /** The foods.json id for a seeded item, or a local id for one she added. */
  id: string
  name: string
  section: StoreSection
  checked: boolean
  /** True when she typed it. Hers to remove outright; seeded ones are hidden. */
  own: boolean
}

/** What storage actually holds: her edits, not the list. */
export interface StaplesState {
  /** Ids currently ticked off. Seeded and her own alike. */
  checked: string[]
  /** Seeded ids she does not want to see. Never deleted, so they can come back. */
  hidden: string[]
  /** Items she typed. */
  added: { id: string; name: string; section: StoreSection }[]
}

export const EMPTY_STAPLES: StaplesState = { checked: [], hidden: [], added: [] }

export const STAPLES_COPY = {
  title: 'Safe staples',
  intro: 'A list to shop from. Check things off, add your own, hide anything you do not want.',
  addLabel: 'Add an item',
  addPlaceholder: 'What do you want to add?',
  addSection: 'Which part of the store?',
  addSubmit: 'Add to the list',
  /*
   * Spec 5.9 says "add from my saved favorites". There is no food-favorites
   * store in this app, so this pulls from her food log instead. See the header.
   */
  fromLogTitle: 'Add from what you have logged',
  fromLogEmpty: 'Nothing logged yet. Anything you log will show up here to add.',
  hide: 'Hide',
  restore: 'Put back',
  remove: 'Remove',
  hiddenTitle: 'Hidden items',
  /*
   * Unchecking everything after a shopping trip, in one tap. Worded as starting
   * something rather than as clearing a record, because that is what it is: the
   * list itself is untouched.
   */
  startNewList: 'Start a new list',
  empty: 'Nothing on the list yet.',
} as const

/** Where one seeded food is shelved. */
export function sectionForFood(id: string, category: FoodCategory): StoreSection {
  return SECTION_BY_FOOD_ID[id] ?? SECTION_BY_CATEGORY[category]
}

/** The shipped list, from foods.json, in the file's order. */
export const SEED_STAPLES: readonly { id: string; name: string; section: StoreSection }[] =
  FOODS.filter((food) => food.tags.includes(STAPLE_TAG)).map((food) => ({
    id: food.id,
    name: food.name,
    section: sectionForFood(food.id, food.category),
  }))

function isSection(value: unknown): value is StoreSection {
  return typeof value === 'string' && (STORE_SECTIONS as readonly string[]).includes(value)
}

function hydrateAdded(raw: unknown): StaplesState['added'] {
  if (!Array.isArray(raw)) return []

  const seen = new Set<string>()
  const added: StaplesState['added'] = []

  for (const candidate of raw) {
    if (!isRecord(candidate)) continue
    if (!isNonEmptyString(candidate.id)) continue
    // Her own writing. An item with no name is not a list line, so it goes.
    if (!isNonEmptyString(candidate.name)) continue
    if (seen.has(candidate.id)) continue

    seen.add(candidate.id)
    added.push({
      id: candidate.id,
      name: candidate.name,
      // An unrecognised section lands in Other rather than dropping her item.
      section: isSection(candidate.section) ? candidate.section : 'other',
    })
  }

  return added
}

/** Degrades one field at a time rather than blanking her list. */
export function hydrateStaples(raw: unknown): StaplesState {
  if (!isRecord(raw)) return { ...EMPTY_STAPLES }

  return {
    checked: isStringArray(raw.checked) ? [...new Set(raw.checked)] : [],
    hidden: isStringArray(raw.hidden) ? [...new Set(raw.hidden)] : [],
    added: hydrateAdded(raw.added),
  }
}

export function readStaples(): StaplesState {
  return hydrateStaples(storage.get<unknown>(STAPLES_STORAGE_KEY, null))
}

/** False when the write did not stick. The caller decides whether to say so. */
export function writeStaples(state: StaplesState): boolean {
  return storage.set(STAPLES_STORAGE_KEY, { schemaVersion: 1, ...state })
}

/**
 * The list she sees: the seed minus what she hid, plus what she added, with her
 * checkmarks applied.
 */
export function resolveStaples(state: StaplesState): StapleItem[] {
  const hidden = new Set(state.hidden)
  const checked = new Set(state.checked)

  const seeded: StapleItem[] = SEED_STAPLES.filter((item) => !hidden.has(item.id)).map((item) => ({
    ...item,
    checked: checked.has(item.id),
    own: false,
  }))

  const own: StapleItem[] = state.added.map((item) => ({
    ...item,
    checked: checked.has(item.id),
    own: true,
  }))

  return [...seeded, ...own]
}

/** The list grouped for display, in STORE_SECTIONS order. Empty sections are dropped. */
export function bySection(items: readonly StapleItem[]): { section: StoreSection; items: StapleItem[] }[] {
  return STORE_SECTIONS.map((section) => ({
    section,
    items: items.filter((item) => item.section === section),
  })).filter((group) => group.items.length > 0)
}

/** Seeded items she has hidden, so the screen can offer them back. */
export function hiddenStaples(state: StaplesState): { id: string; name: string }[] {
  const hidden = new Set(state.hidden)
  return SEED_STAPLES.filter((item) => hidden.has(item.id)).map(({ id, name }) => ({ id, name }))
}

/* -------------------------------------------------------------------------- */
/* Pure updates                                                                */
/* -------------------------------------------------------------------------- */

export function toggleChecked(state: StaplesState, id: string): StaplesState {
  const checked = state.checked.includes(id)
    ? state.checked.filter((value) => value !== id)
    : [...state.checked, id]
  return { ...state, checked }
}

/**
 * Unchecks everything, and touches nothing else.
 *
 * This is the post-shopping-trip reset. It does not remove her own items, does
 * not restore hidden ones, and does not clear the list: the list is the point,
 * and the checkmarks are the disposable part.
 */
export function uncheckAll(state: StaplesState): StaplesState {
  if (state.checked.length === 0) return state
  return { ...state, checked: [] }
}

/**
 * Hides a seeded item. NOT a delete: the id is remembered so she can put it
 * back, and so an item she hid does not silently reappear when foods.json is
 * edited.
 */
export function hideStaple(state: StaplesState, id: string): StaplesState {
  if (state.hidden.includes(id)) return state
  return {
    ...state,
    hidden: [...state.hidden, id],
    checked: state.checked.filter((value) => value !== id),
  }
}

export function restoreStaple(state: StaplesState, id: string): StaplesState {
  if (!state.hidden.includes(id)) return state
  return { ...state, hidden: state.hidden.filter((value) => value !== id) }
}

/** Adds an item she typed. A blank name is a no-op rather than a blank row. */
export function addStaple(
  state: StaplesState,
  name: string,
  section: StoreSection,
  when: Date = new Date(),
): StaplesState {
  const trimmed = name.trim()
  if (trimmed === '') return state

  return {
    ...state,
    added: [...state.added, { id: newId(when), name: trimmed, section }],
  }
}

/**
 * Removes one of her own items outright.
 *
 * Hers to delete, unlike a seeded item, which is hidden rather than removed.
 * She wrote it, so she can unwrite it.
 */
export function removeStaple(state: StaplesState, id: string): StaplesState {
  return {
    ...state,
    added: state.added.filter((item) => item.id !== id),
    checked: state.checked.filter((value) => value !== id),
  }
}
