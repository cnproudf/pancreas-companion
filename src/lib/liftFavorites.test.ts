import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LiftItem } from './dailyLift.ts'
import {
  addFavorite,
  hydrateFavorites,
  isFavorited,
  LIFT_FAVORITES_STORAGE_KEY,
  readFavorites,
  removeFavorite,
  toFavorite,
  toggleFavorite,
  writeFavorites,
  type FavoriteLift,
} from './liftFavorites.ts'
import { STORAGE_PREFIX } from './storage.ts'

/**
 * The contract: a saved lift is hers, and nothing that happens to data/ or to
 * localStorage can take it away or silently rewrite it.
 */

const entry: LiftItem = {
  kind: 'lift',
  entry: { id: 'lift-001', type: 'fun-fact', content: 'Otters hold hands while they sleep.' },
}

const quote: LiftItem = {
  kind: 'lift',
  entry: {
    id: 'lift-200',
    type: 'quote',
    content: 'Something worth keeping.',
    attribution: 'Someone',
  },
}

const note: LiftItem = {
  kind: 'friend-note',
  note: {
    id: 'note-001',
    from: 'Chad',
    content: 'Text me when something on here is wrong and I will fix it.',
    dateAdded: '2026-08-03',
  },
}

const when = new Date('2026-08-04T09:00:00.000Z')

describe('toFavorite', () => {
  it('snapshots the content rather than referencing the id', () => {
    const favorite = toFavorite(entry, when)
    expect(favorite.id).toBe('lift-001')
    expect(favorite.kind).toBe('lift')
    expect(favorite.content).toBe('Otters hold hands while they sleep.')
    expect(favorite.savedAt).toBe(when.toISOString())
  })

  it('keeps the friend name on a note', () => {
    const favorite = toFavorite(note, when)
    expect(favorite.kind).toBe('friend-note')
    expect(favorite.from).toBe('Chad')
  })

  it('keeps an attribution when there is one, and omits it otherwise', () => {
    expect(toFavorite(quote, when).attribution).toBe('Someone')
    // exactOptionalPropertyTypes: absent, not an explicit undefined.
    expect('attribution' in toFavorite(entry, when)).toBe(false)
    expect('from' in toFavorite(entry, when)).toBe(false)
  })
})

describe('the pure list operations', () => {
  it('adds newest first', () => {
    const list = addFavorite(addFavorite([], entry, when), note, when)
    expect(list.map((f) => f.id)).toEqual(['note-001', 'lift-001'])
  })

  it('does not add the same item twice', () => {
    const once = addFavorite([], entry, when)
    expect(addFavorite(once, entry, when)).toHaveLength(1)
  })

  it('does not mutate the list it is given', () => {
    const original = addFavorite([], entry, when)
    addFavorite(original, note, when)
    removeFavorite(original, 'lift-001')
    expect(original).toHaveLength(1)
  })

  it('toggles on and back off', () => {
    const on = toggleFavorite([], entry, when)
    expect(isFavorited(on, 'lift-001')).toBe(true)

    const off = toggleFavorite(on, entry, when)
    expect(isFavorited(off, 'lift-001')).toBe(false)
    expect(off).toHaveLength(0)
  })

  it('removes by id and leaves the rest alone', () => {
    const list = addFavorite(addFavorite([], entry, when), note, when)
    expect(removeFavorite(list, 'lift-001').map((f) => f.id)).toEqual(['note-001'])
    expect(removeFavorite(list, 'nothing-here')).toHaveLength(2)
  })
})

describe('hydrateFavorites', () => {
  it('does not throw on anything', () => {
    for (const bad of [null, undefined, 0, 'nope', [], {}, { items: 'no' }]) {
      expect(() => hydrateFavorites(bad)).not.toThrow()
      expect(hydrateFavorites(bad)).toEqual([])
    }
  })

  it('drops only the damaged rows', () => {
    const raw = {
      schemaVersion: 1,
      items: [
        { id: 'lift-001', kind: 'lift', content: 'Good.', savedAt: '2026-08-04T09:00:00.000Z' },
        { id: '', kind: 'lift', content: 'No id.', savedAt: '' },
        { id: 'lift-002', kind: 'wrong', content: 'Bad kind.', savedAt: '' },
        { id: 'note-001', kind: 'friend-note', content: 'Also good.', from: 'Chad', savedAt: '' },
      ],
    }
    expect(hydrateFavorites(raw).map((f) => f.id)).toEqual(['lift-001', 'note-001'])
  })

  it('collapses duplicate ids, so the panel never shows one thing twice', () => {
    const raw = {
      items: [
        { id: 'lift-001', kind: 'lift', content: 'First.', savedAt: '' },
        { id: 'lift-001', kind: 'lift', content: 'Second.', savedAt: '' },
      ],
    }
    const list = hydrateFavorites(raw)
    expect(list).toHaveLength(1)
    expect(list[0]?.content).toBe('First.')
  })

  it('reads a bare array, in case an older shape is ever in storage', () => {
    const raw = [{ id: 'lift-001', kind: 'lift', content: 'Good.', savedAt: '' }]
    expect(hydrateFavorites(raw)).toHaveLength(1)
  })
})

describe('storage round trip', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('writes and reads back', () => {
    const list = addFavorite([], note, when)
    expect(writeFavorites(list)).toBe(true)

    const read = readFavorites()
    expect(read).toHaveLength(1)
    expect(read[0]?.from).toBe('Chad')
    expect(read[0]?.content).toBe(note.note.content)
  })

  it('returns an empty list rather than throwing on a corrupted blob', () => {
    localStorage.setItem(`${STORAGE_PREFIX}${LIFT_FAVORITES_STORAGE_KEY}`, '{not json')
    expect(() => readFavorites()).not.toThrow()
    expect(readFavorites()).toEqual([])
  })

  it('reports a failed write rather than throwing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => writeFavorites([])).not.toThrow()
    expect(writeFavorites([])).toBe(false)
  })

  it('survives its source entry disappearing from the data', () => {
    // The point of snapshotting. Someone edits friends-notes.json on GitHub and
    // deletes a note; what she kept still reads back in full.
    const saved: FavoriteLift[] = addFavorite([], note, when)
    writeFavorites(saved)

    const read = readFavorites()
    expect(read[0]?.content).toBe(note.note.content)
    expect(read[0]?.from).toBe('Chad')
  })
})
