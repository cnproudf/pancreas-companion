import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  appendEntry,
  entriesFor,
  FOOD_LOG_STORAGE_KEY,
  hydrateLog,
  makeEntry,
  makeEstimateEntry,
  readLog,
  removeEntry,
  sumFat,
  updateEntry,
  writeLog,
  type FoodLog,
  type FoodLogEntry,
} from './foodLog.ts'
import type { Food } from '../types.ts'

const chicken: Food = {
  id: 'chicken-breast-skinless-baked',
  name: 'Chicken breast, skinless, baked or grilled',
  aliases: ['grilled chicken'],
  servingDescription: '4 oz cooked',
  fatGrams: 3.5,
  category: 'poultry',
  tags: [],
  flags: [],
  modifications: ['Ask for it cooked dry'],
  notes: null,
}

function entry(patch: Partial<FoodLogEntry> = {}): FoodLogEntry {
  return {
    id: 'e1',
    foodId: 'chicken-breast-skinless-baked',
    name: 'Chicken breast, skinless, baked or grilled',
    servingDescription: '4 oz cooked',
    fatGrams: 3.5,
    loggedAt: '2026-08-03T18:00:00.000Z',
    ...patch,
  }
}

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

/* dateKey moved to days.ts in Phase 7. Its suite went with it. */

describe('makeEntry', () => {
  it('copies the name, serving, and grams rather than referencing the food', () => {
    // The log has to say what was true at the time, so a later correction to
    // data/foods.json cannot rewrite her history.
    const result = makeEntry(chicken, new Date(2026, 7, 3, 18, 0, 0))
    expect(result.foodId).toBe('chicken-breast-skinless-baked')
    expect(result.name).toBe('Chicken breast, skinless, baked or grilled')
    expect(result.servingDescription).toBe('4 oz cooked')
    expect(result.fatGrams).toBe(3.5)
  })

  it('gives every entry a distinct id', () => {
    const a = makeEntry(chicken)
    const b = makeEntry(chicken)
    expect(a.id).not.toBe(b.id)
  })
})

describe('appendEntry', () => {
  it('files an entry under the local day of its own timestamp', () => {
    const log = appendEntry({}, entry({ loggedAt: new Date(2026, 7, 3, 20, 0, 0).toISOString() }))
    expect(Object.keys(log)).toEqual(['2026-08-03'])
  })

  it('adds to an existing day without dropping what is there', () => {
    const first = appendEntry({}, entry({ id: 'a' }), '2026-08-03')
    const second = appendEntry(first, entry({ id: 'b' }), '2026-08-03')
    expect(entriesFor(second, '2026-08-03')).toHaveLength(2)
  })

  it('does not mutate the log passed in', () => {
    const original: FoodLog = {}
    appendEntry(original, entry(), '2026-08-03')
    expect(original).toEqual({})
  })
})

describe('removeEntry', () => {
  const day = '2026-08-03'

  it('drops the named entry and keeps its neighbours', () => {
    let log = appendEntry({}, entry({ id: 'a' }), day)
    log = appendEntry(log, entry({ id: 'b' }), day)
    log = appendEntry(log, entry({ id: 'c' }), day)

    expect(entriesFor(removeEntry(log, day, 'b'), day).map((e) => e.id)).toEqual(['a', 'c'])
  })

  it('deletes the day entirely when its last entry goes', () => {
    // hydrateLog drops empty days on the way back in, so leaving an empty array
    // here would mean a write then read round trip changed the shape.
    const log = appendEntry({}, entry({ id: 'only' }), day)
    const result = removeEntry(log, day, 'only')
    expect(result).toEqual({})
    expect(Object.keys(result)).not.toContain(day)
    expect(hydrateLog(result)).toEqual(result)
  })

  it('does not mutate the log passed in', () => {
    const log = appendEntry({}, entry({ id: 'a' }), day)
    removeEntry(log, day, 'a')
    expect(entriesFor(log, day)).toHaveLength(1)
  })

  it('returns the log unchanged for an unknown id or an unknown day', () => {
    const log = appendEntry({}, entry({ id: 'a' }), day)
    expect(removeEntry(log, day, 'nope')).toBe(log)
    expect(removeEntry(log, '2026-08-04', 'a')).toBe(log)
  })

  it('leaves other days alone', () => {
    let log = appendEntry({}, entry({ id: 'a' }), day)
    log = appendEntry(log, entry({ id: 'b' }), '2026-08-02')
    expect(Object.keys(removeEntry(log, day, 'a'))).toEqual(['2026-08-02'])
  })
})

describe('updateEntry', () => {
  const day = '2026-08-03'
  const log = appendEntry({}, entry({ id: 'a', fatGrams: 12 }), day)

  it('corrects the grams, which is the half portion case', () => {
    expect(entriesFor(updateEntry(log, day, 'a', 6), day)[0]?.fatGrams).toBe(6)
  })

  it('leaves the name and serving as they were logged', () => {
    const updated = entriesFor(updateEntry(log, day, 'a', 6), day)[0]
    expect(updated?.name).toBe('Chicken breast, skinless, baked or grilled')
    expect(updated?.servingDescription).toBe('4 oz cooked')
    expect(updated?.loggedAt).toBe('2026-08-03T18:00:00.000Z')
  })

  it('rounds to one decimal', () => {
    expect(entriesFor(updateEntry(log, day, 'a', 6.28), day)[0]?.fatGrams).toBe(6.3)
  })

  it('accepts zero, which is a real correction', () => {
    expect(entriesFor(updateEntry(log, day, 'a', 0), day)[0]?.fatGrams).toBe(0)
  })

  it('rejects what hydrateEntry would reject, so an edit cannot write a droppable row', () => {
    // A negative would quietly refund her budget.
    expect(updateEntry(log, day, 'a', -4)).toBe(log)
    expect(updateEntry(log, day, 'a', Number.NaN)).toBe(log)
    expect(updateEntry(log, day, 'a', Number.POSITIVE_INFINITY)).toBe(log)
  })

  it('does not mutate the log passed in', () => {
    updateEntry(log, day, 'a', 6)
    expect(entriesFor(log, day)[0]?.fatGrams).toBe(12)
  })

  it('returns the log unchanged for an unknown id or an unknown day', () => {
    expect(updateEntry(log, day, 'nope', 6)).toBe(log)
    expect(updateEntry(log, '2026-08-04', 'a', 6)).toBe(log)
  })
})

describe('sumFat', () => {
  it('is zero for an empty day', () => {
    expect(sumFat([])).toBe(0)
  })

  it('adds one decimal gram values without floating point drift', () => {
    const total = sumFat([entry({ fatGrams: 3.5 }), entry({ fatGrams: 16 }), entry({ fatGrams: 0.1 })])
    expect(total).toBe(19.6)
  })
})

describe('hydrateLog', () => {
  it('returns an empty log for null, a primitive, and an array', () => {
    expect(hydrateLog(null)).toEqual({})
    expect(hydrateLog('nonsense')).toEqual({})
    expect(hydrateLog(42)).toEqual({})
    expect(hydrateLog([1, 2, 3])).toEqual({})
  })

  it('drops keys that are not local date strings', () => {
    const result = hydrateLog({ today: [entry()], '2026-8-3': [entry()], '2026-08-03': [entry()] })
    expect(Object.keys(result)).toEqual(['2026-08-03'])
  })

  it('drops a damaged entry and keeps its neighbours', () => {
    const result = hydrateLog({
      '2026-08-03': [entry({ id: 'a' }), { id: 'b' }, entry({ id: 'c' })],
    })
    expect(entriesFor(result, '2026-08-03').map((e) => e.id)).toEqual(['a', 'c'])
  })

  it('rejects an entry whose grams are missing, unusable, or negative', () => {
    const result = hydrateLog({
      '2026-08-03': [
        entry({ id: 'a', fatGrams: Number.NaN }),
        entry({ id: 'b', fatGrams: -4 }),
        { ...entry({ id: 'c' }), fatGrams: '3.5' },
        entry({ id: 'd', fatGrams: 0 }),
      ],
    })
    // Zero is legitimate. A drink of water costs nothing and is still a log.
    expect(entriesFor(result, '2026-08-03').map((e) => e.id)).toEqual(['d'])
  })

  it('recovers an entry that lost its serving description', () => {
    const damaged = { ...entry(), servingDescription: 42 }
    const result = hydrateLog({ '2026-08-03': [damaged] })
    expect(entriesFor(result, '2026-08-03')[0]?.servingDescription).toBe('')
  })

  it('accepts a null foodId, which is how a non dataset entry is stored', () => {
    const result = hydrateLog({ '2026-08-03': [entry({ foodId: null })] })
    expect(entriesFor(result, '2026-08-03')[0]?.foodId).toBeNull()
  })

  it('omits a day whose entries were all damaged rather than leaving it empty', () => {
    expect(hydrateLog({ '2026-08-03': [{ id: 'broken' }] })).toEqual({})
  })

  it('drops a day whose value is not an array', () => {
    expect(hydrateLog({ '2026-08-03': 'nope' })).toEqual({})
  })
})

describe('readLog and writeLog', () => {
  it('round trips through storage under the pc prefix', () => {
    const log = appendEntry({}, entry(), '2026-08-03')
    expect(writeLog(log)).toBe(true)
    expect(localStorage.getItem(`pc:${FOOD_LOG_STORAGE_KEY}`)).not.toBeNull()
    expect(readLog()).toEqual(log)
  })

  it('returns an empty log rather than throwing on a corrupted blob', () => {
    localStorage.setItem(`pc:${FOOD_LOG_STORAGE_KEY}`, '{not json')
    expect(readLog()).toEqual({})
  })

  it('reports a failed write instead of throwing when storage refuses', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(writeLog(appendEntry({}, entry(), '2026-08-03'))).toBe(false)
  })

  it('returns an empty log when storage cannot be read at all', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('private mode')
    })
    expect(readLog()).toEqual({})
  })
})

/**
 * PHASE 11. An entry whose gram value the Worker estimated.
 *
 * The round trip cases below are the ones that matter, and they are not
 * ceremony. hydrateEntry rebuilds the entry field by field, so a field that is
 * added to the interface and not to the hydrator is kept by the write and
 * dropped by the next read: it works for the whole session that added it and is
 * silently gone after a reload, with nothing throwing and nothing failing to
 * type check. Asserting the round trip is the only thing that catches it.
 */
describe('makeEstimateEntry', () => {
  it('marks the entry as not from the dataset, and as estimated', () => {
    const result = makeEstimateEntry(
      { name: 'zzyzx casserole', servingDescription: 'one serving', fatGrams: 14 },
      new Date(2026, 7, 3, 18, 0, 0),
    )

    // foodId null is what that field was reserved for. It must never resolve
    // against data/foods.json, because there is no entry to resolve to.
    expect(result.foodId).toBeNull()
    expect(result.aiEstimated).toBe(true)
    expect(result.name).toBe('zzyzx casserole')
  })

  it('rounds grams to one decimal, like every other gram value in the app', () => {
    expect(makeEstimateEntry({ name: 'x', servingDescription: '', fatGrams: 14.26 }).fatGrams).toBe(
      14.3,
    )
  })

  it('trims the name, since it is whatever she typed', () => {
    expect(makeEstimateEntry({ name: '  soup  ', servingDescription: '', fatGrams: 1 }).name).toBe(
      'soup',
    )
  })
})

describe('aiEstimated survives storage', () => {
  it('is still there after a write and a read', () => {
    const estimate = entry({ id: 'e2', foodId: null, aiEstimated: true })
    const log: FoodLog = { '2026-08-03': [estimate] }

    writeLog(log)
    expect(readLog()['2026-08-03']?.[0]?.aiEstimated).toBe(true)
    expect(readLog()).toEqual(log)
  })

  it('is absent rather than false on an ordinary dataset entry', () => {
    writeLog({ '2026-08-03': [entry()] })

    const restored = readLog()['2026-08-03']?.[0]
    expect(restored).not.toHaveProperty('aiEstimated')
  })

  it('reads anything other than true as a dataset entry', () => {
    // Understating provenance is the safe direction. Inventing it is not.
    for (const value of ['true', 1, {}, null]) {
      const log = hydrateLog({
        '2026-08-03': [{ ...entry(), aiEstimated: value }],
      })
      expect(log['2026-08-03']?.[0], String(value)).not.toHaveProperty('aiEstimated')
    }
  })

  it('leaves every log written before Phase 11 readable and unmarked', () => {
    const legacy = {
      '2026-08-03': [
        {
          id: 'old',
          foodId: 'chicken-breast-skinless-baked',
          name: 'Chicken breast, skinless, baked or grilled',
          servingDescription: '4 oz cooked',
          fatGrams: 3.5,
          loggedAt: '2026-08-03T18:00:00.000Z',
        },
      ],
    }

    const log = hydrateLog(legacy)
    expect(log['2026-08-03']).toHaveLength(1)
    expect(log['2026-08-03']?.[0]).not.toHaveProperty('aiEstimated')
  })
})
