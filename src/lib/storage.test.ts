import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as storage from './storage.ts'

/**
 * The contract that matters: nothing in this module ever throws. A corrupted
 * blob, a full disk, or Safari private mode should cost her a setting, never a
 * white screen.
 */

describe('safeParse', () => {
  it('returns the fallback for null and empty input', () => {
    expect(storage.safeParse(null, 'fallback')).toBe('fallback')
    expect(storage.safeParse('', 'fallback')).toBe('fallback')
  })

  it('returns the fallback for malformed JSON instead of throwing', () => {
    expect(() => storage.safeParse('{not json', 'fallback')).not.toThrow()
    expect(storage.safeParse('{"a":', { a: 1 })).toEqual({ a: 1 })
  })

  it('returns the fallback for a stored literal null', () => {
    expect(storage.safeParse('null', 'fallback')).toBe('fallback')
  })

  it('parses good JSON', () => {
    expect(storage.safeParse('{"a":1}', {})).toEqual({ a: 1 })
    expect(storage.safeParse('false', true)).toBe(false)
    expect(storage.safeParse('0', 9)).toBe(0)
  })
})

describe('get / set round trip', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round trips a value', () => {
    expect(storage.set('demo', { mode: 'stable' })).toBe(true)
    expect(storage.get('demo', null)).toEqual({ mode: 'stable' })
  })

  it('namespaces keys under the app prefix', () => {
    storage.set('demo', 1)
    expect(localStorage.getItem(`${storage.STORAGE_PREFIX}demo`)).toBe('1')
  })

  it('does not double prefix an already namespaced key', () => {
    storage.set(`${storage.STORAGE_PREFIX}demo`, 1)
    expect(localStorage.getItem(`${storage.STORAGE_PREFIX}demo`)).toBe('1')
  })

  it('returns the fallback when the key is absent', () => {
    expect(storage.get('never-written', 'fallback')).toBe('fallback')
  })

  it('returns the fallback when the stored value is corrupt', () => {
    localStorage.setItem(`${storage.STORAGE_PREFIX}demo`, '{broken')
    expect(storage.get('demo', 'fallback')).toBe('fallback')
  })

  it('returns false instead of throwing on a cyclic value', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(storage.set('cyclic', cyclic)).toBe(false)
  })

  it('returns false instead of throwing when the quota is exceeded', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    expect(storage.set('demo', 1)).toBe(false)
    spy.mockRestore()
  })

  it('returns the fallback instead of throwing when reading is blocked', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    expect(storage.get('demo', 'fallback')).toBe('fallback')
    spy.mockRestore()
  })
})

describe('clearAll', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('clears only this app keys and leaves the rest of the origin alone', () => {
    storage.set('a', 1)
    storage.set('b', 2)
    localStorage.setItem('someone-elses-key', 'keep me')

    expect(storage.clearAll()).toBe(true)

    expect(storage.get('a', null)).toBeNull()
    expect(storage.get('b', null)).toBeNull()
    expect(localStorage.getItem('someone-elses-key')).toBe('keep me')
  })
})

describe('isAvailable', () => {
  it('is true in a working environment', () => {
    expect(storage.isAvailable()).toBe(true)
  })

  it('is false, not thrown, when storage access is blocked', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    expect(storage.isAvailable()).toBe(false)
    spy.mockRestore()
  })
})
