import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  appendEntry,
  dateKey,
  entriesFor,
  FOOD_LOG_STORAGE_KEY,
  hydrateLog,
  makeEntry,
  readLog,
  sumFat,
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

describe('dateKey', () => {
  it('uses local date parts, not UTC', () => {
    // 23:30 local on the 3rd. toISOString would push this to the 4th for anyone
    // west of UTC, moving a late dinner into tomorrow's budget.
    const late = new Date(2026, 7, 3, 23, 30, 0)
    expect(dateKey(late)).toBe('2026-08-03')
  })

  it('does not roll over just before midnight, and does just after', () => {
    expect(dateKey(new Date(2026, 7, 3, 23, 59, 59))).toBe('2026-08-03')
    expect(dateKey(new Date(2026, 7, 4, 0, 0, 1))).toBe('2026-08-04')
  })

  it('pads single digit months and days', () => {
    expect(dateKey(new Date(2026, 0, 9, 12, 0, 0))).toBe('2026-01-09')
  })
})

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
