/**
 * The lifts she kept. Spec section 5.11: "a small heart button that saves it to
 * a favorites collection she can revisit on hard days."
 *
 * Invariant 3: localStorage only, through storage.ts, which is the only module
 * allowed to touch it. Nothing here throws. A corrupted blob costs her the list,
 * never the screen.
 *
 * Every saved item is a SNAPSHOT of the content, not a reference by id. Same
 * argument foodLog.ts makes for its copied fields, and it bites harder here:
 * friends-notes.json openly invites other people to edit it on GitHub, so
 * resolving through an id would let someone's edit silently rewrite a note she
 * kept, or delete it out from under her. A favorite is a thing she decided to
 * hold onto. It stops being the data's to change.
 */

import type { LiftItem } from './dailyLift.ts'
import * as storage from './storage.ts'
import { isNonEmptyString, isRecord } from './validate.ts'

export const LIFT_FAVORITES_STORAGE_KEY = 'liftFavorites'

export interface FavoriteLift {
  /** The source entry or note id. Stable, and what toggling keys off. */
  id: string
  kind: LiftItem['kind']
  content: string
  /** Present only on friend notes. The friend's first name. */
  from?: string
  /** Present only on attributed quotes. */
  attribution?: string
  /** ISO timestamp of when she saved it. */
  savedAt: string
}

export function toFavorite(item: LiftItem, when: Date = new Date()): FavoriteLift {
  const savedAt = when.toISOString()

  // Conditional spreads rather than assigning undefined: exactOptionalPropertyTypes
  // forbids that, and the shapes genuinely differ rather than sharing a nullable.
  if (item.kind === 'friend-note') {
    return {
      id: item.note.id,
      kind: 'friend-note',
      content: item.note.content,
      from: item.note.from,
      savedAt,
    }
  }

  return {
    id: item.entry.id,
    kind: 'lift',
    content: item.entry.content,
    ...(item.entry.attribution !== undefined ? { attribution: item.entry.attribution } : {}),
    savedAt,
  }
}

function hydrateFavorite(raw: unknown): FavoriteLift | null {
  if (!isRecord(raw)) return null
  if (!isNonEmptyString(raw.id)) return null
  if (!isNonEmptyString(raw.content)) return null
  if (raw.kind !== 'lift' && raw.kind !== 'friend-note') return null

  return {
    id: raw.id,
    kind: raw.kind,
    content: raw.content,
    ...(isNonEmptyString(raw.from) ? { from: raw.from } : {}),
    ...(isNonEmptyString(raw.attribution) ? { attribution: raw.attribution } : {}),
    // A missing or damaged timestamp costs the ordering of one row, not the row.
    savedAt: isNonEmptyString(raw.savedAt) ? raw.savedAt : '',
  }
}

/**
 * Degrades one row at a time rather than blanking the collection, the same way
 * hydrateLog and hydrateSettings do. Duplicate ids are collapsed on the way in,
 * because a list she scrolls on a bad day should not show the same note twice.
 */
export function hydrateFavorites(raw: unknown): FavoriteLift[] {
  const list = isRecord(raw) && Array.isArray(raw.items) ? raw.items : raw
  if (!Array.isArray(list)) return []

  const seen = new Set<string>()
  const favorites: FavoriteLift[] = []

  for (const candidate of list) {
    const favorite = hydrateFavorite(candidate)
    if (favorite === null) continue
    if (seen.has(favorite.id)) continue
    seen.add(favorite.id)
    favorites.push(favorite)
  }

  return favorites
}

export function readFavorites(): FavoriteLift[] {
  return hydrateFavorites(storage.get<unknown>(LIFT_FAVORITES_STORAGE_KEY, null))
}

/** False when the write did not stick. The caller decides whether to say so. */
export function writeFavorites(favorites: readonly FavoriteLift[]): boolean {
  return storage.set(LIFT_FAVORITES_STORAGE_KEY, { schemaVersion: 1, items: favorites })
}

export function isFavorited(favorites: readonly FavoriteLift[], id: string): boolean {
  return favorites.some((favorite) => favorite.id === id)
}

/** Pure. Newest first, so the panel reads most recent at the top. */
export function addFavorite(
  favorites: readonly FavoriteLift[],
  item: LiftItem,
  when: Date = new Date(),
): FavoriteLift[] {
  const favorite = toFavorite(item, when)
  if (isFavorited(favorites, favorite.id)) return [...favorites]
  return [favorite, ...favorites]
}

/** Pure. */
export function removeFavorite(
  favorites: readonly FavoriteLift[],
  id: string,
): FavoriteLift[] {
  return favorites.filter((favorite) => favorite.id !== id)
}

/** Pure. What the heart button actually calls. */
export function toggleFavorite(
  favorites: readonly FavoriteLift[],
  item: LiftItem,
  when: Date = new Date(),
): FavoriteLift[] {
  const id = item.kind === 'friend-note' ? item.note.id : item.entry.id
  return isFavorited(favorites, id)
    ? removeFavorite(favorites, id)
    : addFavorite(favorites, item, when)
}
