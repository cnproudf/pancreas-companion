/**
 * The one definition of invariants 4, 9, and 10, for every copy suite in the app.
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

/**
 * Invariant 4, for copy that offers her something.
 *
 * "Alcohol is always red. No modifications are ever offered for it." The rating
 * engine enforces that for foods.json entries by dropping their modifications.
 * Prose data has no engine in front of it, so the guard is a test, and it runs
 * against the lists that offer her things: safe bets, ask fors, and every script
 * line. Not against avoid lists, where naming alcohol plainly is the whole point.
 *
 * Two stages, because a naive word list fails on correct copy in two ways.
 *
 * First, food compounds are not drinks. "Red wine vinegar" is a green salad
 * dressing and belongs in a safe bets list. "Shrimp cocktail" and "cocktail
 * sauce" are two of the best things on a seafood or steakhouse menu and belong
 * in three of them. "Beer-battered" belongs in an avoid list on its own merits.
 * All of these are stripped before the terms are applied.
 *
 * Second, the terms match whole words only. Without \b, "sake" hits "sakes" and
 * "gin" hits "ginger", and per the note above a guard that fails on correct copy
 * gets weakened by whoever is in a hurry.
 */
const ALCOHOL_COMPOUNDS =
  /\b(?:red |white |rice )?wine vinegar\b|\bsherry vinegar\b|\bbeer[- ]batter(?:ed)?\b|\bnon[- ]alcoholic\b|\b(?:shrimp|seafood|crab|fruit) cocktail\b|\bcocktail sauce\b/gi

const ALCOHOL_TERMS =
  /\b(?:alcohol|wine|beer|cocktail|liquor|sake|margarita|tequila|vodka|bourbon|whiskey|whisky|rum|gin|mimosa|sangria|prosecco|champagne|hard seltzer)\b/i

/** True when this line names a drink, after the cooking compounds are removed. */
export function namesAlcohol(text: string): boolean {
  return ALCOHOL_TERMS.test(text.replace(ALCOHOL_COMPOUNDS, ' '))
}
