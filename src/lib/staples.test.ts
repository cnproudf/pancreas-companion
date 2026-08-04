import { afterEach, describe, expect, it } from 'vitest'
import {
  EMPTY_STAPLES,
  SECTION_LABELS,
  SEED_STAPLES,
  STAPLES_COPY,
  STAPLES_STORAGE_KEY,
  STAPLE_TAG,
  STORE_SECTIONS,
  addStaple,
  bySection,
  hiddenStaples,
  hideStaple,
  hydrateStaples,
  readStaples,
  removeStaple,
  resolveStaples,
  restoreStaple,
  sectionForFood,
  toggleChecked,
  uncheckAll,
  writeStaples,
  type StaplesState,
} from './staples.ts'
import { FOODS } from './foods.ts'
import * as storage from './storage.ts'
import { DASH_PATTERN, OBLIGATION_PATTERN, SCOLDING_PATTERN } from '../test/copyInvariants.ts'

afterEach(() => {
  storage.remove(STAPLES_STORAGE_KEY)
})

function state(patch: Partial<StaplesState> = {}): StaplesState {
  return { ...EMPTY_STAPLES, ...patch }
}

describe('SEED_STAPLES', () => {
  it('seeds from the pantry-staple tag in foods.json', () => {
    const tagged = FOODS.filter((food) => food.tags.includes(STAPLE_TAG))
    expect(SEED_STAPLES).toHaveLength(tagged.length)
    expect(SEED_STAPLES.length).toBeGreaterThan(0)
  })

  it('gives every seeded item a real section', () => {
    for (const item of SEED_STAPLES) {
      expect(STORE_SECTIONS, item.name).toContain(item.section)
    }
  })

  it('has a label for every section', () => {
    for (const section of STORE_SECTIONS) expect(SECTION_LABELS[section]).toBeTruthy()
  })
})

describe('sectionForFood', () => {
  /*
   * A food's category is what it IS; a store section is where it is SHELVED.
   * These three are the cases where the two disagree, and getting them wrong
   * would send her to the wrong end of the store while already tired.
   */
  it('shelves canned goods by aisle rather than by category', () => {
    expect(sectionForFood('tuna-canned-water', 'seafood')).toBe('canned')
    expect(sectionForFood('applesauce', 'fruit')).toBe('canned')
    expect(sectionForFood('peaches-canned-juice', 'fruit')).toBe('canned')
  })

  it('falls back to the category for a food it has never heard of', () => {
    expect(sectionForFood('some-new-staple', 'vegetable')).toBe('produce')
    expect(sectionForFood('some-new-staple', 'dairy')).toBe('dairy-eggs')
  })
})

describe('hydrateStaples', () => {
  it('returns empty state for anything that is not a record', () => {
    expect(hydrateStaples(null)).toEqual(EMPTY_STAPLES)
    expect(hydrateStaples([])).toEqual(EMPTY_STAPLES)
  })

  it('drops damaged fields one at a time', () => {
    expect(hydrateStaples({ checked: ['a'], hidden: 'nope', added: 7 })).toEqual({
      checked: ['a'],
      hidden: [],
      added: [],
    })
  })

  it('collapses duplicates', () => {
    expect(hydrateStaples({ checked: ['a', 'a'], hidden: ['b', 'b'] }).checked).toEqual(['a'])
  })

  it('drops an added item with no name, because a blank row is not a list line', () => {
    const hydrated = hydrateStaples({ added: [{ id: 'x', name: '  ' }, { id: 'y', name: 'Ginger ale' }] })
    expect(hydrated.added.map((item) => item.name)).toEqual(['Ginger ale'])
  })

  it('lands an unrecognised section in other rather than dropping her item', () => {
    const hydrated = hydrateStaples({ added: [{ id: 'x', name: 'Ginger ale', section: 'aisle 9' }] })
    expect(hydrated.added[0]?.section).toBe('other')
  })
})

describe('read and write', () => {
  it('round trips through storage', () => {
    expect(writeStaples(state({ checked: ['white-rice'] }))).toBe(true)
    expect(readStaples().checked).toEqual(['white-rice'])
  })

  it('survives a corrupted blob', () => {
    localStorage.setItem(`${storage.STORAGE_PREFIX}${STAPLES_STORAGE_KEY}`, '{{{')
    expect(readStaples()).toEqual(EMPTY_STAPLES)
  })
})

describe('resolveStaples', () => {
  it('shows the whole seed on a fresh list', () => {
    expect(resolveStaples(EMPTY_STAPLES)).toHaveLength(SEED_STAPLES.length)
  })

  it('applies her checkmarks', () => {
    const resolved = resolveStaples(state({ checked: ['white-rice'] }))
    expect(resolved.find((item) => item.id === 'white-rice')?.checked).toBe(true)
    expect(resolved.find((item) => item.id === 'saltines')?.checked).toBe(false)
  })

  it('leaves out what she hid', () => {
    const resolved = resolveStaples(state({ hidden: ['white-rice'] }))
    expect(resolved.find((item) => item.id === 'white-rice')).toBeUndefined()
    expect(resolved).toHaveLength(SEED_STAPLES.length - 1)
  })

  it('includes what she added, marked as hers', () => {
    const resolved = resolveStaples(
      state({ added: [{ id: 'x', name: 'Ginger ale', section: 'other' }] }),
    )
    const mine = resolved.find((item) => item.id === 'x')
    expect(mine?.name).toBe('Ginger ale')
    expect(mine?.own).toBe(true)
    expect(resolved.every((item) => item.own || item.id !== 'x')).toBe(true)
  })

  /*
   * The seed is read from foods.json at resolve time rather than copied into
   * storage, so a correction to a hand-authored name reaches her list. The
   * stored state holds ids only.
   */
  it('stores ids rather than a snapshot of the shipped list', () => {
    const stored = hydrateStaples({ checked: ['white-rice'], hidden: ['saltines'] })
    expect(JSON.stringify(stored)).not.toContain('White rice')
  })
})

describe('bySection', () => {
  it('groups in store order and drops empty sections', () => {
    const groups = bySection(resolveStaples(EMPTY_STAPLES))
    const order = groups.map((group) => group.section)

    expect(order).toEqual([...STORE_SECTIONS].filter((section) => order.includes(section)))
    expect(groups.every((group) => group.items.length > 0)).toBe(true)
  })

  it('accounts for every item exactly once', () => {
    const items = resolveStaples(EMPTY_STAPLES)
    const grouped = bySection(items).flatMap((group) => group.items)
    expect(grouped).toHaveLength(items.length)
  })
})

describe('toggleChecked', () => {
  it('ticks and unticks', () => {
    const on = toggleChecked(EMPTY_STAPLES, 'white-rice')
    expect(on.checked).toEqual(['white-rice'])
    expect(toggleChecked(on, 'white-rice').checked).toEqual([])
  })
})

describe('uncheckAll', () => {
  /* The post-shopping-trip reset. The list is the point; the ticks are not. */
  it('clears the ticks and nothing else', () => {
    const before = state({
      checked: ['white-rice'],
      hidden: ['saltines'],
      added: [{ id: 'x', name: 'Ginger ale', section: 'other' }],
    })
    const after = uncheckAll(before)

    expect(after.checked).toEqual([])
    expect(after.hidden).toEqual(['saltines'])
    expect(after.added).toEqual(before.added)
  })

  it('returns the same state when nothing is ticked', () => {
    const before = state()
    expect(uncheckAll(before)).toBe(before)
  })
})

describe('hideStaple and restoreStaple', () => {
  it('hides rather than deletes, so it can come back', () => {
    const hidden = hideStaple(EMPTY_STAPLES, 'white-rice')
    expect(hiddenStaples(hidden).map((item) => item.id)).toEqual(['white-rice'])
    expect(resolveStaples(restoreStaple(hidden, 'white-rice'))).toHaveLength(SEED_STAPLES.length)
  })

  it('drops the tick when hiding, so a hidden item does not come back ticked', () => {
    const hidden = hideStaple(state({ checked: ['white-rice'] }), 'white-rice')
    expect(hidden.checked).toEqual([])
  })

  it('is a no-op for an already hidden or already visible item', () => {
    const hidden = hideStaple(EMPTY_STAPLES, 'white-rice')
    expect(hideStaple(hidden, 'white-rice')).toBe(hidden)
    expect(restoreStaple(EMPTY_STAPLES, 'white-rice')).toBe(EMPTY_STAPLES)
  })
})

describe('addStaple', () => {
  it('adds an item she typed', () => {
    const added = addStaple(EMPTY_STAPLES, '  Ginger ale  ', 'other')
    expect(added.added[0]?.name).toBe('Ginger ale')
    expect(added.added[0]?.section).toBe('other')
  })

  it('is a no-op for a blank name', () => {
    expect(addStaple(EMPTY_STAPLES, '   ', 'other')).toBe(EMPTY_STAPLES)
  })

  it('allows two of the same thing, because she may want two', () => {
    const twice = addStaple(addStaple(EMPTY_STAPLES, 'Ginger ale', 'other'), 'Ginger ale', 'other')
    expect(twice.added).toHaveLength(2)
    expect(new Set(twice.added.map((item) => item.id)).size).toBe(2)
  })
})

describe('removeStaple', () => {
  /* Hers to delete outright. A seeded item is hidden instead; she wrote this one. */
  it('removes her own item and its tick', () => {
    const added = addStaple(EMPTY_STAPLES, 'Ginger ale', 'other')
    const id = added.added[0]?.id ?? ''
    const ticked = toggleChecked(added, id)

    const removed = removeStaple(ticked, id)
    expect(removed.added).toEqual([])
    expect(removed.checked).toEqual([])
  })
})

describe('STAPLES_COPY', () => {
  const lines = Object.entries(STAPLES_COPY)

  it('has no em or en dashes', () => {
    for (const [key, text] of lines) expect(text, key).not.toMatch(DASH_PATTERN)
  })

  it('never scolds', () => {
    for (const [key, text] of lines) expect(text, key).not.toMatch(SCOLDING_PATTERN)
  })

  it('demands nothing of her', () => {
    for (const [key, text] of lines) expect(text, key).not.toMatch(OBLIGATION_PATTERN)
  })

  /*
   * Spec 5.9 asks for "add from my saved favorites". There is no food-favorites
   * store in this app, so the path pulls from her food log and the copy says so
   * rather than claiming a feature that does not exist.
   */
  it('describes the add path as what it actually reads', () => {
    expect(STAPLES_COPY.fromLogTitle).toContain('logged')
    expect(STAPLES_COPY.fromLogTitle.toLowerCase()).not.toContain('favorite')
  })
})
