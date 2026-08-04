import { afterEach, describe, expect, it, vi } from 'vitest'
import { FRIEND_NOTES, LIFT_ENTRIES } from './dailyLift.ts'
import {
  dayNumber,
  friendSlotsBefore,
  generalIndexFor,
  instructsEating,
  isFriendDay,
  liftItemId,
  LIFT_COPY,
  pickLift,
  poolFor,
} from './liftRotation.ts'
import { DASH_PATTERN, SCOLDING_PATTERN } from '../test/copyInvariants.ts'

/**
 * The Daily Lift is the reason she opens the app, so the rotation gets the same
 * scrutiny as the rating engine.
 *
 * The rules being defended: it never reshuffles on a refresh, it never comes up
 * empty, a friend note lands exactly twice a week, and flare mode never serves
 * an instruction to eat something above the triage screen.
 */

describe('dayNumber', () => {
  it('counts local calendar days, not UTC ones', () => {
    // 2am and 8pm on the same local date have to be the same day. Deriving this
    // from the timestamp would split them for anyone east or west of UTC.
    const earlyMorning = new Date(2026, 7, 4, 2, 0, 0)
    const evening = new Date(2026, 7, 4, 20, 0, 0)
    expect(dayNumber(earlyMorning)).toBe(dayNumber(evening))
  })

  it('rolls over at local midnight', () => {
    const lastMinute = new Date(2026, 7, 4, 23, 59, 59)
    const firstSecond = new Date(2026, 7, 5, 0, 0, 1)
    expect(dayNumber(firstSecond) - dayNumber(lastMinute)).toBe(1)
  })

  it('advances by one per day across a year boundary', () => {
    expect(dayNumber(new Date(2027, 0, 1)) - dayNumber(new Date(2026, 11, 31))).toBe(1)
  })

  it('does not replay a calendar date in the following year', () => {
    // The whole reason for a monotonic count rather than day-of-year.
    const first = dayNumber(new Date(2026, 5, 15))
    const second = dayNumber(new Date(2027, 5, 15))
    expect(second - first).toBe(365)
  })
})

describe('friend day scheduling', () => {
  it('lands exactly twice in every rolling seven days', () => {
    for (let start = 0; start < 700; start += 1) {
      let count = 0
      for (let day = start; day < start + 7; day += 1) {
        if (isFriendDay(day)) count += 1
      }
      expect(count).toBe(2)
    }
  })

  it('counts elapsed friend slots correctly', () => {
    expect(friendSlotsBefore(0)).toBe(0)
    expect(friendSlotsBefore(2)).toBe(0)
    expect(friendSlotsBefore(3)).toBe(1)
    expect(friendSlotsBefore(6)).toBe(2)
    expect(friendSlotsBefore(7)).toBe(2)
    expect(friendSlotsBefore(14)).toBe(4)
  })

  it('agrees with a brute force count', () => {
    let running = 0
    for (let day = 0; day < 400; day += 1) {
      expect(friendSlotsBefore(day)).toBe(running)
      if (isFriendDay(day)) running += 1
    }
  })

  it('advances the slot index by one per friend day, so notes cycle in order', () => {
    const slots = [...Array(200).keys()].filter(isFriendDay).map(friendSlotsBefore)
    expect(slots).toEqual([...Array(slots.length).keys()])
  })
})

describe('pickLift', () => {
  it('returns the same item for the same day, every time', () => {
    for (const day of [0, 1, 2, 19_000, 20_305]) {
      const first = pickLift(day)
      const second = pickLift(day)
      expect(first).not.toBeNull()
      expect(liftItemId(first!)).toBe(liftItemId(second!))
    }
  })

  it('changes from one day to the next', () => {
    for (let day = 0; day < 60; day += 1) {
      expect(liftItemId(pickLift(day)!)).not.toBe(liftItemId(pickLift(day + 1)!))
    }
  })

  it('serves a friend note on friend days and a lift entry otherwise', () => {
    for (let day = 0; day < 200; day += 1) {
      expect(pickLift(day)?.kind).toBe(isFriendDay(day) ? 'friend-note' : 'lift')
    }
  })

  it('walks the whole rotation before repeating an entry', () => {
    // Indexing by the raw day number would skip roughly two entries a week and
    // never come back for them. This is the test that catches that.
    const seen: string[] = []
    let day = 0
    while (seen.length < LIFT_ENTRIES.length && day < 5000) {
      const item = pickLift(day)
      if (item?.kind === 'lift') seen.push(item.entry.id)
      day += 1
    }
    expect(seen).toHaveLength(LIFT_ENTRIES.length)
    expect(new Set(seen).size).toBe(LIFT_ENTRIES.length)
  })

  it('steps into the general rotation on the first tap of a friend day', () => {
    const friendDay = 2
    expect(isFriendDay(friendDay)).toBe(true)
    expect(pickLift(friendDay, 0)?.kind).toBe('friend-note')

    const stepped = pickLift(friendDay, 1)
    expect(stepped?.kind).toBe('lift')
    // Offset 1 lands on the entry the day would otherwise have carried, not one
    // past it, so the friend slot does not swallow an entry.
    expect(liftItemId(stepped!)).toBe(LIFT_ENTRIES[generalIndexFor(friendDay)]?.id)
  })

  it('never repeats within a full walk of the offsets', () => {
    const generalDay = 101
    expect(isFriendDay(generalDay)).toBe(false)

    const ids = new Set<string>()
    for (let offset = 0; offset < LIFT_ENTRIES.length; offset += 1) {
      ids.add(liftItemId(pickLift(generalDay, offset)!))
    }
    expect(ids.size).toBe(LIFT_ENTRIES.length)
  })

  it('wraps rather than falling off the end of the rotation', () => {
    const item = pickLift(101, LIFT_ENTRIES.length * 3 + 7)
    expect(item).not.toBeNull()
  })

  it('handles a negative day number without producing nothing', () => {
    // Not reachable from a real clock, but mod on a negative left side is the
    // classic way a rotation like this returns undefined.
    for (let day = -30; day < 0; day += 1) {
      expect(pickLift(day)).not.toBeNull()
    }
  })
})

describe('flare mode', () => {
  it('withholds exactly the entries that instruct her to eat', () => {
    // Pinned deliberately. If a Phase 12 entry starts matching, or one of these
    // stops matching, this fails loudly rather than letting food guidance render
    // above the triage screen.
    expect(LIFT_ENTRIES.filter(instructsEating).map((e) => e.id)).toEqual([
      'lift-091',
      'lift-273',
    ])
  })

  it('does not withhold reflections about eating, only instructions', () => {
    const kept = ['lift-133', 'lift-174', 'lift-254', 'lift-354']
    for (const id of kept) {
      const entry = LIFT_ENTRIES.find((e) => e.id === id)
      expect(entry).toBeDefined()
      expect(instructsEating(entry!)).toBe(false)
    }
  })

  it('keeps the hydration entry, since clear liquids are the flare guidance', () => {
    const water = LIFT_ENTRIES.find((e) => e.id === 'lift-005')
    expect(water).toBeDefined()
    expect(instructsEating(water!)).toBe(false)
  })

  it('shrinks the pool only in flare mode', () => {
    expect(poolFor('stable')).toHaveLength(365)
    expect(poolFor('recovering')).toHaveLength(365)
    expect(poolFor('flare')).toHaveLength(363)
  })

  it('never serves a withheld entry in flare mode, at any offset', () => {
    for (let day = 0; day < 800; day += 1) {
      for (let offset = 0; offset < 4; offset += 1) {
        const item = pickLift(day, offset, 'flare')
        expect(item).not.toBeNull()
        if (item?.kind === 'lift') expect(instructsEating(item.entry)).toBe(false)
      }
    }
  })

  it('still serves them when she is not in a flare', () => {
    const served = new Set<string>()
    for (let offset = 0; offset < LIFT_ENTRIES.length; offset += 1) {
      const item = pickLift(101, offset, 'stable')
      if (item?.kind === 'lift') served.add(item.entry.id)
    }
    expect(served.has('lift-091')).toBe(true)
    expect(served.has('lift-273')).toBe(true)
  })
})

describe('with no friend notes', () => {
  afterEach(() => {
    vi.doUnmock('./dailyLift.ts')
    vi.resetModules()
  })

  it('falls back to the general rotation instead of rendering nothing', async () => {
    // An empty friends-notes.json is one bad hand edit away, and the file
    // openly invites hand edits from people who do not write code.
    vi.resetModules()
    vi.doMock('./dailyLift.ts', async () => {
      const actual = await vi.importActual<typeof import('./dailyLift.ts')>('./dailyLift.ts')
      return { ...actual, FRIEND_NOTES: [] }
    })

    const rotation = await import('./liftRotation.ts')

    const ids: string[] = []
    for (let day = 0; day < 40; day += 1) {
      const item = rotation.pickLift(day)
      expect(item?.kind).toBe('lift')
      ids.push(rotation.liftItemId(item!))
    }
    // And with no friend slot to skip, every day still gets a distinct entry.
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('the shipped data', () => {
  it('has at least one friend note to put in the friend slot', () => {
    expect(FRIEND_NOTES.length).toBeGreaterThan(0)
  })

  it('opens with the note written in Chad voice', () => {
    // Explicitly requested: note-001 should be the first friend note she sees.
    expect(FRIEND_NOTES[0]?.id).toBe('note-001')
  })
})

describe('LIFT_COPY', () => {
  const strings = Object.values(LIFT_COPY)

  it('contains no em dashes or en dashes', () => {
    for (const line of strings) expect(line).not.toMatch(DASH_PATTERN)
  })

  it('never scolds her', () => {
    for (const line of strings) expect(line).not.toMatch(SCOLDING_PATTERN)
  })
})
