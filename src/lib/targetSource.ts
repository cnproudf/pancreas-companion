/**
 * Where the daily target came from, in one sentence, for every screen that
 * shows a number measured against it.
 *
 * Addendum section A is emphatic about this: a number she typed in herself must
 * never be presented as guidance from her care team, and the calculated
 * estimate must never be presented as a number NPF publishes. Two copies of
 * these sentences would drift, and the failure mode is a screen quietly
 * overstating where its number came from.
 *
 * 'incomplete' is deliberately absent. TargetSource excludes it, because a
 * screen with no target has nothing to name.
 */

import type { TargetSource } from './rateForSettings.ts'

export const SOURCE_NOTE: Record<TargetSource, string> = {
  'flare-ceiling': 'Against the 15 gram working ceiling for flare mode.',
  override: 'Against the daily target from your care team.',
  calculated: 'Against your estimated daily target.',
  provisional: 'Against the starting number you entered.',
}
