/**
 * Her versions. The workaround she worked out, in her own words.
 *
 * Spec section 5.3: "Add a 'save my version' field so when she works out a
 * version that succeeds, it becomes hers permanently, in her own words. Over
 * months, this becomes the most valuable screen in the app, because it is
 * authored by her."
 *
 * Invariant 3: localStorage only, through storage.ts, which is the only module
 * allowed to touch it. Nothing here throws. A corrupted blob costs her one row,
 * never the list.
 *
 * THE SUBJECT IS STORED AS A KEY, NOT A SNAPSHOT, THE SAME WAY A SAVED
 * RESTAURANT'S CUISINE IS. See the long note at the top of savedRestaurants.ts
 * for the reasoning; it applies here unchanged. The shipped swaps are general
 * guidance that should get better underneath her, so subjectId points into
 * substitutions.json rather than copying it in. What is HERS is the title and
 * the body, and those are stored outright. If an entry ever disappears from
 * substitutions.json, her version still renders with her title and her body and
 * simply carries no guidance block. It is never dropped.
 *
 * DELETION IS PER ROW AND EXPLICIT. There is no bulk clear here, no select-all,
 * and no function that removes more than one version. That is a constraint on
 * future work rather than a description of today's code: see the warning on
 * storage.clearAll, which would sweep these up if a reset feature ever called
 * it, and the note above commitVersion for why that matters more here than
 * anywhere else in the app.
 */

import { newId } from './ids.ts'
import * as storage from './storage.ts'
import { isNonEmptyString, isRecord } from './validate.ts'

export const MY_VERSIONS_STORAGE_KEY = 'myVersions'

export interface MyVersion {
  id: string
  /** Hers. What she calls it. Seeded from the entry name, always editable. */
  title: string
  /** Hers. Free text, never validated for content. The point of the screen. */
  body: string
  /**
   * A KEY into substitutions.json, or null when she wrote it freehand about
   * something the list has never heard of. Never a snapshot.
   */
  subjectId: string | null
  /** ISO timestamp. */
  savedAt: string
  /** ISO timestamp. Equal to savedAt until she edits it. */
  updatedAt: string
}

/** What the save form hands over. */
export interface MyVersionDraft {
  title: string
  body: string
  subjectId: string | null
}

function hydrateVersion(raw: unknown): MyVersion | null {
  if (!isRecord(raw)) return null
  if (!isNonEmptyString(raw.id)) return null
  if (!isNonEmptyString(raw.title)) return null

  /*
   * The body is hers and may legitimately be empty: a title alone is a valid
   * note meaning "this one is worth remembering". So isNonEmptyString is the
   * wrong guard here, exactly as it is for a saved restaurant's notes. Only the
   * type matters.
   */
  const body = typeof raw.body === 'string' ? raw.body : ''
  // An unrecognised subject becomes null rather than dropping the row. The
  // shipped list is allowed to change; her writing is not allowed to be lost
  // because of it.
  const subjectId = isNonEmptyString(raw.subjectId) ? raw.subjectId : null
  // A damaged timestamp costs the ordering of one row, not the row.
  const savedAt = isNonEmptyString(raw.savedAt) ? raw.savedAt : ''

  return {
    id: raw.id,
    title: raw.title,
    body,
    subjectId,
    savedAt,
    updatedAt: isNonEmptyString(raw.updatedAt) ? raw.updatedAt : savedAt,
  }
}

/**
 * Degrades one row at a time rather than blanking the list, the same way
 * hydrateSaved and hydrateLog do. Duplicate ids are collapsed on the way in.
 */
export function hydrateVersions(raw: unknown): MyVersion[] {
  const list = isRecord(raw) && Array.isArray(raw.items) ? raw.items : raw
  if (!Array.isArray(list)) return []

  const seen = new Set<string>()
  const versions: MyVersion[] = []

  for (const candidate of list) {
    const version = hydrateVersion(candidate)
    if (version === null) continue
    if (seen.has(version.id)) continue
    seen.add(version.id)
    versions.push(version)
  }

  return versions
}

export function readVersions(): MyVersion[] {
  return hydrateVersions(storage.get<unknown>(MY_VERSIONS_STORAGE_KEY, null))
}

/** False when the write did not stick. The caller decides whether to say so. */
export function writeVersions(versions: readonly MyVersion[]): boolean {
  return storage.set(MY_VERSIONS_STORAGE_KEY, { schemaVersion: 1, items: versions })
}

/** Pure. Newest first, so the list reads most recently written at the top. */
export function addVersion(
  versions: readonly MyVersion[],
  draft: MyVersionDraft,
  when: Date = new Date(),
): MyVersion[] {
  const stamp = when.toISOString()
  const version: MyVersion = {
    id: newId(when),
    title: draft.title.trim(),
    body: draft.body,
    subjectId: draft.subjectId,
    savedAt: stamp,
    updatedAt: stamp,
  }
  return [version, ...versions]
}

/** Pure. Unknown id is a no-op rather than an error. */
export function updateVersion(
  versions: readonly MyVersion[],
  id: string,
  draft: MyVersionDraft,
  when: Date = new Date(),
): MyVersion[] {
  return versions.map((version) =>
    version.id === id
      ? {
          ...version,
          title: draft.title.trim(),
          body: draft.body,
          subjectId: draft.subjectId,
          updatedAt: when.toISOString(),
        }
      : version,
  )
}

/**
 * Pure. Removes exactly one row, by id, and an unknown id is a no-op.
 *
 * This is the ONLY removal path in the module, and it is meant to stay that way.
 * It is called from one place, the remove control on that row, behind a
 * confirmation. No bulk clear, no select-all, no keyboard shortcut. See the
 * module header and the note above commitVersion.
 */
export function removeVersion(versions: readonly MyVersion[], id: string): MyVersion[] {
  return versions.filter((version) => version.id !== id)
}

/*
 * A SAVE ALWAYS ADDS. Saving a title that already exists does not update that
 * row, and this is not a missing upsert waiting to be tidied up.
 *
 * commitSaved in savedRestaurants.ts does the opposite, deliberately: saving her
 * regular restaurant twice should not give her two of it, because a restaurant
 * is a place and there is only one of it. A version is not a place. Two attempts
 * at the same dish are two different things she may want to keep, and the second
 * one is not always the better one. Last winter's cornbread and this winter's
 * cornbread are both hers.
 *
 * The deeper reason is that these are the ONLY content in this app that cannot
 * be regenerated. Everything else can be rebuilt from the repo: foods.json, the
 * playbook, the daily lifts, and even her food log has the dataset standing
 * behind it. This is her own writing, worked out over months at her own stove,
 * and there is no copy of it anywhere. An overwrite here is not an edit, it is a
 * permanent loss with no undo.
 *
 * Editing an existing version is explicit, through that row's own edit control,
 * which calls updateVersion.
 */
export function commitVersion(
  versions: readonly MyVersion[],
  draft: MyVersionDraft,
  when: Date = new Date(),
): MyVersion[] {
  return addVersion(versions, draft, when)
}

/** Hers, for one entry, newest first. Empty when she has not written one yet. */
export function versionsFor(
  versions: readonly MyVersion[],
  subjectId: string,
): MyVersion[] {
  return versions.filter((version) => version.subjectId === subjectId)
}
