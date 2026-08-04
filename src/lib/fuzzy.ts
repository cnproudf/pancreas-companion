/**
 * Dependency-free string matching for the food checker.
 *
 * Hand rolled rather than pulled from npm, per the working agreement in
 * CLAUDE.md. The dataset is 211 entries with roughly 330 searchable strings, so
 * there is no need for anything clever.
 *
 * Nothing in here knows what a food is. foodSearch.ts applies it.
 */

/** Below this, there is no match. That is the signal to ask the Worker later. */
export const MIN_MATCH_SCORE = 0.45

/**
 * Not a match, but close enough to offer instead of an empty screen.
 *
 * Sits below the token tier's floor of 0.3, and corresponds to a Dice
 * coefficient of roughly 0.42 on the character tier, so a genuine typo surfaces
 * and unrelated words do not. Never used to rate anything: results in this band
 * are shown as "the closest things I do have", never as an answer.
 */
export const NEAR_MISS_SCORE = 0.25

/**
 * Lowercase, strip accents, spell out an ampersand, and turn everything that is
 * not a letter, a digit, or a space into a separator.
 *
 * NFD splits an accented letter into a base letter plus a combining mark, and
 * \p{M} then removes the marks, so "saute" and "sauté" compare equal. The data
 * is pure ASCII today, but a future creme brulee entry should not break search.
 *
 * The punctuation rule matters more than it looks: the food names are full of
 * commas and hyphens ("Chicken breast, skinless, baked", "low-fat"), and a
 * query never contains them.
 */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenize(input: string): string[] {
  const normalized = normalize(input)
  return normalized === '' ? [] : normalized.split(' ')
}

function bigrams(value: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (let i = 0; i < value.length - 1; i += 1) {
    // slice, not value[i] + value[i + 1]. noUncheckedIndexedAccess types the
    // latter as string | undefined.
    const pair = value.slice(i, i + 2)
    counts.set(pair, (counts.get(pair) ?? 0) + 1)
  }
  return counts
}

/**
 * Sorensen-Dice over character bigrams, counted as a multiset so a repeated
 * bigram cannot be matched more times than it occurs.
 */
export function diceCoefficient(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return a.length > 0 && a === b ? 1 : 0

  const left = bigrams(a)
  const right = bigrams(b)

  let shared = 0
  for (const [pair, count] of left) {
    shared += Math.min(count, right.get(pair) ?? 0)
  }

  return (2 * shared) / (a.length - 1 + (b.length - 1))
}

/** How well one query token matches one candidate token. */
function tokenWeight(queryToken: string, candidateToken: string): number {
  if (queryToken === candidateToken) return 1
  if (candidateToken.startsWith(queryToken)) return 0.8
  if (diceCoefficient(queryToken, candidateToken) >= 0.6) return 0.6
  return 0
}

/** Mean of the best available weight for each token in `from`, looking in `into`. */
function meanBestWeight(from: readonly string[], into: readonly string[]): number {
  let total = 0
  for (const token of from) {
    let best = 0
    for (const other of into) {
      best = Math.max(best, tokenWeight(token, other), tokenWeight(other, token))
      if (best === 1) break
    }
    total += best
  }
  return total / from.length
}

/**
 * How much of the candidate is left unexplained by the query. Weighting only
 * the query side would score "chicken brest" against "chicken breast" and
 * against "chicken breast roasted with skin on" identically, since both explain
 * the same two query tokens. Coverage is what makes the shorter, more specific
 * candidate win.
 *
 * Damped rather than applied in full: a query is usually shorter than the food
 * name it is looking for, and a long descriptive name should not be punished
 * out of contention.
 */
const COVERAGE_FLOOR = 0.7

function tokenScore(queryTokens: readonly string[], candidateTokens: readonly string[]): number {
  if (queryTokens.length === 0 || candidateTokens.length === 0) return 0

  const querySide = meanBestWeight(queryTokens, candidateTokens)
  const candidateSide = meanBestWeight(candidateTokens, queryTokens)

  return querySide * (COVERAGE_FLOOR + (1 - COVERAGE_FLOOR) * candidateSide)
}

/** True when `needle` appears in `haystack` at the start of some word. */
function containsAtWordBoundary(haystack: string, needle: string): boolean {
  let from = 0
  for (;;) {
    const at = haystack.indexOf(needle, from)
    if (at === -1) return false
    if (at === 0 || haystack.charAt(at - 1) === ' ') return true
    from = at + 1
  }
}

/**
 * Score one query against one candidate string, 0 to 1, as the best of five
 * tiers: exact, prefix, substring at a word boundary, token, character.
 *
 * The 0.60 ceiling on the character tier is the load-bearing constant: it
 * guarantees that a genuine word match always outranks a coincidental run of
 * shared letters.
 */
export function scoreMatch(query: string, candidate: string): number {
  const q = normalize(query)
  const c = normalize(candidate)
  if (q === '' || c === '') return 0
  if (q === c) return 1

  const ratio = q.length / c.length
  let best = 0.6 * diceCoefficient(q, c)

  const tokens = tokenScore(tokenize(q), tokenize(c))
  if (tokens > 0) best = Math.max(best, 0.3 + 0.45 * tokens)

  if (containsAtWordBoundary(c, q)) best = Math.max(best, 0.8 + 0.05 * ratio)
  if (c.startsWith(q)) best = Math.max(best, 0.9 + 0.05 * ratio)

  return Math.min(best, 1)
}
