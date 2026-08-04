import { describe, expect, it } from 'vitest'
import { SOURCE_NOTE, SOURCE_ORIGIN } from './targetSource.ts'
import { DASH_PATTERN, SCOLDING_PATTERN } from '../test/copyInvariants.ts'

/**
 * Two maps, one fact. The header of targetSource.ts explains why they are
 * phrased differently; this is the guard that keeps them from becoming two
 * different facts.
 *
 * The failure it exists to catch is a new TargetSource being added to one map
 * and not the other. TypeScript's Record already catches a MISSING key at
 * compile time, so what is left for a test is the pair of claims a type cannot
 * express: that the two maps agree on the set of sources, and that neither one
 * ever describes an app estimate as a number from her care team.
 */
describe('SOURCE_NOTE and SOURCE_ORIGIN', () => {
  it('cover exactly the same sources', () => {
    expect(Object.keys(SOURCE_ORIGIN).sort()).toEqual(Object.keys(SOURCE_NOTE).sort())
  })

  it('says which sources are not from her care team, and does not say it of the one that is', () => {
    /*
     * Addendum section A, the non-negotiable distinction. Three of the four
     * numbers are the app's, and each has to disown the claim outright rather
     * than merely fail to make it. The fourth is her care team's and must not.
     */
    expect(SOURCE_ORIGIN.calculated).toContain('not a number from your care team')
    expect(SOURCE_ORIGIN.provisional).toContain('not a number from your care team')
    expect(SOURCE_ORIGIN['flare-ceiling']).toContain('not a number from your care team')

    expect(SOURCE_ORIGIN.override).not.toContain('not a number from your care team')
    expect(SOURCE_ORIGIN.override).toContain('your care team')
  })

  it('holds the copy invariants', () => {
    for (const [source, text] of [
      ...Object.entries(SOURCE_NOTE),
      ...Object.entries(SOURCE_ORIGIN),
    ]) {
      expect(text, source).not.toMatch(DASH_PATTERN)
      expect(text, source).not.toMatch(SCOLDING_PATTERN)
    }
  })
})
