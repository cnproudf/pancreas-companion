/**
 * Her regular spots, with her own notes. Spec section 5.2: "so her regular spots
 * build up a personal, growing list of what worked, along with her own notes."
 *
 * Invariant 3: localStorage only, through storage.ts, which is the only module
 * allowed to touch it. Nothing here throws. A corrupted blob costs her one row,
 * never the screen.
 *
 * THE CUISINE IS STORED AS A KEY, NOT A SNAPSHOT, AND THAT IS THE OPPOSITE OF
 * WHAT liftFavorites.ts AND foodLog.ts DO.
 *
 * Those two copy their content in at save time, because a lift she kept and a
 * meal she ate are records of a moment that later edits to data/ must not
 * rewrite. This is the other case. The playbook is general guidance that should
 * get better underneath her: if someone improves the Italian avoid list next
 * year, she should see the better version at her Italian place, not a frozen
 * copy of what the file said the night she saved it.
 *
 * What is hers is the name and the notes, and those are stored outright. If a
 * cuisine key ever disappears from the playbook, the row still renders with her
 * name and her notes and simply carries no guidance block. It is never dropped.
 */

import { CUISINES, type Cuisine } from '../types.ts'
import { newId } from './ids.ts'
import * as storage from './storage.ts'
import { isNonEmptyString, isRecord } from './validate.ts'

export const SAVED_RESTAURANTS_STORAGE_KEY = 'savedRestaurants'

export interface SavedRestaurant {
  id: string
  name: string
  /** Null when she saved it without picking one. Resolved through the playbook. */
  cuisine: Cuisine | null
  /** Hers. Free text, may be empty, never validated for content. */
  notes: string
  /** ISO timestamp. */
  savedAt: string
  /** ISO timestamp. Equal to savedAt until she edits it. */
  updatedAt: string
}

/** What the save form hands over. */
export interface RestaurantDraft {
  name: string
  cuisine: Cuisine | null
  notes: string
}

function isCuisine(value: unknown): value is Cuisine {
  return typeof value === 'string' && (CUISINES as readonly string[]).includes(value)
}

function hydrateRestaurant(raw: unknown): SavedRestaurant | null {
  if (!isRecord(raw)) return null
  if (!isNonEmptyString(raw.id)) return null
  if (!isNonEmptyString(raw.name)) return null

  /*
   * An unrecognised cuisine becomes null rather than dropping the row. The
   * playbook is allowed to change; her list is not allowed to lose entries
   * because of it.
   */
  const cuisine = isCuisine(raw.cuisine) ? raw.cuisine : null
  // Notes are hers and may legitimately be empty, so isNonEmptyString is the
  // wrong guard here. Only the type matters.
  const notes = typeof raw.notes === 'string' ? raw.notes : ''
  // A damaged timestamp costs the ordering of one row, not the row.
  const savedAt = isNonEmptyString(raw.savedAt) ? raw.savedAt : ''

  return {
    id: raw.id,
    name: raw.name,
    cuisine,
    notes,
    savedAt,
    updatedAt: isNonEmptyString(raw.updatedAt) ? raw.updatedAt : savedAt,
  }
}

/**
 * Degrades one row at a time rather than blanking the list, the same way
 * hydrateFavorites and hydrateLog do. Duplicate ids are collapsed on the way in.
 */
export function hydrateSaved(raw: unknown): SavedRestaurant[] {
  const list = isRecord(raw) && Array.isArray(raw.items) ? raw.items : raw
  if (!Array.isArray(list)) return []

  const seen = new Set<string>()
  const saved: SavedRestaurant[] = []

  for (const candidate of list) {
    const restaurant = hydrateRestaurant(candidate)
    if (restaurant === null) continue
    if (seen.has(restaurant.id)) continue
    seen.add(restaurant.id)
    saved.push(restaurant)
  }

  return saved
}

export function readSaved(): SavedRestaurant[] {
  return hydrateSaved(storage.get<unknown>(SAVED_RESTAURANTS_STORAGE_KEY, null))
}

/** False when the write did not stick. The caller decides whether to say so. */
export function writeSaved(saved: readonly SavedRestaurant[]): boolean {
  return storage.set(SAVED_RESTAURANTS_STORAGE_KEY, { schemaVersion: 1, items: saved })
}

/**
 * The name she typed, normalized only for comparison. Used to spot that she is
 * saving a place already on the list, so "save" updates rather than creating a
 * second row for the same restaurant.
 */
function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export function findByName(
  saved: readonly SavedRestaurant[],
  name: string,
): SavedRestaurant | null {
  return saved.find((restaurant) => sameName(restaurant.name, name)) ?? null
}

/** Pure. Newest first, so the list reads most recently saved at the top. */
export function addSaved(
  saved: readonly SavedRestaurant[],
  draft: RestaurantDraft,
  when: Date = new Date(),
): SavedRestaurant[] {
  const stamp = when.toISOString()
  const restaurant: SavedRestaurant = {
    id: newId(when),
    name: draft.name.trim(),
    cuisine: draft.cuisine,
    notes: draft.notes,
    savedAt: stamp,
    updatedAt: stamp,
  }
  return [restaurant, ...saved]
}

/** Pure. Unknown id is a no-op rather than an error. */
export function updateSaved(
  saved: readonly SavedRestaurant[],
  id: string,
  draft: RestaurantDraft,
  when: Date = new Date(),
): SavedRestaurant[] {
  return saved.map((restaurant) =>
    restaurant.id === id
      ? {
          ...restaurant,
          name: draft.name.trim(),
          cuisine: draft.cuisine,
          notes: draft.notes,
          updatedAt: when.toISOString(),
        }
      : restaurant,
  )
}

/** Pure. */
export function removeSaved(saved: readonly SavedRestaurant[], id: string): SavedRestaurant[] {
  return saved.filter((restaurant) => restaurant.id !== id)
}

/**
 * What the save button calls. Saving a name already on the list updates that
 * row, so saving her regular place twice does not give her two of it.
 */
export function commitSaved(
  saved: readonly SavedRestaurant[],
  draft: RestaurantDraft,
  when: Date = new Date(),
): SavedRestaurant[] {
  const existing = findByName(saved, draft.name)
  return existing === null
    ? addSaved(saved, draft, when)
    : updateSaved(saved, existing.id, draft, when)
}
