import { describe, expect, it } from 'vitest'
import {
  FRIEND_NOTES,
  LIFT_ENTRIES,
  LIFT_PROBLEMS,
  mergeLiftFiles,
  parseFriendNotes,
  parseLiftFile,
} from './dailyLift.ts'
import friendsJson from '@data/friends-notes.json'
import { LIFT_TYPES } from '../types.ts'

/**
 * The Daily Lift is the reason she opens the app, so the data layer for it gets
 * the same scrutiny as the food list.
 *
 * Phase 2 stops at the arrays. The rotation, the deterministic day-of-year
 * pick, and the twice-a-week friend note weighting are Phase 5.
 */

describe('the merged rotation', () => {
  it('loads a full year without a problem', () => {
    expect(LIFT_PROBLEMS).toEqual([])
    expect(LIFT_ENTRIES).toHaveLength(365)
  })

  it('runs from lift-001 to lift-365', () => {
    expect(LIFT_ENTRIES.at(0)?.id).toBe('lift-001')
    expect(LIFT_ENTRIES.at(-1)?.id).toBe('lift-365')
  })

  it('has no id collisions across the three files', () => {
    // The whole risk of a hand-maintained three file split is a repeated id.
    expect(new Set(LIFT_ENTRIES.map((e) => e.id)).size).toBe(365)
  })

  it('uses only the five types that exist in the data', () => {
    for (const entry of LIFT_ENTRIES) {
      expect(LIFT_TYPES).toContain(entry.type)
    }
  })

  it('never carries a from-a-friend type', () => {
    // The spec lists it, the data does not implement it, and the loader must
    // not invent it. Friend notes stay their own shape.
    expect(LIFT_ENTRIES.some((e) => String(e.type) === 'from-a-friend')).toBe(false)
  })

  it('treats attribution as absent rather than null', () => {
    const withAttribution = LIFT_ENTRIES.filter((e) => 'attribution' in e)
    expect(withAttribution).toHaveLength(12)
    for (const entry of LIFT_ENTRIES) {
      expect(entry.attribution).not.toBeNull()
    }
    // Only quotes are attributed.
    for (const entry of withAttribution) {
      expect(entry.type).toBe('quote')
    }
  })

  it('contains no em dashes or en dashes', () => {
    for (const entry of LIFT_ENTRIES) {
      expect(entry.content).not.toMatch(/[—–]/)
      if (entry.attribution !== undefined) expect(entry.attribution).not.toMatch(/[—–]/)
    }
  })
})

describe('friend notes', () => {
  it('loads with a name and a date on every note', () => {
    expect(FRIEND_NOTES.length).toBeGreaterThan(0)
    for (const note of FRIEND_NOTES) {
      expect(note.id.length).toBeGreaterThan(0)
      expect(note.from.length).toBeGreaterThan(0)
      expect(note.content.length).toBeGreaterThan(0)
      expect(note.dateAdded).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('does not collide with lift ids', () => {
    const liftIds = new Set(LIFT_ENTRIES.map((e) => e.id))
    for (const note of FRIEND_NOTES) {
      expect(liftIds.has(note.id)).toBe(false)
    }
  })

  it('carries no type field in the source data', () => {
    const raw = (friendsJson as { notes: Record<string, unknown>[] }).notes
    for (const note of raw) {
      expect('type' in note).toBe(false)
    }
  })

  it('contains no em dashes or en dashes', () => {
    for (const note of FRIEND_NOTES) {
      expect(note.content).not.toMatch(/[—–]/)
    }
  })
})

describe('parseLiftFile', () => {
  const good = { id: 'lift-900', type: 'fun-fact', content: 'Wombat droppings are cubes.' }

  it('does not throw on malformed input', () => {
    expect(() => parseLiftFile(null, 'test')).not.toThrow()
    expect(() => parseLiftFile({ entries: 'nope' }, 'test')).not.toThrow()
    expect(parseLiftFile(null, 'test').problems.length).toBeGreaterThan(0)
  })

  it('reports an unknown type', () => {
    const result = parseLiftFile({ entries: [{ ...good, type: 'from-a-friend' }] }, 'test')
    expect(result.entries).toEqual([])
    expect(result.problems.map((p) => p.field)).toContain('type')
  })

  it('reports a missing content', () => {
    const result = parseLiftFile({ entries: [{ ...good, content: '' }] }, 'test')
    expect(result.problems.map((p) => p.field)).toContain('content')
  })

  it('omits attribution rather than setting it undefined', () => {
    const result = parseLiftFile({ entries: [good] }, 'test')
    const entry = result.entries.at(0)
    expect(entry).toBeDefined()
    if (entry === undefined) return
    expect('attribution' in entry).toBe(false)
  })

  it('keeps an attribution when one is present', () => {
    const result = parseLiftFile(
      { entries: [{ ...good, type: 'quote', attribution: 'Someone' }] },
      'test',
    )
    expect(result.entries.at(0)?.attribution).toBe('Someone')
  })
})

describe('mergeLiftFiles', () => {
  const entry = (id: string): Record<string, unknown> => ({
    id,
    type: 'fun-fact',
    content: 'Something true and small.',
  })

  it('concatenates and sorts by id', () => {
    const result = mergeLiftFiles([
      { raw: { entries: [entry('lift-300')] }, source: 'c' },
      { raw: { entries: [entry('lift-001')] }, source: 'a' },
    ])
    expect(result.entries.map((e) => e.id)).toEqual(['lift-001', 'lift-300'])
    expect(result.problems).toEqual([])
  })

  it('reports an id repeated across two files', () => {
    const result = mergeLiftFiles([
      { raw: { entries: [entry('lift-001')] }, source: 'a' },
      { raw: { entries: [entry('lift-001')] }, source: 'b' },
    ])
    expect(result.entries).toHaveLength(1)
    expect(result.problems.map((p) => p.field)).toContain('id')
  })
})

describe('parseFriendNotes', () => {
  it('does not throw on malformed input', () => {
    expect(() => parseFriendNotes(null, 'test')).not.toThrow()
    expect(parseFriendNotes(null, 'test').notes).toEqual([])
  })

  it('reports a note with no name', () => {
    const result = parseFriendNotes(
      { notes: [{ id: 'note-9', from: '', content: 'hello', dateAdded: '2026-01-01' }] },
      'test',
    )
    expect(result.problems.map((p) => p.field)).toContain('from')
  })

  it('reports a malformed date', () => {
    const result = parseFriendNotes(
      { notes: [{ id: 'note-9', from: 'Sam', content: 'hello', dateAdded: 'last tuesday' }] },
      'test',
    )
    expect(result.problems.map((p) => p.field)).toContain('dateAdded')
  })
})
