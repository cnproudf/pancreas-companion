import { useId, useState } from 'react'
import {
  addContact,
  CARE_TEAM_ROLES,
  contactLabel,
  contactsFrom,
  EMPTY_DRAFT,
  isEmptyDraft,
  removeContact,
  ROLE_LABELS,
  updateContact,
  type CareTeamDraft,
  type CareTeamRole,
} from '../../lib/careTeam.ts'
import { TRIAGE_COPY } from '../../lib/triage.ts'
import { useSettings } from '../../state/settings.tsx'

/**
 * Adding and editing her care team numbers.
 *
 * Rendered in two places, and both of them dial: the When To Call card, and the
 * urgent triage panel. See the header note in lib/careTeam.ts for why there is
 * no settings screen involved. The short version is that the moment a missing
 * number costs her something is the middle of a flare, and the settings screen
 * is behind the flare gate.
 *
 * NO FOOD CONTENT HERE, WHICH IS WHY IT MAY RENDER ABOVE THE GATE. Names,
 * numbers, and notes about a practice. If this ever grows a field that names a
 * food or a gram value, it moves or it grows a guard.
 */
export function CareTeamEditor({ compact = false }: { compact?: boolean }) {
  const { settings, update } = useSettings()
  const contacts = contactsFrom(settings)

  /** The id being edited, 'new' while adding, or null when the form is closed. */
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<CareTeamDraft>(EMPTY_DRAFT)
  const formId = useId()

  function openAdd() {
    setDraft(EMPTY_DRAFT)
    setEditing('new')
  }

  function openEdit(id: string) {
    const found = contacts.find((contact) => contact.id === id)
    if (found === undefined) return
    setDraft({
      role: found.role,
      name: found.name,
      phone: found.phone,
      notes: found.notes,
    })
    setEditing(id)
  }

  function save() {
    /*
     * The only thing this form refuses is a completely empty draft. A name with
     * no number is a valid contact ("the answering service"), and so is a
     * number with no name. Validating harder would be the app deciding it knows
     * her care team better than she does.
     */
    if (isEmptyDraft(draft)) {
      setEditing(null)
      return
    }

    update({
      careTeamContacts:
        editing === 'new' || editing === null
          ? addContact(contacts, draft)
          : updateContact(contacts, editing, draft),
    })
    setEditing(null)
  }

  function remove(id: string) {
    const found = contacts.find((contact) => contact.id === id)
    if (found === undefined) return
    /*
     * Confirmed, because this is a phone number she may not have written down
     * anywhere else, and there is no undo on this screen.
     */
    if (!globalThis.confirm(TRIAGE_COPY.contactsRemoveConfirm)) return
    update({ careTeamContacts: removeContact(contacts, id) })
    if (editing === id) setEditing(null)
  }

  return (
    <div>
      {contacts.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {contacts.map((contact) => (
            <li key={contact.id} className="flex items-center justify-between gap-2">
              <span className="text-ink">
                {contactLabel(contact)}
                {contact.phone.trim() === '' ? '' : ` ${contact.phone}`}
              </span>
              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => openEdit(contact.id)}
                  className="rounded-lg px-2 py-1 text-creek underline underline-offset-4 hover:text-ridge-deep"
                >
                  {TRIAGE_COPY.contactsEdit}
                </button>
                <button
                  type="button"
                  onClick={() => remove(contact.id)}
                  className="rounded-lg px-2 py-1 text-creek underline underline-offset-4 hover:text-ridge-deep"
                >
                  {TRIAGE_COPY.contactsRemove}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {editing === null ? (
        <button
          type="button"
          onClick={openAdd}
          className={`rounded-lg border-2 border-creek bg-paper px-4 py-2 font-semibold text-creek hover:bg-creek hover:text-paper ${
            contacts.length > 0 ? 'mt-3' : ''
          }`}
        >
          {TRIAGE_COPY.contactsAdd}
        </button>
      ) : (
        <div className="mt-3 flex flex-col gap-3 rounded-lg border border-stone bg-white/50 p-4">
          <div>
            <label htmlFor={`${formId}-name`} className="font-semibold text-ridge-deep">
              {TRIAGE_COPY.contactsName}
            </label>
            <input
              id={`${formId}-name`}
              type="text"
              value={draft.name}
              onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
              className="mt-1 min-h-11 w-full rounded-lg border-2 border-stone bg-paper px-4 py-2 text-ink focus:border-creek"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-phone`} className="font-semibold text-ridge-deep">
              {TRIAGE_COPY.contactsPhone}
            </label>
            {/*
              type="tel" rather than "text", so a phone keypad comes up instead
              of a full keyboard. She may be typing this one handed.
            */}
            <input
              id={`${formId}-phone`}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={draft.phone}
              onChange={(event) => setDraft((d) => ({ ...d, phone: event.target.value }))}
              className="numeral mt-1 min-h-11 w-full rounded-lg border-2 border-stone bg-paper px-4 py-2 text-ink focus:border-creek"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-role`} className="font-semibold text-ridge-deep">
              {TRIAGE_COPY.contactsRole}
            </label>
            <select
              id={`${formId}-role`}
              value={draft.role}
              onChange={(event) =>
                setDraft((d) => ({ ...d, role: event.target.value as CareTeamRole }))
              }
              className="mt-1 min-h-11 w-full rounded-lg border-2 border-stone bg-paper px-4 py-2 text-ink focus:border-creek"
            >
              {CARE_TEAM_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>

          {!compact && (
            <div>
              <label htmlFor={`${formId}-notes`} className="font-semibold text-ridge-deep">
                {TRIAGE_COPY.contactsNotes}
              </label>
              <input
                id={`${formId}-notes`}
                type="text"
                value={draft.notes}
                onChange={(event) => setDraft((d) => ({ ...d, notes: event.target.value }))}
                className="mt-1 min-h-11 w-full rounded-lg border-2 border-stone bg-paper px-4 py-2 text-ink focus:border-creek"
              />
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <button
              type="button"
              onClick={save}
              className="flex-1 rounded-lg border-2 border-ridge-deep bg-ridge-deep px-4 py-3 font-semibold text-paper hover:border-ridge-mid hover:bg-ridge-mid"
            >
              {TRIAGE_COPY.contactsSave}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="flex-1 rounded-lg border-2 border-stone bg-paper px-4 py-3 text-ink hover:border-creek"
            >
              {TRIAGE_COPY.contactsCancel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
