/**
 * Constants for the traffic light. Numbers and flag sets only, no logic, so
 * rating.ts has exactly one place to read its policy from.
 *
 * This module deliberately does NOT import fatTarget.ts. The daily target T
 * comes from there, but it arrives as an argument, which keeps the dependency
 * one directional and a cycle structurally impossible.
 */

import type { FoodFlag } from '../types.ts'

/**
 * Fractions of the current mode's daily fat target T. Main spec section 2:
 *
 *   F <= 0.10 * T  -> GREEN
 *   F <= 0.25 * T  -> YELLOW
 *   otherwise      -> RED
 *
 * Both bounds are inclusive.
 *
 * There is deliberately NO per-mode multiplier here, and one must not be added
 * back. The main spec applied 0.6 (recovering) and 0.35 (flare) on top of a
 * single T. The addendum then gave each mode its own target: the 20 to 30 gram
 * recovering band, and the 15 gram flare ceiling. T already carries the mode
 * adjustment, so a multiplier would apply it a second time. Mode reaches the
 * engine only through FLARE_ONLY_RED_FLAGS below, and thresholdsFor() takes no
 * mode argument at all so this cannot be reintroduced by accident.
 *
 * For a 40 gram stable person that gives 4 / 10 stable, 3 / 7.5 recovering,
 * 1.5 / 3.75 flare. Each mode's thresholds stay a meaningful fraction of that
 * mode's own daily budget, which keeps this engine and the Phase 4 budget bar
 * telling her the same story.
 *
 * Unrelated to FAT_PERCENT in fatTarget.ts, which also happens to contain 0.25.
 * That one is a share of daily energy. This one is a share of T. They are not
 * the same number and must never be deduplicated into one.
 */
export const THRESHOLD_FRACTIONS = { green: 0.1, yellow: 0.25 } as const

/**
 * Budget awareness, main spec section 2. Under this many grams left in the day,
 * even a green food gets a gentle note. The spec's worked example is 26 grams
 * logged against a 30 gram target, leaving 4.
 */
export const BUDGET_WARNING_GRAMS = 5

/**
 * Force RED at any fat number, in every mode. Main spec section 2.
 *
 * Alcohol is invariant 4 in CLAUDE.md: always red, and no modifications are
 * ever offered for it. Note that data/foods.json ships a modification on its
 * one alcohol entry, so the engine has to strip it rather than trust the data.
 */
export const ALWAYS_RED_FLAGS: ReadonlySet<FoodFlag> = new Set(['alcohol', 'deep-fried'])

/**
 * Force RED in flare mode only. Inert in stable and recovering. This is the
 * only route by which mode affects a rating.
 */
export const FLARE_ONLY_RED_FLAGS: ReadonlySet<FoodFlag> = new Set([
  'high-fiber',
  'high-sugar',
  'spicy',
  'raw',
  'large-portion',
])

/**
 * A FLOOR on severity, not an assignment. These can promote a green to yellow
 * and can never demote a red. Main spec section 2's "yellow at best" group:
 * full fat dairy and cream and cheese (full-fat-dairy), sausage and bacon and
 * deli meats (processed-meat), nut butters and avocado and coconut
 * (hidden-fat).
 *
 * The red-meat category is deliberately not here. Every red-meat entry without
 * a processed-meat flag is already 5 grams or more, so it lands yellow or red
 * on arithmetic alone at any realistic target, and a blanket category rule
 * would only mislabel the lean cuts.
 */
export const YELLOW_FLOOR_FLAGS: ReadonlySet<FoodFlag> = new Set([
  'hidden-fat',
  'full-fat-dairy',
  'processed-meat',
])
