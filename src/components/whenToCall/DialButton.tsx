import { contactLabel, ROLE_LABELS } from '../../lib/careTeam.ts'
import { telHref } from '../../lib/triage.ts'
import type { CareTeamContact } from '../../types.ts'

/**
 * One care team number, as a tap to dial target. Spec 5.10: "Big text, clear
 * numbers, tap to dial."
 *
 * An anchor rather than a button, deliberately. A tel: anchor is what the
 * platform knows how to hand to the dialer, and it also gives her the long
 * press menu with copy and add-to-contacts for free. A button with an onClick
 * that sets location.href would look the same and do less.
 *
 * WHEN THE NUMBER IS NOT DIALABLE THIS RENDERS PLAIN TEXT, NOT A DEAD LINK.
 *
 * telHref returns null when there is nothing to dial, which happens when she
 * saved a contact with only a name and a note ("ask the front desk for the on
 * call GI"). A control that looks tappable and does nothing is worse here than
 * on any other screen in the app, because the moment she taps it is the moment
 * she has decided to call.
 */
export function DialButton({ contact }: { contact: CareTeamContact }) {
  const href = telHref(contact.phone)
  const label = contactLabel(contact)
  const role = ROLE_LABELS[contact.role]

  const body = (
    <>
      <span className="block text-lg leading-tight font-semibold">{label}</span>
      {contact.phone.trim() !== '' && (
        <span className="numeral mt-0.5 block text-xl leading-tight">{contact.phone}</span>
      )}
      <span className="mt-0.5 block text-sm">
        {role}
        {contact.notes.trim() === '' ? '' : `. ${contact.notes.trim()}`}
      </span>
    </>
  )

  if (href === null) {
    return (
      <div className="rounded-lg border-2 border-stone bg-paper px-4 py-3 text-ink">{body}</div>
    )
  }

  return (
    <a
      href={href}
      /*
        aria-label rather than letting a screen reader read the three lines as
        one run-on string. "Call Dr. Whitmore" is what the control does.
      */
      aria-label={`Call ${label}`}
      className="block rounded-lg border-2 border-clay bg-paper px-4 py-3 text-clay no-underline hover:bg-clay hover:text-paper"
    >
      {body}
    </a>
  )
}
