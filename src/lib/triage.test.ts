import { describe, expect, it } from 'vitest'
import {
  RED_FLAGS,
  TRIAGE_COPY,
  foodGuidanceAllowed,
  telHref,
  type TriageStage,
} from './triage.ts'
import { MODES, type Mode } from '../types.ts'
import {
  CAUSAL_PATTERN,
  DASH_PATTERN,
  DIAGNOSIS_PATTERN,
  SCOLDING_PATTERN,
} from '../test/copyInvariants.ts'

const STAGES: readonly TriageStage[] = ['redflag-check', 'urgent', 'cleared']

describe('foodGuidanceAllowed', () => {
  /*
   * INVARIANT 1. This is the whole policy, and these four assertions are the
   * whole of it. Everything else in the app that gates food content asks this
   * function, so if these pass the rule is defined correctly; whether it is
   * APPLIED correctly is FlareGate.test.tsx's job.
   */
  it('blocks food guidance in flare mode until triage clears', () => {
    expect(foodGuidanceAllowed('flare', 'redflag-check')).toBe(false)
    expect(foodGuidanceAllowed('flare', 'urgent')).toBe(false)
  })

  it('allows food guidance in flare mode once triage clears', () => {
    expect(foodGuidanceAllowed('flare', 'cleared')).toBe(true)
  })

  it('never blocks stable or recovering, at any stage', () => {
    for (const mode of ['stable', 'recovering'] as const) {
      for (const stage of STAGES) {
        expect(foodGuidanceAllowed(mode, stage)).toBe(true)
      }
    }
  })

  /*
   * Flare is the only mode that gates. If a fourth mode is ever added, this
   * fails and forces a decision about it rather than letting it default open.
   */
  it('gates exactly one mode', () => {
    const gated = MODES.filter((mode: Mode) => !foodGuidanceAllowed(mode, 'redflag-check'))
    expect(gated).toEqual(['flare'])
  })
})

describe('RED_FLAGS', () => {
  it('carries the five from spec section 4, in order', () => {
    expect(RED_FLAGS).toHaveLength(5)
    expect(RED_FLAGS[0]).toContain('upper abdomen')
    expect(RED_FLAGS[1]).toContain('keep fluids down')
    expect(RED_FLAGS[2]).toContain('Fever or chills')
    expect(RED_FLAGS[3]).toContain('feeling faint')
    expect(RED_FLAGS[4]).toContain('getting worse')
  })

  it('carries no em or en dashes', () => {
    for (const flag of RED_FLAGS) expect(flag).not.toMatch(DASH_PATTERN)
  })
})

describe('TRIAGE_COPY', () => {
  const lines = Object.entries(TRIAGE_COPY)

  it('has no em or en dashes anywhere', () => {
    for (const [key, text] of lines) {
      expect(text, `TRIAGE_COPY.${key}`).not.toMatch(DASH_PATTERN)
    }
  })

  it('never scolds', () => {
    for (const [key, text] of lines) {
      expect(text, `TRIAGE_COPY.${key}`).not.toMatch(SCOLDING_PATTERN)
    }
  })

  /*
   * SPEC RULE 6. The app asks, and never forms a view. No branch may name a
   * condition or grade her likelihood of having one, in either direction:
   * "this could be serious" and "it is probably nothing" are the same act.
   */
  it('names no condition and grades no likelihood', () => {
    for (const [key, text] of lines) {
      expect(text, `TRIAGE_COPY.${key}`).not.toMatch(DIAGNOSIS_PATTERN)
    }
  })

  it('claims no causation', () => {
    for (const [key, text] of lines) {
      expect(text, `TRIAGE_COPY.${key}`).not.toMatch(CAUSAL_PATTERN)
    }
  })

  /*
   * The line spec section 4 asks for and that we deliberately cut: "acute
   * pancreatitis is a condition where prompt care genuinely matters." It is a
   * clinical claim about her condition in an encouraging voice. DIAGNOSIS_PATTERN
   * already catches the word, but this names the specific regression so a future
   * reader of the spec sees why the build went red rather than just which regex
   * fired.
   */
  it('does not restore the cut clinical line from spec section 4', () => {
    const all = Object.values(TRIAGE_COPY).join(' ')
    expect(all.toLowerCase()).not.toContain('pancreatitis')
  })

  /*
   * A no is not a clearance, and the yes panel does not reassure. Both branches
   * are checked above by DIAGNOSIS_PATTERN; this pins the two sentences whose
   * presence is the point, so removing them fails loudly.
   */
  it('keeps the two lines the panels exist for', () => {
    expect(TRIAGE_COPY.urgentPermission).toBe('Nobody is going to think you overreacted.')
    expect(TRIAGE_COPY.urgentEmergency).toContain('911')
    expect(TRIAGE_COPY.guidanceStillWrong).toContain('something is wrong')
  })

  it('frames the flare number as a ceiling rather than a goal', () => {
    expect(TRIAGE_COPY.guidanceCeiling).toContain('15 grams')
    expect(TRIAGE_COPY.guidanceCeiling).toContain('not a goal')
  })

  /* Both answers are offered at equal weight. Neither is worded as the default. */
  it('offers both answers plainly', () => {
    expect(TRIAGE_COPY.answerYes).toBe('Yes, one or more')
    expect(TRIAGE_COPY.answerNo).toBe('No, but I feel off')
  })
})

describe('telHref', () => {
  it('strips the characters she typed for readability', () => {
    expect(telHref('(555) 555-0134')).toBe('tel:5555550134')
    expect(telHref('555.555.0134')).toBe('tel:5555550134')
    expect(telHref('  555 555 0134  ')).toBe('tel:5555550134')
  })

  it('keeps a leading plus for an international number', () => {
    expect(telHref('+1 (555) 555-0134')).toBe('tel:+15555550134')
  })

  /* Comma is pause and semicolon is wait. Both matter for an extension. */
  it('keeps dialer control characters', () => {
    expect(telHref('555-555-0134,,123')).toBe('tel:5555550134,,123')
    expect(telHref('555-555-0134;123')).toBe('tel:5555550134;123')
  })

  /*
   * Null rather than an empty "tel:", so the component can render plain text
   * instead of a link that looks tappable and does nothing. On this screen a
   * dead call button is worse than no button.
   */
  it('returns null when there is nothing dialable', () => {
    expect(telHref('')).toBeNull()
    expect(telHref('   ')).toBeNull()
    expect(telHref('ask at reception')).toBeNull()
    expect(telHref('+')).toBeNull()
    expect(telHref(',,;')).toBeNull()
  })
})
