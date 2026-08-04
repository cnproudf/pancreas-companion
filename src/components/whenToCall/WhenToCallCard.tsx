import { useEffect, useId, useRef } from 'react'
import { contactsFrom } from '../../lib/careTeam.ts'
import { RED_FLAGS, TRIAGE_COPY } from '../../lib/triage.ts'
import { useSettings } from '../../state/settings.tsx'
import { CareTeamEditor } from './CareTeamEditor.tsx'
import { DialButton } from './DialButton.tsx'

/**
 * When To Call. Spec section 5.10.
 *
 * "A red-outlined card reachable from a persistent icon in the header. Lists
 * the red-flag symptoms from section 4, holds her care team's phone numbers
 * (entered in settings), and states plainly that severe or worsening pain
 * warrants immediate care. No cleverness on this screen. Big text, clear
 * numbers, tap to dial."
 *
 * NO RIDGELINE, AND ADDENDUM SECTION C BARS IT FROM THIS CARD BY NAME.
 * "Decoration on a screen someone reads while unwell is a cost, not a feature."
 * No illustration, no icon set, no motif, no warmth for its own sake. Clay
 * border, big type, and phone numbers.
 *
 * THE RED FLAGS COME FROM THE SAME CONSTANT THE TRIAGE GATE READS. Two copies
 * of this list would drift, and the drift would be silent: the card she reaches
 * from the header would stop matching the screen that gates her flare, and
 * nobody would notice until it mattered. See RED_FLAGS in lib/triage.ts.
 *
 * A native <dialog> with showModal, the same as SymptomSheet: focus trapping,
 * Escape to close, inert background, and the top layer, without a dependency or
 * a hand rolled focus trap. It renders ABOVE FlareGate and carries no food
 * content, so it is reachable at every triage stage including the urgent panel.
 */
export function WhenToCallCard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const { settings } = useSettings()
  const contacts = contactsFrom(settings)

  useEffect(() => {
    const node = dialog.current
    if (node === null) return

    if (open && !node.open) node.showModal()
    if (!open && node.open) node.close()
  }, [open])

  useEffect(() => {
    const node = dialog.current
    if (node === null) return

    // Fires for Escape as well as for close(), so the parent's state cannot
    // drift out of sync with what is actually on screen.
    const handleClose = () => onClose()
    node.addEventListener('close', handleClose)
    return () => node.removeEventListener('close', handleClose)
  }, [onClose])

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      data-testid="when-to-call"
      className="m-auto w-[min(34rem,92vw)] rounded-xl border-4 border-clay bg-paper p-0 text-ink backdrop:bg-ridge-deep/50"
    >
      <div className="max-h-[85vh] overflow-y-auto px-5 py-5">
        <h2 id={titleId} className="mt-0 mb-3 text-2xl text-clay">
          {TRIAGE_COPY.whenToCallTitle}
        </h2>

        <p className="mt-0 mb-3 text-lg text-ink">{TRIAGE_COPY.whenToCallIntro}</p>

        <ul className="m-0 mb-4 flex list-none flex-col gap-3 p-0">
          {RED_FLAGS.map((flag) => (
            <li
              key={flag}
              className="border-l-4 border-clay py-1 pl-4 text-lg leading-snug text-ink"
            >
              {flag}
            </li>
          ))}
        </ul>

        <p className="mt-0 mb-5 text-lg leading-snug font-semibold text-ink">
          {TRIAGE_COPY.whenToCallUrgency}
        </p>

        {contacts.length > 0 ? (
          <div className="flex flex-col gap-3">
            {contacts.map((contact) => (
              <DialButton key={contact.id} contact={contact} />
            ))}
          </div>
        ) : (
          <p className="mt-0 mb-0 text-ink">{TRIAGE_COPY.whenToCallNoContacts}</p>
        )}

        {/*
          Editing lives with the numbers rather than in a settings screen. See
          the header note in lib/careTeam.ts: the screen where a missing number
          costs her something is a flare, and a settings screen showing her fat
          target is behind the flare gate.
        */}
        <div className="mt-5 border-t border-stone pt-4">
          <h3 className="mt-0 mb-2 text-lg">{TRIAGE_COPY.contactsTitle}</h3>
          <CareTeamEditor />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-lg border-2 border-stone bg-paper px-4 py-3 text-ink hover:border-creek"
        >
          {TRIAGE_COPY.whenToCallClose}
        </button>
      </div>
    </dialog>
  )
}
