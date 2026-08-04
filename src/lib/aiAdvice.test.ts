import { describe, expect, it, vi } from 'vitest'
import { AI_COPY, guardFailure, normalizeAiText, toDisplayable } from './aiAdvice.ts'
import type { RawAiAdvice } from './askAI.ts'
import { RATING_COPY } from './rating.ts'
import { DEFAULT_SETTINGS } from '../state/settingsModel.ts'
import {
  CAUSAL_PATTERN,
  DASH_PATTERN,
  DIAGNOSIS_PATTERN,
  DIRECTIVE_PATTERN,
  OBLIGATION_PATTERN,
  SCOLDING_PATTERN,
} from '../test/copyInvariants.ts'
import type { Settings } from '../types.ts'

/**
 * THE SUITE FOR THE CLAIM THAT AI OUTPUT CANNOT BYPASS THE COPY GUARDS.
 *
 * Everything else in this app is copy written by hand and checked here before it
 * ships. This module is the only path by which a string nobody wrote can reach
 * the DOM, so these are the guards standing in for every suite that cannot run
 * against text that does not exist until runtime.
 */

/* A real target, so rateForSettings resolves rather than returning no-target. */
const SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  dailyFatTarget: 40,
  currentMode: 'stable',
}

function raw(overrides: Partial<RawAiAdvice> = {}): RawAiAdvice {
  return {
    rating: 'yellow',
    estimatedFatGrams: 12,
    servingAssumed: 'one bowl',
    reasoning: 'Broth based, but the topping oil adds up faster than it looks.',
    modifications: ['Ask for it with no chili oil'],
    confidence: 'medium',
    source: 'ai-estimate',
    ...overrides,
  }
}

function context(query = 'tom yum soup', onDrop?: (f: string, r: string) => void) {
  return { settings: SETTINGS, gramsUsedToday: 5, query, ...(onDrop ? { onDrop } : {}) }
}

describe('normalizeAiText', () => {
  it('replaces em and en dashes with a comma, which is invariant 9', () => {
    expect(normalizeAiText('Grilled fish — ask for no butter')).toBe(
      'Grilled fish, ask for no butter',
    )
    expect(normalizeAiText('Light option – broth based')).toBe('Light option, broth based')
  })

  it('does not leave the double space or the floating comma the swap creates', () => {
    expect(normalizeAiText('a — b')).toBe('a, b')
    expect(normalizeAiText('a  —  b')).toBe('a, b')
    expect(normalizeAiText('  padded  ')).toBe('padded')
  })

  it('leaves ordinary hyphens alone, which are not dashes', () => {
    expect(normalizeAiText('beer-battered')).toBe('beer-battered')
  })
})

describe('guardFailure', () => {
  it('names each guard it trips', () => {
    expect(guardFailure('a — b', false)).toBe('dash')
    expect(guardFailure('You had too much fat today', false)).toBe('scolding')
    expect(guardFailure('This could be pancreatitis', false)).toBe('diagnosis')
    expect(guardFailure('You should order the salad', false)).toBe('directive')
  })

  it('checks alcohol only when asked, because reasoning may name it', () => {
    expect(guardFailure('Swap it for a glass of wine', true)).toBe('alcohol')
    expect(guardFailure('Swap it for a glass of wine', false)).toBeNull()
  })

  it('passes correct copy that a lazier guard would fail', () => {
    // "should" aimed at a kitchen rather than at her.
    expect(guardFailure('The kitchen should be able to grill it dry', false)).toBeNull()
    // A cooking compound rather than a drink, per copyGuards.ts.
    expect(guardFailure('Ask for the red wine vinegar dressing', true)).toBeNull()
    expect(guardFailure('Start with the shrimp cocktail', true)).toBeNull()
  })
})

describe('toDisplayable normalization', () => {
  it('normalizes reasoning, modifications, AND servingAssumed', () => {
    /*
     * servingAssumed is the field the Worker does NOT normalize: it slices to
     * 120 characters and returns it as-is (worker/index.js:133). This assertion
     * is the reason this module does not trust the server side sanitizer.
     */
    const advice = toDisplayable(
      raw({
        reasoning: 'Broth based — lighter than it looks',
        modifications: ['Ask for it dry — no butter'],
        servingAssumed: 'one bowl — about two cups',
      }),
      context(),
    )

    expect(advice).not.toBeNull()
    expect(advice?.reasoning).not.toMatch(DASH_PATTERN)
    expect(advice?.servingAssumed).not.toMatch(DASH_PATTERN)
    expect(advice?.modifications[0]).not.toMatch(DASH_PATTERN)
    expect(advice?.servingAssumed).toBe('one bowl, about two cups')
  })
})

describe('toDisplayable guards', () => {
  /*
   * THE DEPARTURE FROM DROP-THE-STRING, AND THE REASON FOR IT.
   *
   * A traffic light with no explanation is worse than no traffic light, because
   * she cannot audit it. Every local card carries its reasons for exactly that
   * purpose.
   */
  it('discards the WHOLE result when reasoning trips a guard', () => {
    for (const reasoning of [
      'This could be pancreatitis, so stop eating',
      'You had too much fat today already',
      'You should skip this one',
    ]) {
      expect(toDisplayable(raw({ reasoning }), context()), reasoning).toBeNull()
    }
  })

  /*
   * A DASH IS FIXED, NOT REFUSED, and the difference is deliberate.
   *
   * Normalization runs before the guards, so DASH_PATTERN is unreachable through
   * this path by construction: there is no punctuation normalizeAiText leaves
   * behind that the guard would then catch. It is still in TEXT_GUARDS as the
   * assertion that normalization did what it claims, so an edit that breaks the
   * replace fails loudly rather than shipping an em dash.
   *
   * The other three guards are different in kind. Nothing can repair "you should
   * skip this one" into acceptable copy, so the only options are drop it or
   * print it.
   */
  it('repairs a dash in reasoning rather than discarding the result over it', () => {
    const advice = toDisplayable(raw({ reasoning: 'Rich dish — very heavy' }), context())

    expect(advice).not.toBeNull()
    expect(advice?.reasoning).toBe('Rich dish, very heavy')
    expect(advice?.reasoning).not.toMatch(DASH_PATTERN)
  })

  it('discards the whole result when reasoning is empty', () => {
    expect(toDisplayable(raw({ reasoning: '   ' }), context())).toBeNull()
  })

  it('drops one bad modification and keeps the rest', () => {
    const advice = toDisplayable(
      raw({
        modifications: [
          'Ask for it grilled dry',
          'You should avoid the sauce entirely',
          'Sauce on the side',
        ],
      }),
      context(),
    )

    expect(advice?.modifications).toEqual(['Ask for it grilled dry', 'Sauce on the side'])
  })

  it('drops servingAssumed alone rather than the card, since it is decoration', () => {
    const advice = toDisplayable(
      raw({ servingAssumed: 'one glass of wine' }),
      context(),
    )

    expect(advice).not.toBeNull()
    expect(advice?.servingAssumed).toBe('')
    expect(advice?.reasoning).not.toBe('')
  })

  it('reports every drop, so a broken integration is visible in development', () => {
    const drops: string[] = []
    toDisplayable(
      raw({ modifications: ['You should skip it'], servingAssumed: 'a beer' }),
      context('tom yum soup', (field, reason) => drops.push(`${field}:${reason}`)),
    )

    expect(drops).toContain('modification:directive')
    expect(drops).toContain('servingAssumed:alcohol')
  })

  it('survives a result whose every string is refused', () => {
    const advice = toDisplayable(
      raw({ modifications: ['You should skip it'], servingAssumed: 'a beer' }),
      context(),
    )

    // An empty modifications list is a valid card. Only reasoning is fatal.
    expect(advice?.modifications).toEqual([])
    expect(advice?.rating).not.toBeNull()
  })
})

describe('toDisplayable rating reconciliation', () => {
  /*
   * THE ONE DIRECTION. The model may make a result more cautious and never less,
   * because it does not know her remaining budget or her thresholds and the
   * local engine does.
   */
  it('takes the AI rating when it is more severe than the arithmetic', () => {
    // 4g against a 40g target is green by arithmetic. The model saw deep frying.
    const advice = toDisplayable(
      raw({ rating: 'red', estimatedFatGrams: 4 }),
      context(),
    )

    expect(advice?.rated?.rating.rating).toBe('green')
    expect(advice?.rating).toBe('red')
  })

  it('KEEPS the local rating when the AI is less severe, never lowering it', () => {
    // 30g of a 40g target is red by arithmetic. A model saying green does not
    // get to overrule her budget with a guess.
    const advice = toDisplayable(
      raw({ rating: 'green', estimatedFatGrams: 30 }),
      context(),
    )

    expect(advice?.rated?.rating.rating).toBe('red')
    expect(advice?.rating).toBe('red')
  })

  it('withholds the traffic light when there is no gram value', () => {
    const advice = toDisplayable(raw({ estimatedFatGrams: null }), context())

    expect(advice).not.toBeNull()
    expect(advice?.rating).toBeNull()
    expect(advice?.fatGrams).toBeNull()
    // The facts still show. Only the verdict is withheld, and never faked.
    expect(advice?.reasoning).not.toBe('')
  })

  it('withholds the traffic light when she has no daily target', () => {
    const advice = toDisplayable(raw(), {
      settings: { ...DEFAULT_SETTINGS, dailyFatTarget: null, age: null },
      gramsUsedToday: 0,
      query: 'tom yum soup',
    })

    expect(advice?.rating).toBeNull()
    expect(advice?.fatGrams).toBe(12)
  })

  it('rounds the gram value to one decimal, like everything else in the app', () => {
    expect(toDisplayable(raw({ estimatedFatGrams: 12.36 }), context())?.fatGrams).toBe(12.4)
  })
})

describe('toDisplayable and the medical redirect', () => {
  /*
   * Spec rule 6 and non-negotiable 6. The Worker's system prompt sends anything
   * medical here rather than letting the model answer.
   */
  it('renders a redirect with no rating, no grams, and nothing to act on', () => {
    const advice = toDisplayable(
      raw({
        rating: 'unknown',
        reasoning: 'That is something to raise with your care team.',
        estimatedFatGrams: 20,
        modifications: ['Ask for it dry'],
      }),
      context('should I go to the ER'),
    )

    expect(advice?.isRedirect).toBe(true)
    expect(advice?.rating).toBeNull()
    expect(advice?.fatGrams).toBeNull()
    expect(advice?.modifications).toEqual([])
  })

  it('still refuses a redirect whose sentence names a condition', () => {
    // The model was told to redirect and diagnosed instead. DIAGNOSIS_PATTERN
    // is what happens when a prompt is treated as a guarantee.
    expect(
      toDisplayable(
        raw({ rating: 'unknown', reasoning: 'That sounds like pancreatitis.' }),
        context('my stomach hurts'),
      ),
    ).toBeNull()
  })
})

describe('toDisplayable and invariant 4', () => {
  it('forces red and offers nothing when the query names a drink', () => {
    const advice = toDisplayable(
      raw({ rating: 'green', estimatedFatGrams: 0, modifications: ['Try a smaller glass'] }),
      context('a glass of red wine'),
    )

    expect(advice?.rating).toBe('red')
    expect(advice?.modifications).toEqual([])
  })

  it('replaces the model sentence rather than printing a red light over a green explanation', () => {
    const advice = toDisplayable(
      raw({ rating: 'green', reasoning: 'A light option that fits your day well.' }),
      context('one beer'),
    )

    // The app's own copy, already pinned by rating.test.ts, rather than prose
    // from a model that just disagreed with us about alcohol.
    expect(advice?.reasoning).toBe(RATING_COPY.alcohol)
  })

  it('does not fire on a cooking compound, which is correct copy', () => {
    const advice = toDisplayable(raw({ rating: 'yellow' }), context('beer battered cod'))

    // Red on its own merits is fine. Being forced red by the alcohol rule, and
    // stripped of every modification, is not what "beer battered" deserves.
    expect(advice?.modifications.length).toBeGreaterThan(0)
  })
})

describe('AI_COPY', () => {
  it('holds every copy invariant the hand written constants hold', () => {
    for (const [key, text] of Object.entries(AI_COPY)) {
      expect(text, key).not.toMatch(DASH_PATTERN)
      expect(text, key).not.toMatch(SCOLDING_PATTERN)
      expect(text, key).not.toMatch(DIAGNOSIS_PATTERN)
      expect(text, key).not.toMatch(DIRECTIVE_PATTERN)
      expect(text, key).not.toMatch(CAUSAL_PATTERN)
      expect(text, key).not.toMatch(OBLIGATION_PATTERN)
    }
  })

  it('says the number is an estimate wherever the number appears', () => {
    // Spec 5.1 and 5.2 both require the label, and the card renders this line
    // directly under the gram value rather than at the foot of the card.
    expect(AI_COPY.gramsNote).toMatch(/guess|estimate/i)
    expect(AI_COPY.heading).toMatch(/estimate/i)
  })

  it('promises nothing in the pending line', () => {
    // It has to stay true when the request aborts at five seconds and nothing
    // ever arrives.
    expect(AI_COPY.pending).not.toMatch(/will|soon|moment|loading/i)
  })
})

describe('the dev logger', () => {
  it('writes to console.warn and never anywhere she can see', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    toDisplayable(raw({ modifications: ['You should skip it'] }), context())

    expect(warn).toHaveBeenCalledWith('[askAI] guard-tripped modification:directive')
    warn.mockRestore()
  })
})
