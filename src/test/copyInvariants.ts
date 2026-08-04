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
 * INVARIANT 5, as prose. Added in Phase 7 with the pattern view.
 *
 * The invariant says unlogged days render as gaps, never as zeros, never as
 * green days, never as symptom-free days. The chart side of that is enforced by
 * the type system (patterns.ts gives a gap no numeric field at all). This is the
 * other half: the addendum requires every summary statistic to be phrased
 * "across the days you logged", never as a rate over calendar time.
 *
 * A sentence can violate invariant 5 while the arithmetic behind it is perfect.
 * "Your pain averaged 2 per day this month" is false even when the average was
 * computed over logged days only, because it invites her to read the quiet days
 * as calm ones.
 *
 * "symptom-free" and "good days" are here because both name a claim the data
 * cannot support: an unlogged day is unknown, not well. "streak" and "missed"
 * are here because addendum B removes the daily prompt and the streak counter
 * outright, and those words would smuggle the obligation back in.
 *
 * Note what is NOT here. A bare "a day" would fail on "a day you felt fine",
 * which is correct copy, so it is caught only next to an averaging verb, where
 * "averaged a 2 a day" is the phrasing at issue. Same principle as
 * SCOLDING_PATTERN above: a guard that fails on correct copy gets weakened by
 * whoever is in a hurry, and a weakened guard protects nothing.
 */
export const CALENDAR_RATE_PATTERN =
  /\bper day\b|\bdaily average\b|\baverage per day\b|averag\w*[^.]{0,20}\ba day\b|symptom[- ]free|\bgood days?\b|\bstreak\b|\bmissed\b|% of days|\bout of \d+ days\b/i

/**
 * Addendum B: correlations are possible patterns worth mentioning to her
 * doctor, never causal findings.
 *
 * A sample of one produces spurious associations constantly, and the harm of
 * her wrongly eliminating a food she loves is real. The counter-evidence field
 * on PossiblePattern is the structural guard; this catches the wording.
 *
 * Whole words where the stem has innocent readings. "trigger" has none in this
 * app: a food does not trigger a flare, it precedes one in her log.
 */
export const CAUSAL_PATTERN =
  /\bcaus(?:e|ed|es|ing)\b|\btrigger|because of|led to|\bdue to\b|reacted to|responsible for|culprit|\bmakes? you\b|\bmade you\b|\bfrom eating\b/i

/**
 * Addendum B: logging is optional and gaps are not failures.
 *
 * "There is no daily prompt, no streak counter, no 'you missed a day.' Those
 * mechanics turn a health tool into an obligation, and an obligation is the last
 * thing she needs."
 *
 * Nothing in the pattern view may imply she would get more out of the app by
 * logging more often. This is easy to regress in exactly two places, the empty
 * state and the not-enough-data line, because the natural thing to write there
 * is an encouragement to come back. Both are written to fault the list rather
 * than her.
 *
 * Every phrase is anchored to the act of logging. A bare "more often" would
 * fail on "shows up more often before your hardest logged days", which is the
 * correct way to describe a food's frequency, so "log more" carries that case
 * and covers "log more often" on its own.
 */
export const OBLIGATION_PATTERN =
  /keep logging|logg?(?:ing)? more|the more you log|fill (?:it|this|them) in|remember to log|don'?t forget|come back (?:daily|each day|every day|tomorrow)|better (?:results|picture|sense|idea) if you|try to log|need(?:s)? you to log/i

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
