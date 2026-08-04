import { describe, expect, it } from 'vitest'
import {
  BODY_STATS_STALE_MS,
  bodyStatsAreStale,
  calculateFatTarget,
  clamp,
  computeFatTarget,
  equationFor,
  FLARE_CEILING_GRAMS,
  basalEnergy,
} from './fatTarget.ts'
import { DEFAULT_SETTINGS } from '../state/settingsModel.ts'
import type { Settings } from '../types.ts'

/**
 * The Phase 2 rating engine scales every traffic light off this number, so the
 * arithmetic in docs/spec-addendum.md section A is pinned here step by step.
 */

function settingsWith(patch: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...patch }
}

describe('basalEnergy, Mifflin-St Jeor', () => {
  it('runs the female equation', () => {
    // (10 * 68) + (6.25 * 165) - (5 * 45) - 161 = 680 + 1031.25 - 225 - 161
    expect(basalEnergy('female', 68, 165, 45)).toBeCloseTo(1325.25, 6)
  })

  it('runs the male equation', () => {
    // (10 * 82) + (6.25 * 180) - (5 * 50) + 5 = 820 + 1125 - 250 + 5
    expect(basalEnergy('male', 82, 180, 50)).toBeCloseTo(1700, 6)
  })

  it('separates the two equations by exactly 166 kcal', () => {
    expect(basalEnergy('male', 70, 170, 40) - basalEnergy('female', 70, 170, 40)).toBeCloseTo(
      166,
      6,
    )
  })
})

describe('equationFor', () => {
  it('maps prefer-not-to-say to the female equation', () => {
    expect(equationFor('prefer-not-to-say')).toBe('female')
    expect(equationFor('female')).toBe('female')
    expect(equationFor('male')).toBe('male')
  })
})

describe('clamp', () => {
  it('holds the bounds', () => {
    expect(clamp(10, 30, 50)).toBe(30)
    expect(clamp(70, 30, 50)).toBe(50)
    expect(clamp(41, 30, 50)).toBe(41)
  })
})

describe('calculateFatTarget, the full worked example', () => {
  it('walks female / 165cm / 68kg / age 45 / light / stable step by step', () => {
    const result = calculateFatTarget('stable', {
      age: 45,
      heightCm: 165,
      weightKg: 68,
      activityLevel: 'light',
      biologicalSex: 'female',
    })

    // Step 1
    expect(result.bmr).toBeCloseTo(1325.25, 6)
    // Step 2: 1325.25 * 1.375
    expect(result.activityFactor).toBe(1.375)
    expect(result.tdee).toBeCloseTo(1822.21875, 6)
    // Step 3: (1822.21875 * 0.25) / 9
    expect(result.fatPercent).toBe(0.25)
    expect(result.rawFatGrams).toBeCloseTo(50.6171875, 6)
    // Step 4: clamp into [30, 50]
    expect(result.band).toEqual({ min: 30, max: 50 })
    expect(result.wasClamped).toBe(true)
    // Step 5
    expect(result.grams).toBe(50)
  })

  it('gives prefer-not-to-say the same answer as female', () => {
    const input = {
      age: 45,
      heightCm: 165,
      weightKg: 68,
      activityLevel: 'light',
    } as const
    const unspecified = calculateFatTarget('stable', {
      ...input,
      biologicalSex: 'prefer-not-to-say',
    })
    const female = calculateFatTarget('stable', { ...input, biologicalSex: 'female' })
    expect(unspecified).toEqual(female)
  })

  it('clamps a low BMR up to the bottom of the stable band', () => {
    // Small, older, resting: raw fat grams land well under 30.
    const result = calculateFatTarget('stable', {
      age: 78,
      heightCm: 150,
      weightKg: 45,
      activityLevel: 'resting',
      biologicalSex: 'female',
    })
    expect(result.rawFatGrams).toBeLessThan(30)
    expect(result.wasClamped).toBe(true)
    expect(result.grams).toBe(30)
  })

  it('clamps a high TDEE down to the top of the stable band', () => {
    const result = calculateFatTarget('stable', {
      age: 30,
      heightCm: 190,
      weightKg: 100,
      activityLevel: 'moderate',
      biologicalSex: 'male',
    })
    expect(result.rawFatGrams).toBeGreaterThan(50)
    expect(result.wasClamped).toBe(true)
    expect(result.grams).toBe(50)
  })

  it('uses the 0.20 fat percent and the [20, 30] band in recovering', () => {
    const result = calculateFatTarget('recovering', {
      age: 45,
      heightCm: 165,
      weightKg: 68,
      activityLevel: 'light',
      biologicalSex: 'female',
    })
    expect(result.fatPercent).toBe(0.2)
    expect(result.band).toEqual({ min: 20, max: 30 })
    // (1822.21875 * 0.20) / 9 = 40.49..., clamped down to 30
    expect(result.rawFatGrams).toBeCloseTo(40.4937, 3)
    expect(result.grams).toBe(30)
    expect(result.grams).toBeGreaterThanOrEqual(20)
    expect(result.grams).toBeLessThanOrEqual(30)
  })

  it('lands inside the band without clamping when the arithmetic already fits', () => {
    // Chosen so recovering raw grams fall between 20 and 30.
    const result = calculateFatTarget('recovering', {
      age: 60,
      heightCm: 155,
      weightKg: 50,
      activityLevel: 'resting',
      biologicalSex: 'female',
    })
    expect(result.rawFatGrams).toBeGreaterThan(20)
    expect(result.rawFatGrams).toBeLessThan(30)
    expect(result.wasClamped).toBe(false)
    expect(result.grams).toBe(Math.round(result.rawFatGrams))
  })

  it('clamps before rounding, not after', () => {
    // A raw value above the ceiling must come back as exactly the ceiling.
    const result = calculateFatTarget('stable', {
      age: 25,
      heightCm: 200,
      weightKg: 120,
      activityLevel: 'moderate',
      biologicalSex: 'male',
    })
    expect(result.grams).toBe(50)
    expect(Number.isInteger(result.grams)).toBe(true)
  })
})

describe('computeFatTarget precedence', () => {
  const complete: Partial<Settings> = {
    age: 45,
    heightCm: 165,
    weightKg: 68,
    activityLevel: 'light',
    biologicalSex: 'female',
  }

  it('returns the fixed ceiling in flare and does no calculation', () => {
    const result = computeFatTarget(settingsWith({ ...complete, currentMode: 'flare' }))
    expect(result.source).toBe('flare-ceiling')
    expect(result.grams).toBe(FLARE_CEILING_GRAMS)
    expect(result.grams).toBe(15)
    expect(result.breakdown).toBeNull()
  })

  it('ignores a care team override in flare', () => {
    // An override is a normal-eating daily target. Surfacing 45g during a flare
    // would be wrong in the dangerous direction.
    const result = computeFatTarget(
      settingsWith({ ...complete, currentMode: 'flare', dailyFatTarget: 45 }),
    )
    expect(result.source).toBe('flare-ceiling')
    expect(result.grams).toBe(15)
  })

  it('lets a care team override beat a valid calculation', () => {
    const result = computeFatTarget(
      settingsWith({ ...complete, currentMode: 'stable', dailyFatTarget: 42 }),
    )
    expect(result.source).toBe('override')
    expect(result.grams).toBe(42)
  })

  it('still carries the breakdown under an override so the panel can show it', () => {
    const result = computeFatTarget(
      settingsWith({ ...complete, currentMode: 'stable', dailyFatTarget: 42 }),
    )
    expect(result.breakdown).not.toBeNull()
    expect(result.breakdown?.grams).toBe(50)
  })

  it('honours an override that sits outside the published band', () => {
    // Her dietitian's number is authoritative even at 25g in stable mode.
    const result = computeFatTarget(
      settingsWith({ ...complete, currentMode: 'stable', dailyFatTarget: 25 }),
    )
    expect(result.source).toBe('override')
    expect(result.grams).toBe(25)
  })

  it('calculates when there is no override', () => {
    const result = computeFatTarget(settingsWith({ ...complete, currentMode: 'stable' }))
    expect(result.source).toBe('calculated')
    expect(result.grams).toBe(50)
    expect(result.breakdown).not.toBeNull()
  })

  it('reports exactly which inputs are missing', () => {
    const result = computeFatTarget(settingsWith({ currentMode: 'stable' }))
    expect(result.source).toBe('incomplete')
    expect(result.grams).toBeNull()
    expect(result.missing).toEqual(['age', 'heightCm', 'weightKg'])
  })

  it('reports a single missing input', () => {
    const result = computeFatTarget(
      settingsWith({ ...complete, weightKg: null, currentMode: 'stable' }),
    )
    expect(result.source).toBe('incomplete')
    expect(result.missing).toEqual(['weightKg'])
  })

  it('treats zero, negative, and NaN inputs as missing rather than calculating', () => {
    const result = computeFatTarget(
      settingsWith({ ...complete, weightKg: 0, heightCm: -5, age: Number.NaN }),
    )
    expect(result.source).toBe('incomplete')
    expect(result.missing).toEqual(['age', 'heightCm', 'weightKg'])
  })

  it('falls back to the calculation when the override is not a usable number', () => {
    const result = computeFatTarget(settingsWith({ ...complete, dailyFatTarget: 0 }))
    expect(result.source).toBe('calculated')
  })

  it('defaults an incomplete profile to an incomplete result, never to a guess', () => {
    const result = computeFatTarget(DEFAULT_SETTINGS)
    expect(result.grams).toBeNull()
  })
})

/**
 * provisionalFatTarget is a number she typed in herself so the app could rate
 * anything at all. dailyFatTarget is a number from her care team. The whole
 * point of keeping them in separate fields is that the provenance survives, so
 * these tests pin the ladder rather than just the arithmetic.
 */
describe('computeFatTarget and the provisional starting number', () => {
  const complete: Partial<Settings> = {
    age: 45,
    heightCm: 165,
    weightKg: 68,
    activityLevel: 'light',
    biologicalSex: 'female',
  }

  it('lets a care team override beat a provisional number', () => {
    const result = computeFatTarget(
      settingsWith({ currentMode: 'stable', dailyFatTarget: 42, provisionalFatTarget: 20 }),
    )
    expect(result.source).toBe('override')
    expect(result.grams).toBe(42)
  })

  it('lets a complete calculation beat a provisional number', () => {
    // Once her real stats are in, the estimate is better grounded than a number
    // she typed in to get the traffic light working.
    const result = computeFatTarget(
      settingsWith({ ...complete, currentMode: 'stable', provisionalFatTarget: 20 }),
    )
    expect(result.source).toBe('calculated')
    expect(result.grams).toBe(50)
  })

  it('uses the provisional number only when nothing else is available', () => {
    const result = computeFatTarget(
      settingsWith({ currentMode: 'stable', provisionalFatTarget: 35 }),
    )
    expect(result.source).toBe('provisional')
    expect(result.grams).toBe(35)
    expect(result.breakdown).toBeNull()
    // The inputs really are still absent, so a settings screen can offer to
    // upgrade this to a real estimate.
    expect(result.missing).toEqual(['age', 'heightCm', 'weightKg'])
  })

  it('ignores a provisional number in flare, exactly as it ignores an override', () => {
    const result = computeFatTarget(
      settingsWith({ currentMode: 'flare', provisionalFatTarget: 40 }),
    )
    expect(result.source).toBe('flare-ceiling')
    expect(result.grams).toBe(FLARE_CEILING_GRAMS)
  })

  it('stays incomplete when the provisional number is not a usable one', () => {
    expect(
      computeFatTarget(settingsWith({ currentMode: 'stable', provisionalFatTarget: 0 })).source,
    ).toBe('incomplete')
    expect(
      computeFatTarget(settingsWith({ currentMode: 'stable', provisionalFatTarget: -5 })).source,
    ).toBe('incomplete')
  })
})

describe('bodyStatsAreStale', () => {
  const now = Date.parse('2026-08-03T12:00:00.000Z')

  it('is never stale when nothing has been entered yet', () => {
    expect(bodyStatsAreStale(null, now)).toBe(false)
  })

  it('is not stale inside 90 days', () => {
    const recent = new Date(now - BODY_STATS_STALE_MS + 1000).toISOString()
    expect(bodyStatsAreStale(recent, now)).toBe(false)
  })

  it('is stale past 90 days', () => {
    const old = new Date(now - BODY_STATS_STALE_MS - 1000).toISOString()
    expect(bodyStatsAreStale(old, now)).toBe(true)
  })

  it('treats an unparseable timestamp as not stale rather than nagging', () => {
    expect(bodyStatsAreStale('not a date', now)).toBe(false)
  })
})
