import { describe, expect, it } from 'vitest'
import { rateFoodForSettings, rateForSettings } from './rateForSettings.ts'
import { rateFood } from './rating.ts'
import { FLARE_CEILING_GRAMS } from './fatTarget.ts'
import { DEFAULT_SETTINGS } from '../state/settingsModel.ts'
import type { Food, Settings } from '../types.ts'

/**
 * The seam between the calculator and the traffic light. This is the only file
 * in the rating layer that knows where T comes from, which is what keeps
 * rating.ts pure and uncoupled.
 */

function settingsWith(patch: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...patch }
}

/** Enough body stats for the calculator to produce a number. */
const COMPLETE_BODY = { age: 41, heightCm: 165, weightKg: 68 }

describe('rateForSettings', () => {
  it('scales thresholds off a care team override', () => {
    const settings = settingsWith({ dailyFatTarget: 42, currentMode: 'stable' })
    const result = rateForSettings(settings, { fatGrams: 5 })

    expect(result.status).toBe('rated')
    if (result.status !== 'rated') return
    expect(result.target).toBe(42)
    expect(result.targetSource).toBe('override')
    expect(result.rating.thresholds.greenMax).toBeCloseTo(4.2, 10)
    expect(result.rating.thresholds.yellowMax).toBeCloseTo(10.5, 10)
  })

  it('uses the flare ceiling as T in flare mode', () => {
    const settings = settingsWith({ ...COMPLETE_BODY, currentMode: 'flare' })
    const result = rateForSettings(settings, { fatGrams: 2 })

    expect(result.status).toBe('rated')
    if (result.status !== 'rated') return
    expect(result.target).toBe(FLARE_CEILING_GRAMS)
    expect(result.targetSource).toBe('flare-ceiling')
    expect(result.rating.thresholds.greenMax).toBeCloseTo(1.5, 10)
    expect(result.rating.thresholds.yellowMax).toBeCloseTo(3.75, 10)
  })

  it('ignores a care team override in flare mode', () => {
    // An override is a normal-eating daily target. Surfacing 30 to 50g during a
    // flare would be wrong in the dangerous direction. computeFatTarget already
    // enforces this; the adapter must not undo it.
    const settings = settingsWith({ dailyFatTarget: 50, currentMode: 'flare' })
    const result = rateForSettings(settings, { fatGrams: 2 })

    expect(result.status).toBe('rated')
    if (result.status !== 'rated') return
    expect(result.target).toBe(FLARE_CEILING_GRAMS)
  })

  it('refuses to guess a target when the profile is incomplete', () => {
    // Main spec section 0 item 2: the target is a user setting, not an app
    // decision. There is no silent fallback to 30g.
    const result = rateForSettings(settingsWith({ currentMode: 'stable' }), { fatGrams: 5 })

    expect(result.status).toBe('no-target')
    if (result.status !== 'no-target') return
    expect(result.target).toBeNull()
    expect(result.missing).toEqual(['age', 'heightCm', 'weightKg'])
  })

  it('uses the calculated target when the profile is complete', () => {
    const settings = settingsWith({ ...COMPLETE_BODY, currentMode: 'stable' })
    const result = rateForSettings(settings, { fatGrams: 3 })

    expect(result.status).toBe('rated')
    if (result.status !== 'rated') return
    expect(result.targetSource).toBe('calculated')
    // Clamped inside the band NPF publishes for chronic pancreatitis.
    expect(result.target).toBeGreaterThanOrEqual(30)
    expect(result.target).toBeLessThanOrEqual(50)
  })

  it('reads the mode from settings, so flare flags fire', () => {
    const stable = rateForSettings(
      settingsWith({ dailyFatTarget: 30, currentMode: 'stable' }),
      { fatGrams: 0.5, flags: ['high-fiber'] },
    )
    const flare = rateForSettings(settingsWith({ currentMode: 'flare' }), {
      fatGrams: 0.5,
      flags: ['high-fiber'],
    })

    expect(stable.status === 'rated' && stable.rating.rating).toBe('green')
    expect(flare.status === 'rated' && flare.rating.rating).toBe('red')
  })

  it('produces exactly what a direct rateFood call would', () => {
    // Proof that the core stayed uncoupled: the adapter only resolves T.
    const settings = settingsWith({ dailyFatTarget: 30, currentMode: 'stable' })
    const result = rateForSettings(settings, {
      fatGrams: 9,
      flags: ['full-fat-dairy'],
      modifications: ['Ask for half the cheese'],
      gramsUsedToday: 27,
    })

    expect(result.status).toBe('rated')
    if (result.status !== 'rated') return
    expect(result.rating).toEqual(
      rateFood({
        fatGrams: 9,
        target: 30,
        mode: 'stable',
        flags: ['full-fat-dairy'],
        modifications: ['Ask for half the cheese'],
        gramsUsedToday: 27,
      }),
    )
  })
})

describe('rateFoodForSettings', () => {
  const cheddar: Food = {
    id: 'cheddar-cheese',
    name: 'Cheddar cheese',
    aliases: [],
    servingDescription: '1 oz',
    fatGrams: 9,
    category: 'dairy',
    tags: [],
    flags: ['full-fat-dairy'],
    modifications: ['Try a smaller amount of a very sharp cheese'],
    notes: null,
  }

  it('rates a food from the dataset', () => {
    const settings = settingsWith({ dailyFatTarget: 30, currentMode: 'stable' })
    const result = rateFoodForSettings(settings, cheddar)

    expect(result.status).toBe('rated')
    if (result.status !== 'rated') return
    expect(result.rating.rating).toBe('red')
    expect(result.rating.modifications).toEqual(['Try a smaller amount of a very sharp cheese'])
  })

  it('passes the day total through', () => {
    const settings = settingsWith({ dailyFatTarget: 30, currentMode: 'stable' })
    const result = rateFoodForSettings(settings, cheddar, { gramsUsedToday: 28 })

    expect(result.status).toBe('rated')
    if (result.status !== 'rated') return
    expect(result.rating.budgetNote?.remainingGrams).toBe(2)
  })

  it('returns no-target rather than guessing', () => {
    expect(rateFoodForSettings(settingsWith({}), cheddar).status).toBe('no-target')
  })
})
