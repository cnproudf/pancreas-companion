/**
 * Runtime type guards for the hand-authored JSON in data/.
 *
 * The data is bundled at build time, so a syntax error is already a build
 * failure. What these have to survive is a shape problem introduced by a hand
 * edit, since friends-notes.json openly invites people who do not write code to
 * add to it on GitHub. Nothing here throws.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** An array in which every element is a non-empty string. Empty passes. */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString)
}

/** One problem found while reading a data file. Collected, never thrown. */
export interface DataProblem {
  /** Which file, so the message can name it. */
  source: string
  /** The entry id when it is readable, otherwise a positional fallback. */
  entry: string
  field: string
  message: string
}
