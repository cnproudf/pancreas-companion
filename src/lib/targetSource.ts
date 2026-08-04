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

/**
 * The same fact, stated on its own rather than as a comparison. Added in Phase
 * 10 for the appointment export.
 *
 * WHY A SECOND MAP RATHER THAN REUSING THE ONE ABOVE. SOURCE_NOTE is scoped, in
 * the header, to screens showing a number MEASURED AGAINST the target, and it
 * is written as a sentence fragment for that position: "Against the daily
 * target from your care team", under a bar that has just shown her a number.
 * The prep sheet measures nothing. It reports the target itself, so that
 * fragment lands as a non sequitur under it.
 *
 * The drift the header above warns about is two FILES making the same
 * provenance claim. Both maps live here, and targetSource.test.ts asserts they
 * carry exactly the same keys, so neither can gain a source the other lacks.
 *
 * These are longer than the notes above because of who reads them. A clinician
 * looking at this page has to be able to tell in one line whether the number is
 * one THEY gave her or one the app estimated, and addendum section A is
 * emphatic that those must never be confused. So each one says plainly which it
 * is, and three of the four say plainly which it is not.
 */
export const SOURCE_ORIGIN: Record<TargetSource, string> = {
  'flare-ceiling':
    'This is the 15 gram working ceiling the app uses during a flare. It is an upper bound rather than a target, and it is not a number from your care team.',
  override: 'This is the number your care team gave you.',
  calculated:
    'This is an estimate the app calculated from your height, weight, age, and activity. It is not a number from your care team.',
  provisional:
    'This is a starting number you entered yourself. It is not a number from your care team, and the app has not calculated an estimate yet.',
}
