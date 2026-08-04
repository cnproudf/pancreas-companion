import { describe, expect, it } from 'vitest'
import {
  addSaved,
  commitSaved,
  findByName,
  hydrateSaved,
  removeSaved,
  updateSaved,
  type SavedRestaurant,
} from './savedRestaurants.ts'

const WHEN = new Date('2026-08-04T18:30:00.000Z')

function row(patch: Partial<SavedRestaurant> = {}): SavedRestaurant {
  return {
    id: 'one',
    name: 'Olive Garden',
    cuisine: 'italian',
    notes: '',
    savedAt: WHEN.toISOString(),
    updatedAt: WHEN.toISOString(),
    ...patch,
  }
}

describe('hydrateSaved', () => {
  it('returns an empty list for anything that is not an array', () => {
    expect(hydrateSaved(null)).toEqual([])
    expect(hydrateSaved('nope')).toEqual([])
    expect(hydrateSaved(42)).toEqual([])
    expect(hydrateSaved({})).toEqual([])
  })

  it('reads both the envelope and a bare array', () => {
    expect(hydrateSaved({ schemaVersion: 1, items: [row()] })).toHaveLength(1)
    expect(hydrateSaved([row()])).toHaveLength(1)
  })

  it('drops one damaged row and keeps its siblings', () => {
    const list = hydrateSaved([row({ id: 'a' }), { name: 'no id' }, row({ id: 'b' })])
    expect(list.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('collapses duplicate ids', () => {
    const list = hydrateSaved([row({ name: 'First' }), row({ name: 'Second' })])
    expect(list).toHaveLength(1)
    expect(list.at(0)?.name).toBe('First')
  })

  it('keeps a row whose cuisine is no longer in the playbook', () => {
    /*
     * The load bearing one. The cuisine is a key into data that is allowed to
     * change; her list is not allowed to lose entries because of it. An
     * unrecognised key becomes null and the row renders with her name and her
     * notes and no guidance block.
     */
    const list = hydrateSaved([row({ cuisine: 'ethiopian' as never })])
    expect(list).toHaveLength(1)
    expect(list.at(0)?.cuisine).toBeNull()
    expect(list.at(0)?.name).toBe('Olive Garden')
  })

  it('treats empty notes as valid, because they are hers', () => {
    const list = hydrateSaved([row({ notes: '' })])
    expect(list.at(0)?.notes).toBe('')
  })

  it('survives a damaged timestamp without losing the row', () => {
    const list = hydrateSaved([{ ...row(), savedAt: 7, updatedAt: null }])
    expect(list).toHaveLength(1)
    expect(list.at(0)?.savedAt).toBe('')
  })
})

describe('the pure list operations', () => {
  it('adds newest first without mutating the input', () => {
    const before: readonly SavedRestaurant[] = [row({ id: 'old', name: 'Old Place' })]
    const after = addSaved(before, { name: 'New Place', cuisine: 'thai', notes: 'ask for mild' }, WHEN)

    expect(after).toHaveLength(2)
    expect(after.at(0)?.name).toBe('New Place')
    expect(before).toHaveLength(1)
  })

  it('trims the name on the way in', () => {
    const after = addSaved([], { name: '  Spacey  ', cuisine: null, notes: '' }, WHEN)
    expect(after.at(0)?.name).toBe('Spacey')
  })

  it('updates in place and moves updatedAt only', () => {
    const later = new Date('2026-09-01T12:00:00.000Z')
    const before = [row()]
    const after = updateSaved(before, 'one', { name: 'Olive Garden', cuisine: 'italian', notes: 'window seat' }, later)

    expect(after.at(0)?.notes).toBe('window seat')
    expect(after.at(0)?.savedAt).toBe(WHEN.toISOString())
    expect(after.at(0)?.updatedAt).toBe(later.toISOString())
    expect(before.at(0)?.notes).toBe('')
  })

  it('treats an unknown id as a no-op rather than an error', () => {
    const before = [row()]
    expect(updateSaved(before, 'missing', { name: 'x', cuisine: null, notes: '' }, WHEN)).toEqual(before)
    expect(removeSaved(before, 'missing')).toEqual(before)
  })

  it('removes without mutating', () => {
    const before = [row({ id: 'a' }), row({ id: 'b' })]
    expect(removeSaved(before, 'a').map((r) => r.id)).toEqual(['b'])
    expect(before).toHaveLength(2)
  })
})

describe('findByName and commitSaved', () => {
  it('matches a name regardless of case and surrounding space', () => {
    const list = [row()]
    expect(findByName(list, '  olive garden ')?.id).toBe('one')
    expect(findByName(list, 'Applebees')).toBeNull()
  })

  it('updates rather than duplicating when she saves the same place twice', () => {
    const first = commitSaved([], { name: 'Olive Garden', cuisine: 'italian', notes: 'first' }, WHEN)
    const second = commitSaved(first, { name: 'olive garden', cuisine: 'italian', notes: 'second' }, WHEN)

    expect(second).toHaveLength(1)
    expect(second.at(0)?.notes).toBe('second')
    expect(second.at(0)?.id).toBe(first.at(0)?.id)
  })
})
