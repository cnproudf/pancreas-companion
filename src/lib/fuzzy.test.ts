import { describe, expect, it } from 'vitest'
import { diceCoefficient, MIN_MATCH_SCORE, normalize, scoreMatch, tokenize } from './fuzzy.ts'

/**
 * Generic string scoring with no food knowledge in it. Hand rolled rather than
 * pulled from npm, per the working agreement about dependencies.
 *
 * The load-bearing property is the tier ordering: a real word match must always
 * beat a coincidental run of shared letters, or the food checker starts
 * confidently suggesting the wrong thing.
 */

describe('normalize', () => {
  it('folds case', () => {
    expect(normalize('Grilled Chicken')).toBe('grilled chicken')
  })

  it('strips diacritics', () => {
    expect(normalize('sauté')).toBe('saute')
    expect(normalize('crème brûlée')).toBe('creme brulee')
  })

  it('spells out an ampersand', () => {
    expect(normalize('fish & chips')).toBe('fish and chips')
  })

  it('turns punctuation into separators', () => {
    expect(normalize('Chicken breast, skinless, baked')).toBe('chicken breast skinless baked')
    expect(normalize('low-fat')).toBe('low fat')
    expect(normalize("shepherd's pie")).toBe('shepherd s pie')
  })

  it('collapses whitespace and trims', () => {
    expect(normalize('  too   much  room ')).toBe('too much room')
  })

  it('reduces an all-punctuation string to nothing', () => {
    expect(normalize('!!! ... ???')).toBe('')
  })
})

describe('tokenize', () => {
  it('splits on whitespace after normalizing', () => {
    expect(tokenize('Chicken breast, skinless')).toEqual(['chicken', 'breast', 'skinless'])
  })

  it('returns nothing for an empty string', () => {
    expect(tokenize('   ')).toEqual([])
  })
})

describe('diceCoefficient', () => {
  it('is 1 for identical strings', () => {
    expect(diceCoefficient('breast', 'breast')).toBe(1)
  })

  it('is 0 for strings with no shared bigram', () => {
    expect(diceCoefficient('abcd', 'wxyz')).toBe(0)
  })

  it('scores a near miss between 0 and 1', () => {
    // "brest" bigrams br re es st, "breast" bigrams br re ea as st, 3 shared.
    expect(diceCoefficient('brest', 'breast')).toBeCloseTo((2 * 3) / (4 + 5), 10)
  })

  it('handles strings shorter than one bigram', () => {
    expect(diceCoefficient('a', 'a')).toBe(1)
    expect(diceCoefficient('a', 'b')).toBe(0)
    expect(diceCoefficient('', '')).toBe(0)
  })

  it('counts bigrams as a multiset', () => {
    // Not 1. "aa" has one bigram, "aaaa" has three, only one can pair off.
    expect(diceCoefficient('aa', 'aaaa')).toBeLessThan(1)
  })
})

describe('scoreMatch', () => {
  it('is 1 for an exact match after normalizing', () => {
    expect(scoreMatch('Grilled Chicken', 'grilled chicken')).toBe(1)
  })

  it('is 0 when either side is empty', () => {
    expect(scoreMatch('', 'chicken')).toBe(0)
    expect(scoreMatch('chicken', '')).toBe(0)
    expect(scoreMatch('!!!', 'chicken')).toBe(0)
  })

  it('orders the tiers exact, prefix, substring, token, character', () => {
    const exact = scoreMatch('abc', 'abc')
    const prefix = scoreMatch('abc', 'abcdef')
    const substring = scoreMatch('def', 'abc def')
    const token = scoreMatch('brest', 'breast')
    const character = scoreMatch('xbc', 'abc')

    expect(exact).toBeGreaterThan(prefix)
    expect(prefix).toBeGreaterThan(substring)
    expect(substring).toBeGreaterThan(token)
    expect(token).toBeGreaterThan(character)
  })

  it('requires a word boundary for the substring tier', () => {
    // "hick" sits inside "chicken" but not at a word start, so it does not get
    // the substring score. It still gets some credit from the character tier.
    const boundary = scoreMatch('chick', 'chicken breast')
    const midWord = scoreMatch('hick', 'chicken breast')
    expect(boundary).toBeGreaterThan(midWord)
  })

  it('prefers the candidate the query explains more of', () => {
    // Both explain the same two query tokens, so a query-only score would call
    // these equal and the food checker would pick whichever came first.
    const tight = scoreMatch('chicken brest', 'chicken breast')
    const padded = scoreMatch('chicken brest', 'chicken breast roasted with skin on')
    expect(tight).toBeGreaterThan(padded)
  })

  it('clears the threshold for a plausible typo', () => {
    expect(scoreMatch('chicken brest', 'chicken breast')).toBeGreaterThan(MIN_MATCH_SCORE)
  })

  it('stays under the threshold for an unrelated string', () => {
    expect(scoreMatch('zzzqqq', 'chicken breast')).toBeLessThan(MIN_MATCH_SCORE)
  })

  it('never exceeds 1', () => {
    for (const [q, c] of [
      ['chicken', 'chicken'],
      ['chick', 'chicken'],
      ['a', 'a b c d e f g'],
    ] as const) {
      expect(scoreMatch(q, c)).toBeLessThanOrEqual(1)
    }
  })
})
