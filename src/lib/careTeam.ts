/**
 * Her care team's phone numbers. Spec section 4 and 5.10.
 *
 * These are the numbers the triage panel dials and the When To Call card lists.
 * They live in Settings.careTeamContacts, which has existed since Phase 1 and
 * had no way to write to it until now.
 *
 * THEY ARE EDITED WHERE THEY ARE USED, NOT IN A SETTINGS SCREEN.
 *
 * That is a decision rather than an accident of build order. The screen where a
 * missing number hurts most is the urgent triage panel, which is reached during
 * a flare, and the settings screen is (and has to be) inside FlareGate because
 * it shows her daily fat target. A number she cannot add at the moment she
 * needs it is not much better than no number, so the editor lives in the two
 * places that dial: the urgent panel and the When To Call card.
 *
 * Pure module. No React, no storage; the settings store owns persistence, the
 * same way patterns.ts owns no storage and reads a log it is handed.
 */

import { newId } from './ids.ts'
import type { CareTeamContact, Settings } from '../types.ts'
import { isNonEmptyString, isRecord } from './validate.ts'

export const CARE_TEAM_ROLES = ['doctor', 'dietitian', 'hospital', 'other'] as const

export type CareTeamRole = (typeof CARE_TEAM_ROLES)[number]

/**
 * Display names for the roles. Kept here rather than in the component so the
 * copy suite can see them.
 *
 * "Hospital or clinic" rather than "Hospital", because the after hours line she
 * is most likely to save is a practice's, not a hospital's.
 */
export const ROLE_LABELS: Record<CareTeamRole, string> = {
  doctor: 'Doctor',
  dietitian: 'Dietitian',
  hospital: 'Hospital or clinic',
  other: 'Other',
}

/** What the add and edit form hands over. */
export interface CareTeamDraft {
  role: CareTeamRole
  name: string
  phone: string
  notes: string
}

export const EMPTY_DRAFT: CareTeamDraft = {
  role: 'doctor',
  name: '',
  phone: '',
  notes: '',
}

function hydrateContact(raw: unknown): CareTeamContact | null {
  if (!isRecord(raw)) return null
  if (!isNonEmptyString(raw.id)) return null

  /*
   * A contact with no name is still dialable, and a contact with no number is
   * still worth showing (it may carry a note saying where to find it). Only the
   * id is structural. Dropping a row here would lose a phone number, which on
   * this screen is the worst thing this module could do.
   */
  const name = typeof raw.name === 'string' ? raw.name : ''
  const phone = typeof raw.phone === 'string' ? raw.phone : ''
  const notes = typeof raw.notes === 'string' ? raw.notes : ''

  const role: CareTeamRole =
    typeof raw.role === 'string' && (CARE_TEAM_ROLES as readonly string[]).includes(raw.role)
      ? (raw.role as CareTeamRole)
      : 'other'

  if (name === '' && phone === '' && notes === '') return null

  return { id: raw.id, role, name, phone, notes }
}

/**
 * Whatever came out of settings, as a usable list.
 *
 * hydrateSettings merges arrays without inspecting their contents, so this is
 * where a damaged blob is actually caught. Degrades one row at a time, the same
 * way hydrateLog and hydrateVersions do.
 */
export function hydrateContacts(raw: unknown): CareTeamContact[] {
  if (!Array.isArray(raw)) return []

  const seen = new Set<string>()
  const contacts: CareTeamContact[] = []

  for (const candidate of raw) {
    const contact = hydrateContact(candidate)
    if (contact === null) continue
    if (seen.has(contact.id)) continue
    seen.add(contact.id)
    contacts.push(contact)
  }

  return contacts
}

/** Her contacts, from settings, cleaned. The one read path. */
export function contactsFrom(settings: Settings): CareTeamContact[] {
  return hydrateContacts(settings.careTeamContacts)
}

/**
 * Pure. Appends, so the order is the order she added them.
 *
 * NOT sorted by role, and not with the doctor forced to the top. She knows
 * which number she wants, and reordering her list under her on a screen she
 * reads while unwell would cost more than any sort could give back.
 */
export function addContact(
  contacts: readonly CareTeamContact[],
  draft: CareTeamDraft,
  when: Date = new Date(),
): CareTeamContact[] {
  return [
    ...contacts,
    {
      id: newId(when),
      role: draft.role,
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      notes: draft.notes.trim(),
    },
  ]
}

/** Pure. Unknown id is a no-op rather than an error. */
export function updateContact(
  contacts: readonly CareTeamContact[],
  id: string,
  draft: CareTeamDraft,
): CareTeamContact[] {
  return contacts.map((contact) =>
    contact.id === id
      ? {
          ...contact,
          role: draft.role,
          name: draft.name.trim(),
          phone: draft.phone.trim(),
          notes: draft.notes.trim(),
        }
      : contact,
  )
}

/** Pure. Removes exactly one row, by id. Unknown id is a no-op. */
export function removeContact(
  contacts: readonly CareTeamContact[],
  id: string,
): CareTeamContact[] {
  return contacts.filter((contact) => contact.id !== id)
}

/**
 * True when a draft has nothing worth saving.
 *
 * Deliberately permissive: a name alone is a valid contact ("the answering
 * service, ask for the on call GI"), and so is a number alone. The form only
 * refuses to save something completely empty.
 */
export function isEmptyDraft(draft: CareTeamDraft): boolean {
  return draft.name.trim() === '' && draft.phone.trim() === '' && draft.notes.trim() === ''
}

/** What the dial button says. Falls back to the role when she left the name blank. */
export function contactLabel(contact: CareTeamContact): string {
  if (contact.name.trim() !== '') return contact.name.trim()
  return ROLE_LABELS[contact.role]
}
