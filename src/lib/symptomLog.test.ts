import { afterEach, describe, expect, it } from 'vitest'
import type { FoodLog, FoodLogEntry } from './foodLog.ts'
import {
  addEntry,
  allEntries,
  attachFood,
  entriesFor,
  findEntry,
  foodsInAttachWindow,
  hydrateSymptomLog,
  isBareEntry,
  makeEntry,
  readSymptomLog,
  removeEntry,
  SYMPTOM_COPY,
  updateEntry,
  writeSymptomLog,
  type SymptomDraft,
  type SymptomEntry,
  type SymptomLog,
} from './symptomLog.ts'
import { DASH_PATTERN, SCOLDING_PATTERN } from '../test/copyInvariants.ts'

/* Local noon, so a day key assertion does not depend on the runner's zone. */
function at(day: number, hour = 12): string {
  return new Date(2026, 7, day, hour, 0, 0).toISOString()
}

function entry(patch: Partial<SymptomEntry> = {}): SymptomEntry {
  return {
    id: 's1',
    at: at(4),
    pain: 5,
    symptoms: ['nausea'],
    note: '',
    attachedFoods: [],
    ...patch,
  }
}

function draft(patch: Partial<SymptomDraft> = {}): SymptomDraft {
  return { at: at(4), pain: 5, symptoms: [], note: '', attachedFoods: [], ...patch }
}

function food(patch: Partial<FoodLogEntry> = {}): FoodLogEntry {
  return {
    id: 'f1',
    foodId: 'chicken-breast-skinless-baked',
    name: 'Chicken breast, skinless, baked or grilled',
    servingDescription: '4 oz cooked',
    fatGrams: 3.5,
    loggedAt: at(4, 8),
    ...patch,
  }
}

afterEach(() => {
  localStorage.clear()
})

describe('hydrateSymptomLog', () => {
  it('returns an empty log for anything that is not a record', () => {
    expect(hydrateSymptomLog(null)).toEqual({})
    expect(hydrateSymptomLog('nope')).toEqual({})
    expect(hydrateSymptomLog([])).toEqual({})
  })

  it('reads both the envelope and a bare map', () => {
    const days = { '2026-08-04': [entry()] }
    expect(Object.keys(hydrateSymptomLog({ schemaVersion: 1, days }))).toHaveLength(1)
    expect(Object.keys(hydrateSymptomLog(days))).toHaveLength(1)
  })

  it('keeps an entry carrying nothing but a timestamp', () => {
    /*
     * The load bearing one. The addendum says an entry with only a time is
     * valid and means "something was happening here". Requiring a pain number
     * would delete exactly the entries she made on the days she was least able
     * to fill anything in.
     */
    const log = hydrateSymptomLog({ '2026-08-04': [{ id: 's1', at: at(4) }] })
    const kept = log['2026-08-04']?.at(0)
    expect(kept).toBeDefined()
    expect(kept?.pain).toBeNull()
    expect(kept?.symptoms).toEqual([])
    expect(kept?.note).toBe('')
  })

  it('drops one damaged entry and keeps its siblings', () => {
    const log = hydrateSymptomLog({
      '2026-08-04': [entry({ id: 'a' }), { at: at(4) }, entry({ id: 'b' })],
    })
    expect(log['2026-08-04']?.map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('drops an entry whose timestamp will not parse', () => {
    const log = hydrateSymptomLog({ '2026-08-04': [{ id: 'a', at: 'sometime' }] })
    expect(log).toEqual({})
  })

  it('collapses duplicate ids', () => {
    const log = hydrateSymptomLog({
      '2026-08-04': [entry({ pain: 3 }), entry({ pain: 9 })],
    })
    expect(log['2026-08-04']).toHaveLength(1)
    expect(log['2026-08-04']?.at(0)?.pain).toBe(3)
  })

  it('refiles an entry stored under the wrong day, from its own timestamp', () => {
    const log = hydrateSymptomLog({ '2026-01-01': [entry({ at: at(4) })] })
    expect(log['2026-01-01']).toBeUndefined()
    expect(log['2026-08-04']).toHaveLength(1)
  })

  it('drops unknown symptom chips and collapses repeats', () => {
    const log = hydrateSymptomLog({
      '2026-08-04': [{ id: 'a', at: at(4), symptoms: ['nausea', 'nausea', 'hiccups'] }],
    })
    expect(log['2026-08-04']?.at(0)?.symptoms).toEqual(['nausea'])
  })

  describe('pain', () => {
    /*
     * Pain 0 is a real observation meaning "nothing right now", and null means
     * she skipped the slider. Every case below is about keeping those apart,
     * because collapsing them puts every skipped entry on the bottom of the
     * pain axis and reports it as a pain free moment.
     */
    it('keeps a logged 0 as 0, not as null', () => {
      const log = hydrateSymptomLog({ '2026-08-04': [{ id: 'a', at: at(4), pain: 0 }] })
      expect(log['2026-08-04']?.at(0)?.pain).toBe(0)
    })

    it('turns a missing pain into null, not into 0', () => {
      const log = hydrateSymptomLog({ '2026-08-04': [{ id: 'a', at: at(4) }] })
      expect(log['2026-08-04']?.at(0)?.pain).toBeNull()
    })

    it('turns an out of range pain into null rather than clamping', () => {
      // Clamping would invent a number she never gave.
      const high = hydrateSymptomLog({ '2026-08-04': [{ id: 'a', at: at(4), pain: 47 }] })
      const low = hydrateSymptomLog({ '2026-08-04': [{ id: 'b', at: at(4), pain: -3 }] })
      expect(high['2026-08-04']?.at(0)?.pain).toBeNull()
      expect(low['2026-08-04']?.at(0)?.pain).toBeNull()
    })

    it('turns a non numeric pain into null', () => {
      const log = hydrateSymptomLog({ '2026-08-04': [{ id: 'a', at: at(4), pain: 'bad' }] })
      expect(log['2026-08-04']?.at(0)?.pain).toBeNull()
    })
  })

  it('drops an attached food with negative grams and keeps the entry', () => {
    const log = hydrateSymptomLog({
      '2026-08-04': [
        { id: 'a', at: at(4), attachedFoods: [{ name: 'Toast', fatGrams: -2 }] },
      ],
    })
    expect(log['2026-08-04']).toHaveLength(1)
    expect(log['2026-08-04']?.at(0)?.attachedFoods).toEqual([])
  })
})

describe('storage round trip', () => {
  it('reads back what it wrote', () => {
    const log: SymptomLog = { '2026-08-04': [entry()] }
    expect(writeSymptomLog(log)).toBe(true)
    expect(readSymptomLog()).toEqual(log)
  })

  it('survives a corrupted blob', () => {
    localStorage.setItem('pc:symptomLog', '{not json')
    expect(readSymptomLog()).toEqual({})
  })
})

describe('addEntry', () => {
  it('files under the day of the entry timestamp', () => {
    const log = addEntry({}, entry({ at: at(3) }))
    expect(Object.keys(log)).toEqual(['2026-08-03'])
  })

  it('does not mutate the log it was given', () => {
    const before: SymptomLog = {}
    addEntry(before, entry())
    expect(before).toEqual({})
  })
})

describe('removeEntry', () => {
  it('finds the entry wherever it is filed', () => {
    const log = addEntry(addEntry({}, entry({ id: 'a', at: at(3) })), entry({ id: 'b', at: at(4) }))
    expect(findEntry(removeEntry(log, 'a'), 'a')).toBeNull()
    expect(findEntry(removeEntry(log, 'a'), 'b')).not.toBeNull()
  })

  it('deletes a day that empties rather than leaving an empty array', () => {
    // hydrateSymptomLog drops empty days, so leaving one here would mean a
    // write then read round trip changed the shape of the log.
    const log = addEntry({}, entry({ id: 'a' }))
    expect(removeEntry(log, 'a')).toEqual({})
  })

  it('returns the same log for an unknown id', () => {
    const log = addEntry({}, entry())
    expect(removeEntry(log, 'nope')).toBe(log)
  })
})

describe('updateEntry', () => {
  it('keeps the id', () => {
    const log = addEntry({}, entry({ id: 'a' }))
    const next = updateEntry(log, 'a', draft({ pain: 9 }))
    expect(findEntry(next, 'a')?.pain).toBe(9)
  })

  it('refiles the entry when the timestamp moves it to another day', () => {
    // An edit that crosses midnight has to move the entry, or the chart draws
    // it on a day she did not log.
    const log = addEntry({}, entry({ id: 'a', at: at(4) }))
    const next = updateEntry(log, 'a', draft({ at: at(1) }))
    expect(next['2026-08-04']).toBeUndefined()
    expect(next['2026-08-01']).toHaveLength(1)
  })

  it('can clear a pain number back to null', () => {
    const log = addEntry({}, entry({ id: 'a', pain: 7 }))
    expect(findEntry(updateEntry(log, 'a', draft({ pain: null })), 'a')?.pain).toBeNull()
  })

  it('is a no-op for an unknown id', () => {
    const log = addEntry({}, entry())
    expect(updateEntry(log, 'nope', draft())).toBe(log)
  })
})

describe('ordering', () => {
  it('sorts a day forward in time', () => {
    let log = addEntry({}, entry({ id: 'late', at: at(4, 20) }))
    log = addEntry(log, entry({ id: 'early', at: at(4, 7) }))
    expect(entriesFor(log, '2026-08-04').map((e) => e.id)).toEqual(['early', 'late'])
  })

  it('lists everything newest first', () => {
    let log = addEntry({}, entry({ id: 'old', at: at(1) }))
    log = addEntry(log, entry({ id: 'new', at: at(4) }))
    expect(allEntries(log).map((e) => e.id)).toEqual(['new', 'old'])
  })
})

describe('isBareEntry', () => {
  it('is true for an entry carrying only a timestamp', () => {
    expect(isBareEntry(entry({ pain: null, symptoms: [], note: '' }))).toBe(true)
  })

  it('is false once she gave a 0, which is a real observation', () => {
    expect(isBareEntry(entry({ pain: 0, symptoms: [], note: '' }))).toBe(false)
  })

  it('is false for whitespace only notes but true for empty ones', () => {
    expect(isBareEntry(entry({ pain: null, symptoms: [], note: '   ' }))).toBe(true)
    expect(isBareEntry(entry({ pain: null, symptoms: [], note: 'rough' }))).toBe(false)
  })
})

describe('foodsInAttachWindow', () => {
  /*
   * Anchored to the entry's own timestamp, not to now. That is what makes the
   * flare seam a deferral rather than a denial: AttachFoodSection renders
   * nothing while the gate is closed, and when she opens the same entry later
   * she is still offered the 24 hours around when she actually felt unwell.
   */
  const foodLog: FoodLog = {
    '2026-08-03': [food({ id: 'yesterday-evening', loggedAt: at(3, 19) })],
    '2026-08-04': [
      food({ id: 'this-morning', loggedAt: at(4, 8) }),
      food({ id: 'after', loggedAt: at(4, 18) }),
    ],
    '2026-08-01': [food({ id: 'long-ago', loggedAt: at(1, 12) })],
  }

  it('reaches back across the day boundary', () => {
    const found = foodsInAttachWindow(foodLog, at(4, 14))
    expect(found.map((f) => f.id)).toEqual(['this-morning', 'yesterday-evening'])
  })

  it('excludes anything logged after the moment being asked about', () => {
    // Attaching a dinner she ate after the pain started would be backwards.
    expect(foodsInAttachWindow(foodLog, at(4, 14)).map((f) => f.id)).not.toContain('after')
  })

  it('excludes anything outside the window', () => {
    expect(foodsInAttachWindow(foodLog, at(4, 14)).map((f) => f.id)).not.toContain('long-ago')
  })

  it('anchors to the given moment, not to today', () => {
    const found = foodsInAttachWindow(foodLog, at(1, 18))
    expect(found.map((f) => f.id)).toEqual(['long-ago'])
  })

  it('returns empty rather than throwing on a bad timestamp', () => {
    expect(foodsInAttachWindow(foodLog, 'sometime')).toEqual([])
  })
})

describe('attachFood', () => {
  it('snapshots rather than referencing', () => {
    /*
     * Same reason FoodLogEntry copies out of the dataset: this log is evidence
     * for her doctor and has to keep saying what was true at the time. It also
     * means deleting the food log row later cannot empty the attachment.
     */
    const attached = attachFood(food({ id: 'f9', name: 'Toast', fatGrams: 1.2 }))
    expect(attached).toEqual({
      sourceEntryId: 'f9',
      name: 'Toast',
      servingDescription: '4 oz cooked',
      fatGrams: 1.2,
      loggedAt: at(4, 8),
    })
  })
})

describe('makeEntry', () => {
  it('copies the draft arrays rather than aliasing them', () => {
    const chips: SymptomDraft['symptoms'] = ['nausea']
    const made = makeEntry(draft({ symptoms: chips }))
    chips.push('fatigue')
    expect(made.symptoms).toEqual(['nausea'])
  })
})

describe('SYMPTOM_COPY', () => {
  const lines = Object.values(SYMPTOM_COPY)

  it('has no em or en dashes', () => {
    for (const line of lines) expect(line).not.toMatch(DASH_PATTERN)
  })

  it('never scolds', () => {
    for (const line of lines) expect(line).not.toMatch(SCOLDING_PATTERN)
  })

  it('says the time is the only thing needed', () => {
    expect(SYMPTOM_COPY.sheetIntro).toMatch(/only the time/i)
  })

  it('explains the stool sign plainly and points at her doctor', () => {
    expect(SYMPTOM_COPY.stoolInfo).toMatch(/absorb/i)
    expect(SYMPTOM_COPY.stoolInfo).toMatch(/doctor/i)
  })
})
