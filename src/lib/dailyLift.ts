/**
 * Loads the Daily Lift rotation and the friend notes.
 *
 * The rotation is split across three hand-maintained files (001-060, 061-215,
 * 216-365) so batches could be written and reviewed separately. They are merged
 * here into one array of 365. Same never-throw policy as foods.ts.
 *
 * This module stops at the arrays. Choosing today's item, the deterministic
 * per-day rotation, and the twice-a-week friend note weighting live in
 * liftRotation.ts, which is pure and knows nothing about parsing.
 */

import liftFile1 from '@data/daily-lift.json'
import liftFile2 from '@data/daily-lift-061-215.json'
import liftFile3 from '@data/daily-lift-216-365.json'
import friendsFile from '@data/friends-notes.json'
import { LIFT_TYPES, type FriendNote, type LiftEntry, type LiftType } from '../types.ts'
import { isNonEmptyString, isRecord, type DataProblem } from './validate.ts'

/**
 * A friend note is not a lift entry. It has no `type` and it does have a `from`.
 * Rather than invent a "from-a-friend" type the hand-authored data does not
 * carry, the two shapes stay distinct and liftRotation.ts interleaves this
 * union.
 */
export type LiftItem =
  | { kind: 'lift'; entry: LiftEntry }
  | { kind: 'friend-note'; note: FriendNote }

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function isLiftType(value: unknown): value is LiftType {
  return typeof value === 'string' && (LIFT_TYPES as readonly string[]).includes(value)
}

export function parseLiftFile(
  raw: unknown,
  source: string,
): { entries: LiftEntry[]; problems: DataProblem[] } {
  const problems: DataProblem[] = []
  const entries: LiftEntry[] = []

  if (!isRecord(raw) || !Array.isArray(raw.entries)) {
    problems.push({
      source,
      entry: 'file',
      field: 'entries',
      message: 'Expected an object with an entries array.',
    })
    return { entries, problems }
  }

  raw.entries.forEach((candidate, index) => {
    const label =
      isRecord(candidate) && isNonEmptyString(candidate.id) ? candidate.id : `index ${index}`
    const fail = (field: string, message: string): void => {
      problems.push({ source, entry: label, field, message })
    }

    if (!isRecord(candidate)) return fail('entry', 'Expected an object.')
    if (!isNonEmptyString(candidate.id)) return fail('id', 'Missing or empty id.')
    if (!isLiftType(candidate.type)) return fail('type', `Unknown type: ${String(candidate.type)}`)
    if (!isNonEmptyString(candidate.content)) return fail('content', 'Missing or empty content.')
    if (candidate.attribution !== undefined && !isNonEmptyString(candidate.attribution)) {
      return fail('attribution', 'Expected a non-empty string when present.')
    }

    // Conditional spread, not `attribution: candidate.attribution`.
    // exactOptionalPropertyTypes forbids assigning an explicit undefined, and
    // the data distinguishes absent from null.
    entries.push({
      id: candidate.id,
      type: candidate.type,
      content: candidate.content,
      ...(candidate.attribution !== undefined ? { attribution: candidate.attribution } : {}),
    })
  })

  return { entries, problems }
}

/**
 * Concatenates the files in order, then checks id uniqueness across the merged
 * set. That cross-file check is the point: within one file a repeat is easy to
 * spot, across three it is not.
 */
export function mergeLiftFiles(
  files: readonly { raw: unknown; source: string }[],
): { entries: LiftEntry[]; problems: DataProblem[] } {
  const problems: DataProblem[] = []
  const entries: LiftEntry[] = []
  const seen = new Set<string>()

  for (const file of files) {
    const parsed = parseLiftFile(file.raw, file.source)
    problems.push(...parsed.problems)

    for (const entry of parsed.entries) {
      if (seen.has(entry.id)) {
        problems.push({
          source: file.source,
          entry: entry.id,
          field: 'id',
          message: 'Duplicate id across the lift files. The first one wins.',
        })
        continue
      }
      seen.add(entry.id)
      entries.push(entry)
    }
  }

  // Ids are zero padded to three digits, so lexicographic equals numeric.
  entries.sort((a, b) => a.id.localeCompare(b.id))
  return { entries, problems }
}

export function parseFriendNotes(
  raw: unknown,
  source: string,
): { notes: FriendNote[]; problems: DataProblem[] } {
  const problems: DataProblem[] = []
  const notes: FriendNote[] = []

  if (!isRecord(raw) || !Array.isArray(raw.notes)) {
    problems.push({
      source,
      entry: 'file',
      field: 'notes',
      message: 'Expected an object with a notes array.',
    })
    return { notes, problems }
  }

  raw.notes.forEach((candidate, index) => {
    const label =
      isRecord(candidate) && isNonEmptyString(candidate.id) ? candidate.id : `index ${index}`
    const fail = (field: string, message: string): void => {
      problems.push({ source, entry: label, field, message })
    }

    if (!isRecord(candidate)) return fail('entry', 'Expected an object.')
    if (!isNonEmptyString(candidate.id)) return fail('id', 'Missing or empty id.')
    if (!isNonEmptyString(candidate.from)) return fail('from', 'Every note needs a first name.')
    if (!isNonEmptyString(candidate.content)) return fail('content', 'Missing or empty content.')
    if (!isNonEmptyString(candidate.dateAdded) || !ISO_DATE.test(candidate.dateAdded)) {
      return fail('dateAdded', 'Expected a date like 2026-08-03.')
    }

    notes.push({
      id: candidate.id,
      from: candidate.from,
      content: candidate.content,
      dateAdded: candidate.dateAdded,
    })
  })

  return { notes, problems }
}

const mergedLift = mergeLiftFiles([
  { raw: liftFile1 as unknown, source: 'data/daily-lift.json' },
  { raw: liftFile2 as unknown, source: 'data/daily-lift-061-215.json' },
  { raw: liftFile3 as unknown, source: 'data/daily-lift-216-365.json' },
])

const parsedNotes = parseFriendNotes(friendsFile as unknown, 'data/friends-notes.json')

export const LIFT_ENTRIES: readonly LiftEntry[] = mergedLift.entries
export const FRIEND_NOTES: readonly FriendNote[] = parsedNotes.notes
export const LIFT_PROBLEMS: readonly DataProblem[] = [...mergedLift.problems, ...parsedNotes.problems]
