/**
 * The one definition of invariants 9 and 10, for every copy suite in the app.
 *
 * Not a .test.ts file on purpose: vitest.config.ts only collects files ending
 * in .test.ts, so this is a helper the suites import rather than a suite that
 * runs on its own.
 *
 * Before this existed there were two shapes of each check living in four files,
 * and they had already drifted: budget.test.ts caught em dashes with
 * not.toContain('—') while the other three used /[—–]/, so an en dash passed in
 * exactly one file.
 */

/**
 * Invariant 9. Em and en dashes both. The en dash is the one that creeps in on
 * a rewrite, because it looks close enough to a hyphen to survive a read
 * through.
 */
export const DASH_PATTERN = /[—–]/

/**
 * Invariant 10. Phrases, not words.
 *
 * A word list is the wrong shape for this. "limit", "avoid", "careful", and
 * "exceed" all have legitimate uses here: the addendum describes the flare
 * ceiling as an upper bound, RATING_COPY.alcohol already ships the sentence
 * "Alcohol avoidance is standard guidance for pancreatitis", and the Phase 9
 * When To Call screen will need "avoid" in a plainly medical sense.
 *
 * A guard that fails on correct copy gets weakened by whoever is in a hurry,
 * and a weakened guard protects nothing. Every phrase below has no innocent
 * reading in this app: each one addresses her conduct rather than the food.
 */
export const SCOLDING_PATTERN =
  /you should have|too much|bad choice|cheat|failed|guilt|over your limit|blew|splurge|indulg/i
