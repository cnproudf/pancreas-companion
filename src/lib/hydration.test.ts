import { afterEach, describe, expect, it } from 'vitest'
import {
  GLASS_TARGET,
  HYDRATION_COPY,
  HYDRATION_STORAGE_KEY,
  glassesOn,
  hydrateHydration,
  hydrationReadout,
  readHydration,
  setGlasses,
  tapGlass,
  writeHydration,
  type HydrationLog,
} from './hydration.ts'
import * as storage from './storage.ts'
import {
  CALENDAR_RATE_PATTERN,
  DASH_PATTERN,
  OBLIGATION_PATTERN,
  SCOLDING_PATTERN,
} from '../test/copyInvariants.ts'

const DAY = '2026-08-04'
const OTHER = '2026-08-05'

afterEach(() => {
  storage.remove(HYDRATION_STORAGE_KEY)
})

describe('hydrateHydration', () => {
  it('returns an empty log for anything that is not a record', () => {
    expect(hydrateHydration(null)).toEqual({})
    expect(hydrateHydration([])).toEqual({})
    expect(hydrateHydration('nope')).toEqual({})
  })

  it('drops keys that are not day keys', () => {
    expect(hydrateHydration({ [DAY]: 3, yesterday: 4, '2026-8-4': 2 })).toEqual({ [DAY]: 3 })
  })

  it('drops damaged counts one day at a time', () => {
    expect(hydrateHydration({ [DAY]: 3, [OTHER]: 'four' })).toEqual({ [DAY]: 3 })
  })

  it('clamps a count above the target rather than dropping the day', () => {
    expect(hydrateHydration({ [DAY]: 99 })).toEqual({ [DAY]: GLASS_TARGET })
  })

  /*
   * A stored zero would round trip to an absent day, so it is dropped on the
   * way in. Same rule as the food log: a write then read must not change the
   * shape of the log.
   */
  it('drops zero and negative days', () => {
    expect(hydrateHydration({ [DAY]: 0, [OTHER]: -2 })).toEqual({})
  })

  it('floors a fractional count', () => {
    expect(hydrateHydration({ [DAY]: 3.7 })).toEqual({ [DAY]: 3 })
  })
})

describe('read and write', () => {
  it('round trips through storage', () => {
    expect(writeHydration({ [DAY]: 5 })).toBe(true)
    expect(readHydration()).toEqual({ [DAY]: 5 })
  })

  it('reads an empty log when nothing is stored', () => {
    expect(readHydration()).toEqual({})
  })

  it('survives a corrupted blob', () => {
    localStorage.setItem(`${storage.STORAGE_PREFIX}${HYDRATION_STORAGE_KEY}`, '{oh no')
    expect(readHydration()).toEqual({})
  })
})

describe('setGlasses', () => {
  it('sets a day', () => {
    expect(setGlasses({}, 3, DAY)).toEqual({ [DAY]: 3 })
  })

  it('clamps to the target', () => {
    expect(setGlasses({}, 99, DAY)).toEqual({ [DAY]: GLASS_TARGET })
  })

  it('removes the day rather than storing a zero', () => {
    expect(setGlasses({ [DAY]: 4 }, 0, DAY)).toEqual({})
    expect(setGlasses({ [DAY]: 4, [OTHER]: 2 }, 0, DAY)).toEqual({ [OTHER]: 2 })
  })

  it('leaves other days alone', () => {
    expect(setGlasses({ [OTHER]: 2 }, 5, DAY)).toEqual({ [OTHER]: 2, [DAY]: 5 })
  })

  it('returns the same log when nothing changes', () => {
    const log: HydrationLog = { [DAY]: 3 }
    expect(setGlasses(log, 3, DAY)).toBe(log)
    expect(setGlasses({}, 0, DAY)).toEqual({})
  })

  it('ignores a malformed day key', () => {
    const log: HydrationLog = { [DAY]: 3 }
    expect(setGlasses(log, 5, 'tuesday')).toBe(log)
  })
})

describe('tapGlass', () => {
  it('sets the count to the glass she tapped', () => {
    expect(tapGlass({}, 5, DAY)).toEqual({ [DAY]: 5 })
    expect(tapGlass({ [DAY]: 2 }, 6, DAY)).toEqual({ [DAY]: 6 })
  })

  it('goes down when she taps a lower glass', () => {
    expect(tapGlass({ [DAY]: 6 }, 2, DAY)).toEqual({ [DAY]: 2 })
  })

  /*
   * Tapping the glass that is already the count clears the day. Without this
   * there is no way back from one glass to none with one thumb, and a mistap
   * would need a separate reset control the row does not want.
   */
  it('clears the day when she taps the count itself', () => {
    expect(tapGlass({ [DAY]: 1 }, 1, DAY)).toEqual({})
    expect(tapGlass({ [DAY]: 4 }, 4, DAY)).toEqual({})
  })
})

describe('glassesOn', () => {
  it('reads a day', () => {
    expect(glassesOn({ [DAY]: 4 }, DAY)).toBe(4)
  })

  it('reads an untouched day as none', () => {
    expect(glassesOn({}, DAY)).toBe(0)
  })
})

describe('hydrationReadout', () => {
  /* Invariant 8's reasoning: the count is in words, never in filled icons alone. */
  it('states the count and the target in words', () => {
    expect(hydrationReadout(0)).toBe('0 of 8 glasses')
    expect(hydrationReadout(5)).toBe('5 of 8 glasses')
  })
})

describe('HYDRATION_COPY', () => {
  const lines = Object.entries(HYDRATION_COPY)

  it('has no em or en dashes', () => {
    for (const [key, text] of lines) expect(text, key).not.toMatch(DASH_PATTERN)
  })

  it('never scolds', () => {
    for (const [key, text] of lines) expect(text, key).not.toMatch(SCOLDING_PATTERN)
  })

  /*
   * Spec 5.8 says skip anything fancier, and addendum B's reasoning about the
   * symptom log applies word for word: nothing here may imply she owes the app
   * a tap, or turn an untapped glass into a shortfall.
   */
  it('demands nothing of her', () => {
    for (const [key, text] of lines) expect(text, key).not.toMatch(OBLIGATION_PATTERN)
    for (const [key, text] of lines) expect(text, key).not.toMatch(CALENDAR_RATE_PATTERN)
  })

  it('offers no goal and no reward', () => {
    const all = Object.values(HYDRATION_COPY).join(' ').toLowerCase()
    expect(all).not.toContain('to go')
    expect(all).not.toContain('goal')
    expect(all).not.toContain('great')
    expect(all).not.toContain('well done')
  })
})
