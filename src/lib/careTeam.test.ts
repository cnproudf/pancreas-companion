import { describe, expect, it } from 'vitest'
import {
  addContact,
  contactLabel,
  contactsFrom,
  hydrateContacts,
  isEmptyDraft,
  removeContact,
  ROLE_LABELS,
  updateContact,
  type CareTeamDraft,
} from './careTeam.ts'
import { DEFAULT_SETTINGS } from '../state/settingsModel.ts'
import type { CareTeamContact } from '../types.ts'
import { DASH_PATTERN } from '../test/copyInvariants.ts'

function contact(patch: Partial<CareTeamContact> = {}): CareTeamContact {
  return {
    id: 'c1',
    role: 'doctor',
    name: 'Dr. Whitmore',
    phone: '(555) 555-0134',
    notes: '',
    ...patch,
  }
}

function draft(patch: Partial<CareTeamDraft> = {}): CareTeamDraft {
  return { role: 'doctor', name: 'Dr. Whitmore', phone: '5555550134', notes: '', ...patch }
}

describe('hydrateContacts', () => {
  it('returns an empty list for anything that is not an array', () => {
    expect(hydrateContacts(null)).toEqual([])
    expect(hydrateContacts(undefined)).toEqual([])
    expect(hydrateContacts({})).toEqual([])
    expect(hydrateContacts('nope')).toEqual([])
  })

  it('degrades one row at a time rather than blanking the list', () => {
    const kept = hydrateContacts([contact(), null, { id: 'c2' }, contact({ id: 'c3' })])
    expect(kept.map((c) => c.id)).toEqual(['c1', 'c3'])
  })

  it('collapses duplicate ids', () => {
    expect(hydrateContacts([contact(), contact()])).toHaveLength(1)
  })

  it('falls back to the other role rather than dropping the number', () => {
    const [only] = hydrateContacts([contact({ role: 'surgeon' as never })])
    expect(only?.role).toBe('other')
    expect(only?.phone).toBe('(555) 555-0134')
  })

  /*
   * A contact with no name is dialable and a contact with no number may still
   * say where to find it. Only a row with nothing at all in it is dropped.
   * Losing a phone number here would be the worst thing this module could do.
   */
  it('keeps a contact carrying only one useful field', () => {
    expect(hydrateContacts([{ id: 'a', phone: '5555550134' }])).toHaveLength(1)
    expect(hydrateContacts([{ id: 'b', name: 'The answering service' }])).toHaveLength(1)
    expect(hydrateContacts([{ id: 'c', notes: 'card in my wallet' }])).toHaveLength(1)
    expect(hydrateContacts([{ id: 'd', name: '', phone: '', notes: '' }])).toHaveLength(0)
  })
})

describe('contactsFrom', () => {
  it('reads an empty list off default settings', () => {
    expect(contactsFrom(DEFAULT_SETTINGS)).toEqual([])
  })

  it('cleans what hydrateSettings let through', () => {
    const settings = { ...DEFAULT_SETTINGS, careTeamContacts: [contact(), 7 as never] }
    expect(contactsFrom(settings)).toHaveLength(1)
  })
})

describe('addContact', () => {
  it('appends rather than sorting, so her order is her order', () => {
    const list = addContact(addContact([], draft({ name: 'First' })), draft({ name: 'Second' }))
    expect(list.map((c) => c.name)).toEqual(['First', 'Second'])
  })

  it('trims the fields she typed', () => {
    const [only] = addContact([], draft({ name: '  Dr. Whitmore  ', phone: '  5555550134 ' }))
    expect(only?.name).toBe('Dr. Whitmore')
    expect(only?.phone).toBe('5555550134')
  })

  it('gives every contact a distinct id', () => {
    const list = addContact(addContact([], draft()), draft())
    expect(new Set(list.map((c) => c.id)).size).toBe(2)
  })
})

describe('updateContact', () => {
  it('replaces one row and leaves the rest alone', () => {
    const list = [contact(), contact({ id: 'c2', name: 'Piedmont GI' })]
    const next = updateContact(list, 'c2', draft({ name: 'Piedmont GI, after hours' }))
    expect(next[0]?.name).toBe('Dr. Whitmore')
    expect(next[1]?.name).toBe('Piedmont GI, after hours')
  })

  it('is a no-op for an unknown id', () => {
    const list = [contact()]
    expect(updateContact(list, 'nope', draft({ name: 'X' }))).toEqual(list)
  })
})

describe('removeContact', () => {
  it('removes exactly one row', () => {
    const list = [contact(), contact({ id: 'c2' })]
    expect(removeContact(list, 'c1').map((c) => c.id)).toEqual(['c2'])
  })

  it('is a no-op for an unknown id', () => {
    const list = [contact()]
    expect(removeContact(list, 'nope')).toEqual(list)
  })
})

describe('isEmptyDraft', () => {
  /* A name alone is a valid contact, and so is a number alone. */
  it('accepts a draft with any one field filled', () => {
    expect(isEmptyDraft(draft({ name: 'The answering service', phone: '', notes: '' }))).toBe(false)
    expect(isEmptyDraft(draft({ name: '', phone: '5555550134', notes: '' }))).toBe(false)
    expect(isEmptyDraft(draft({ name: '', phone: '', notes: 'card in my wallet' }))).toBe(false)
  })

  it('refuses only a completely empty one', () => {
    expect(isEmptyDraft(draft({ name: '  ', phone: '', notes: ' ' }))).toBe(true)
  })
})

describe('contactLabel', () => {
  it('uses her name for it', () => {
    expect(contactLabel(contact())).toBe('Dr. Whitmore')
  })

  it('falls back to the role rather than showing a blank button', () => {
    expect(contactLabel(contact({ name: '   ', role: 'hospital' }))).toBe('Hospital or clinic')
  })
})

describe('ROLE_LABELS', () => {
  it('carries no em or en dashes', () => {
    for (const label of Object.values(ROLE_LABELS)) expect(label).not.toMatch(DASH_PATTERN)
  })
})
