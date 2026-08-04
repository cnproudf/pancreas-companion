import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, hydrateSettings } from './settingsModel.ts'

/**
 * A damaged blob in localStorage should cost her one field, not the whole app.
 */

describe('hydrateSettings', () => {
  it('returns defaults for null, a primitive, and an array', () => {
    expect(hydrateSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(hydrateSettings('nonsense')).toEqual(DEFAULT_SETTINGS)
    expect(hydrateSettings(42)).toEqual(DEFAULT_SETTINGS)
    expect(hydrateSettings([1, 2, 3])).toEqual(DEFAULT_SETTINGS)
  })

  it('fills gaps in a partial object from the defaults', () => {
    const result = hydrateSettings({ currentMode: 'recovering', weightKg: 68 })
    expect(result.currentMode).toBe('recovering')
    expect(result.weightKg).toBe(68)
    expect(result.activityLevel).toBe(DEFAULT_SETTINGS.activityLevel)
    expect(result.careTeamContacts).toEqual([])
  })

  it('drops fields of the wrong type without touching the rest', () => {
    const result = hydrateSettings({
      currentMode: 'flare',
      weightKg: 'heavy',
      takesEnzymes: 'yes',
      careTeamContacts: 'nope',
    })
    expect(result.currentMode).toBe('flare')
    expect(result.weightKg).toBeNull()
    expect(result.takesEnzymes).toBe(false)
    expect(result.careTeamContacts).toEqual([])
  })

  it('rejects a non finite number for a nullable numeric field', () => {
    const result = hydrateSettings({ age: Number.NaN, heightCm: Number.POSITIVE_INFINITY })
    expect(result.age).toBeNull()
    expect(result.heightCm).toBeNull()
  })

  it('keeps null where null is a legitimate value', () => {
    const result = hydrateSettings({ dailyFatTarget: null, age: null })
    expect(result.dailyFatTarget).toBeNull()
    expect(result.age).toBeNull()
  })

  it('does not let a stored null blank a field that has a real default', () => {
    const result = hydrateSettings({ activityLevel: null, currentMode: null })
    expect(result.activityLevel).toBe('light')
    expect(result.currentMode).toBe('stable')
  })

  it('ignores unknown keys from an older or newer shape', () => {
    const result = hydrateSettings({ currentMode: 'stable', somethingRemoved: true })
    expect(result).toEqual({ ...DEFAULT_SETTINGS, currentMode: 'stable' })
  })

  it('always reports the current schema version', () => {
    expect(hydrateSettings({ schemaVersion: 99 }).schemaVersion).toBe(1)
  })

  it('does not mutate DEFAULT_SETTINGS', () => {
    const result = hydrateSettings({ careTeamContacts: [{ id: 'a' }] })
    expect(result.careTeamContacts).toHaveLength(1)
    expect(DEFAULT_SETTINGS.careTeamContacts).toEqual([])
  })
})
