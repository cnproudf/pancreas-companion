import { describe, expect, it } from 'vitest'
import {
  CHAINS_BY_ID,
  CUISINE_PLAYBOOKS,
  PLAYBOOK_BY_CUISINE,
  PLAYBOOK_META,
  PLAYBOOK_PROBLEMS,
  RESTAURANT_CHAINS,
  UNIVERSAL_PLAYBOOK,
  parsePlaybook,
} from './restaurantPlaybook.ts'
import { CUISINES } from '../types.ts'
import { DASH_PATTERN, SCOLDING_PATTERN, namesAlcohol } from '../test/copyInvariants.ts'

/**
 * The playbook is the most durable asset in the app, per spec section 3: menus
 * change and vary, but these scripts work everywhere. So this file is strict
 * about the real data even though the loader is deliberately forgiving at
 * runtime, the same split foods.test.ts uses.
 *
 * CI runs npm test before npm run build, so a bad hand edit to
 * data/restaurant-playbook.json turns into a red X on the pull request rather
 * than a quietly shorter playbook.
 */

const EXPECTED_CUISINES = 14
const EXPECTED_CHAINS = 46

function validCuisine(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    cuisine: 'italian',
    label: 'Italian',
    safeBets: ['Something plain'],
    avoid: ['Something fried'],
    askFor: ['Sauce on the side'],
    scriptLine: 'Could the kitchen use no oil?',
    ...patch,
  }
}

function validChain(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'test-chain',
    name: 'Test Chain',
    aliases: [],
    cuisine: 'italian',
    nutritionUrl: null,
    ...patch,
  }
}

function fileWith(
  cuisines: unknown[],
  chains: unknown[] = [],
  universal: unknown = {
    title: 'How to order anywhere',
    strategies: ['Sauce on the side'],
    scriptLine: 'No oil please.',
  },
): unknown {
  return {
    _meta: { cuisines: CUISINES, maintenanceNote: 'Links move.' },
    universal,
    cuisines,
    chains,
  }
}

/** Every string on this screen that she actually reads. */
function everyUserFacingString(): string[] {
  const strings: string[] = []
  if (UNIVERSAL_PLAYBOOK !== null) {
    strings.push(UNIVERSAL_PLAYBOOK.title, ...UNIVERSAL_PLAYBOOK.strategies, UNIVERSAL_PLAYBOOK.scriptLine)
  }
  for (const playbook of CUISINE_PLAYBOOKS) {
    strings.push(
      playbook.label,
      playbook.scriptLine,
      ...playbook.safeBets,
      ...playbook.avoid,
      ...playbook.askFor,
    )
  }
  for (const chain of RESTAURANT_CHAINS) strings.push(chain.name)
  return strings
}

/**
 * The lists that OFFER her something. Invariant 4 applies here and not to the
 * avoid lists, where naming alcohol plainly is the entire point.
 */
function everyOfferedString(): string[] {
  const strings: string[] = []
  if (UNIVERSAL_PLAYBOOK !== null) strings.push(UNIVERSAL_PLAYBOOK.scriptLine)
  for (const playbook of CUISINE_PLAYBOOKS) {
    strings.push(playbook.scriptLine, ...playbook.safeBets, ...playbook.askFor)
  }
  return strings
}

describe('the real playbook', () => {
  it('loads every entry without a problem', () => {
    expect(PLAYBOOK_PROBLEMS).toEqual([])
    expect(CUISINE_PLAYBOOKS).toHaveLength(EXPECTED_CUISINES)
    expect(RESTAURANT_CHAINS).toHaveLength(EXPECTED_CHAINS)
  })

  it('has a universal section, which is the part that always shows', () => {
    expect(UNIVERSAL_PLAYBOOK).not.toBeNull()
    if (UNIVERSAL_PLAYBOOK === null) return
    expect(UNIVERSAL_PLAYBOOK.title.length).toBeGreaterThan(0)
    expect(UNIVERSAL_PLAYBOOK.scriptLine.length).toBeGreaterThan(0)
    // Spec section 3 lists seven. Seven is the floor, not the ceiling.
    expect(UNIVERSAL_PLAYBOOK.strategies.length).toBeGreaterThanOrEqual(7)
  })

  it('keeps the literal union in sync with _meta', () => {
    // The drift guard. Adding a cuisine to the data fails this until types.ts is
    // updated, and vice versa.
    expect([...CUISINES]).toEqual([...PLAYBOOK_META.cuisines])
  })

  it('covers every cuisine in the vocabulary, in order', () => {
    expect(CUISINE_PLAYBOOKS.map((p) => p.cuisine)).toEqual([...CUISINES])
    for (const cuisine of CUISINES) {
      expect(PLAYBOOK_BY_CUISINE.get(cuisine)).toBeDefined()
    }
  })

  it('gives every cuisine a real entry rather than a thin one', () => {
    for (const playbook of CUISINE_PLAYBOOKS) {
      expect(playbook.label.length).toBeGreaterThan(0)
      expect(playbook.scriptLine.length).toBeGreaterThan(0)
      // A heading with nothing under it is worse than no entry at all when she
      // is reading this at a table.
      expect(playbook.safeBets.length).toBeGreaterThanOrEqual(3)
      expect(playbook.avoid.length).toBeGreaterThanOrEqual(3)
      expect(playbook.askFor.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('has unique chain ids and known cuisines', () => {
    expect(CHAINS_BY_ID.size).toBe(RESTAURANT_CHAINS.length)
    for (const chain of RESTAURANT_CHAINS) {
      expect(CUISINES).toContain(chain.cuisine)
      expect(PLAYBOOK_BY_CUISINE.get(chain.cuisine)).toBeDefined()
    }
  })

  it('links only to https nutrition pages, or to none at all', () => {
    for (const chain of RESTAURANT_CHAINS) {
      if (chain.nutritionUrl === null) continue
      expect(chain.nutritionUrl.startsWith('https://')).toBe(true)
    }
  })

  it('keeps the instruction for a dead link in the file', () => {
    // These URLs rot. The note is how whoever finds a broken one knows what to
    // do, so it is not allowed to be dropped in a future edit.
    expect(PLAYBOOK_META.maintenanceNote.length).toBeGreaterThan(0)
  })

  it('contains no em dashes or en dashes in anything she reads', () => {
    for (const text of everyUserFacingString()) {
      expect(text).not.toMatch(DASH_PATTERN)
    }
  })

  it('never scolds her', () => {
    for (const text of everyUserFacingString()) {
      expect(text).not.toMatch(SCOLDING_PATTERN)
    }
  })

  it('offers alcohol nowhere, invariant 4', () => {
    for (const text of everyOfferedString()) {
      expect(namesAlcohol(text)).toBe(false)
    }
  })
})

describe('the invariant 4 guard itself', () => {
  it('catches a drink', () => {
    expect(namesAlcohol('A glass of wine with dinner')).toBe(true)
    expect(namesAlcohol('One margarita is fine')).toBe(true)
    expect(namesAlcohol('Ask for a beer')).toBe(true)
  })

  it('does not fire on cooking compounds, which are not drinks', () => {
    // Both of these are copy the playbook legitimately needs: the first in a
    // safe bets list, the second in an avoid list.
    expect(namesAlcohol('Salad with a splash of red wine vinegar')).toBe(false)
    expect(namesAlcohol('Beer-battered cod, which is deep fried')).toBe(false)
    expect(namesAlcohol('Sherry vinegar and lemon')).toBe(false)
    // Three cuisines legitimately recommend these, and they are among the
    // leanest things on any menu.
    expect(namesAlcohol('Shrimp cocktail with cocktail sauce')).toBe(false)
  })

  it('still catches a drink sitting next to a compound', () => {
    expect(namesAlcohol('Shrimp cocktail and a glass of wine')).toBe(true)
  })

  it('matches whole words only', () => {
    expect(namesAlcohol('Fresh ginger and garlic')).toBe(false)
    expect(namesAlcohol('Rummage through the menu')).toBe(false)
  })
})

describe('parsePlaybook', () => {
  it('does not throw on a non-object', () => {
    expect(() => parsePlaybook(null, 'test')).not.toThrow()
    expect(() => parsePlaybook('nope', 'test')).not.toThrow()
    expect(parsePlaybook(null, 'test').cuisines).toEqual([])
    expect(parsePlaybook(null, 'test').problems.length).toBeGreaterThan(0)
  })

  it('reports a missing universal section and keeps the cuisines', () => {
    const result = parsePlaybook(fileWith([validCuisine()], [], null), 'test')
    expect(result.universal).toBeNull()
    expect(result.cuisines).toHaveLength(1)
    expect(result.problems.map((p) => p.entry)).toContain('universal')
  })

  it('reports an unknown cuisine key', () => {
    const result = parsePlaybook(fileWith([validCuisine({ cuisine: 'martian' })]), 'test')
    expect(result.cuisines).toEqual([])
    expect(result.problems.map((p) => p.field)).toContain('cuisine')
  })

  it('reports an empty safe bets list', () => {
    const result = parsePlaybook(fileWith([validCuisine({ safeBets: [] })]), 'test')
    expect(result.cuisines).toEqual([])
    expect(result.problems.map((p) => p.field)).toContain('safeBets')
  })

  it('reports a duplicate cuisine and keeps the first', () => {
    const result = parsePlaybook(
      fileWith([validCuisine({ label: 'First' }), validCuisine({ label: 'Second' })]),
      'test',
    )
    expect(result.cuisines).toHaveLength(1)
    expect(result.cuisines.at(0)?.label).toBe('First')
    expect(result.problems.map((p) => p.field)).toContain('cuisine')
  })

  it('drops one broken cuisine and keeps its valid siblings', () => {
    const result = parsePlaybook(
      fileWith([
        validCuisine({ cuisine: 'italian' }),
        validCuisine({ cuisine: 'mexican', scriptLine: '' }),
        validCuisine({ cuisine: 'thai' }),
      ]),
      'test',
    )
    expect(result.cuisines.map((c) => c.cuisine)).toEqual(['italian', 'thai'])
    expect(result.problems).toHaveLength(1)
  })

  it('rejects an http nutrition url but accepts null', () => {
    const withHttp = parsePlaybook(
      fileWith([validCuisine()], [validChain({ nutritionUrl: 'http://example.com' })]),
      'test',
    )
    expect(withHttp.chains).toEqual([])
    expect(withHttp.problems.map((p) => p.field)).toContain('nutritionUrl')

    const withNull = parsePlaybook(fileWith([validCuisine()], [validChain()]), 'test')
    expect(withNull.chains).toHaveLength(1)
    expect(withNull.problems).toEqual([])
  })

  it('reports a duplicate chain id and keeps the first', () => {
    const result = parsePlaybook(
      fileWith([validCuisine()], [validChain({ name: 'First' }), validChain({ name: 'Second' })]),
      'test',
    )
    expect(result.chains).toHaveLength(1)
    expect(result.chains.at(0)?.name).toBe('First')
  })

  it('names the file and the entry in a problem', () => {
    const result = parsePlaybook(fileWith([validCuisine({ cuisine: 'nope' })]), 'playbook')
    expect(result.problems.at(0)?.source).toBe('playbook')
    expect(result.problems.at(0)?.entry).toBe('nope')
  })
})
