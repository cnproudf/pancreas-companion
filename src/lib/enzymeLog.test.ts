import { afterEach, describe, expect, it } from 'vitest'
import {
  ENZYME_COPY,
  ENZYME_LOG_STORAGE_KEY,
  MEAL_SLOTS,
  SLOT_LABELS,
  dayFor,
  hydrateEnzymeLog,
  readEnzymeLog,
  setSlot,
  slotStatusText,
  stateFor,
  stateLabel,
  toggleSlot,
  writeEnzymeLog,
  type EnzymeLog,
} from './enzymeLog.ts'
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
  storage.remove(ENZYME_LOG_STORAGE_KEY)
})

describe('hydrateEnzymeLog', () => {
  it('returns an empty log for anything that is not a record', () => {
    expect(hydrateEnzymeLog(null)).toEqual({})
    expect(hydrateEnzymeLog([])).toEqual({})
  })

  it('drops keys that are not day keys', () => {
    expect(hydrateEnzymeLog({ [DAY]: { lunch: 'taken' }, today: { lunch: 'taken' } })).toEqual({
      [DAY]: { lunch: 'taken' },
    })
  })

  it('drops unknown slots and unknown states one at a time', () => {
    expect(
      hydrateEnzymeLog({ [DAY]: { lunch: 'taken', brunch: 'taken', dinner: 'maybe' } }),
    ).toEqual({ [DAY]: { lunch: 'taken' } })
  })

  it('drops a day with nothing recorded', () => {
    expect(hydrateEnzymeLog({ [DAY]: {}, [OTHER]: { dinner: 'not-taken' } })).toEqual({
      [OTHER]: { dinner: 'not-taken' },
    })
  })

  /*
   * A stored `false` must not become 'not-taken'. That is the boolean this
   * module exists to avoid, and a lenient hydrate would smuggle it back in.
   */
  it('does not read a boolean as a recorded state', () => {
    expect(hydrateEnzymeLog({ [DAY]: { lunch: false, dinner: true } })).toEqual({})
  })
})

describe('read and write', () => {
  it('round trips through storage', () => {
    expect(writeEnzymeLog({ [DAY]: { lunch: 'taken' } })).toBe(true)
    expect(readEnzymeLog()).toEqual({ [DAY]: { lunch: 'taken' } })
  })

  it('survives a corrupted blob', () => {
    localStorage.setItem(`${storage.STORAGE_PREFIX}${ENZYME_LOG_STORAGE_KEY}`, 'not json')
    expect(readEnzymeLog()).toEqual({})
  })
})

describe('stateFor', () => {
  /*
   * THE CENTRAL CLAIM OF THIS MODULE. An untapped slot is unknown, not a dose
   * she did not take. Collapsing these two would invent a fact about her care
   * that she never recorded, on a log she may show her gastroenterologist.
   */
  it('reads an untouched slot as null, never as not-taken', () => {
    expect(stateFor({}, 'lunch', DAY)).toBeNull()
    expect(stateFor({ [DAY]: { breakfast: 'taken' } }, 'lunch', DAY)).toBeNull()
  })

  it('reads a recorded slot', () => {
    expect(stateFor({ [DAY]: { lunch: 'not-taken' } }, 'lunch', DAY)).toBe('not-taken')
  })

  it('reads a different day as untouched', () => {
    expect(stateFor({ [DAY]: { lunch: 'taken' } }, 'lunch', OTHER)).toBeNull()
  })
})

describe('setSlot', () => {
  it('records a state', () => {
    expect(setSlot({}, 'lunch', 'taken', DAY)).toEqual({ [DAY]: { lunch: 'taken' } })
  })

  it('replaces one slot and leaves the others alone', () => {
    const log: EnzymeLog = { [DAY]: { breakfast: 'taken', lunch: 'taken' } }
    expect(setSlot(log, 'lunch', 'not-taken', DAY)).toEqual({
      [DAY]: { breakfast: 'taken', lunch: 'not-taken' },
    })
  })

  it('clears a slot back to unrecorded', () => {
    const log: EnzymeLog = { [DAY]: { breakfast: 'taken', lunch: 'taken' } }
    expect(setSlot(log, 'lunch', null, DAY)).toEqual({ [DAY]: { breakfast: 'taken' } })
  })

  it('removes a day that empties rather than leaving an empty object', () => {
    expect(setSlot({ [DAY]: { lunch: 'taken' } }, 'lunch', null, DAY)).toEqual({})
  })

  it('does not mutate the log it was given', () => {
    const log: EnzymeLog = { [DAY]: { lunch: 'taken' } }
    setSlot(log, 'dinner', 'taken', DAY)
    expect(log).toEqual({ [DAY]: { lunch: 'taken' } })
  })

  it('returns the same log when nothing changes', () => {
    const log: EnzymeLog = { [DAY]: { lunch: 'taken' } }
    expect(setSlot(log, 'lunch', 'taken', DAY)).toBe(log)
    expect(setSlot(log, 'dinner', null, DAY)).toBe(log)
  })

  it('ignores a malformed day key', () => {
    const log: EnzymeLog = { [DAY]: { lunch: 'taken' } }
    expect(setSlot(log, 'lunch', 'taken', 'tuesday')).toBe(log)
  })
})

describe('toggleSlot', () => {
  it('records a state on an untouched slot', () => {
    expect(toggleSlot({}, 'dinner', 'taken', DAY)).toEqual({ [DAY]: { dinner: 'taken' } })
  })

  it('switches between the two states', () => {
    const log = toggleSlot({ [DAY]: { dinner: 'taken' } }, 'dinner', 'not-taken', DAY)
    expect(stateFor(log, 'dinner', DAY)).toBe('not-taken')
  })

  /*
   * A route back to "I did not record this". Without it, tapping "Not this one"
   * by accident would leave a permanent claim she never meant to make.
   */
  it('clears back to unrecorded when she taps the state it is already in', () => {
    expect(toggleSlot({ [DAY]: { dinner: 'taken' } }, 'dinner', 'taken', DAY)).toEqual({})
    expect(
      stateFor(toggleSlot({ [DAY]: { dinner: 'not-taken' } }, 'dinner', 'not-taken', DAY), 'dinner', DAY),
    ).toBeNull()
  })
})

describe('dayFor', () => {
  it('reads an untouched day as empty', () => {
    expect(dayFor({}, DAY)).toEqual({})
  })
})

describe('labels', () => {
  it('names the unrecorded state rather than leaving it blank', () => {
    expect(stateLabel(null)).toBe('Not recorded')
    expect(stateLabel('taken')).toBe('Took them')
    expect(stateLabel('not-taken')).toBe('Not this one')
  })

  it('reads a slot out in words', () => {
    expect(slotStatusText('breakfast', 'taken')).toBe('Breakfast: took them')
    expect(slotStatusText('lunch', null)).toBe('Lunch: not recorded')
  })

  it('has a label for every slot', () => {
    for (const slot of MEAL_SLOTS) expect(SLOT_LABELS[slot]).toBeTruthy()
  })

  it('carries four slots, so the 4 to 6 small meals pattern is not contradicted', () => {
    expect(MEAL_SLOTS).toHaveLength(4)
  })
})

describe('ENZYME_COPY', () => {
  const lines = Object.entries(ENZYME_COPY)

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
   * "Missed" is the obvious word for the negative state and it is the wrong
   * one. It addresses her conduct rather than the fact, and CALENDAR_RATE_PATTERN
   * already bans it elsewhere in the app for the same reason.
   */
  it('does not call an untaken dose a missed one', () => {
    for (const [key, text] of lines) expect(text, key).not.toMatch(CALENDAR_RATE_PATTERN)
    expect(Object.values(ENZYME_COPY).join(' ').toLowerCase()).not.toContain('missed')
  })

  /* Spec 5.7: whether she needs enzymes is her care team's call, not the app's. */
  it('leaves the decision with her care team', () => {
    expect(ENZYME_COPY.toggleHint).toContain('care team')
  })
})
