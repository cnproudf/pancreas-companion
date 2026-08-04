import { contactsFrom } from '../../lib/careTeam.ts'
import { TRIAGE_COPY } from '../../lib/triage.ts'
import { useSettings } from '../../state/settings.tsx'
import { useTriage } from '../../state/triage.tsx'
import { CareTeamEditor } from '../whenToCall/CareTeamEditor.tsx'
import { DialButton } from '../whenToCall/DialButton.tsx'

/**
 * She reported one or more red flags. Spec section 4: "full-screen, unmissable
 * panel."
 *
 * "Full screen" here means it is the entire main content and nothing competes
 * with it. The app shell around it stays (the Daily Lift, the mode selector,
 * the disclaimer footer), and that is the right reading rather than a
 * compromise: taking the mode selector away would trap her on a screen she
 * cannot leave, which is the app overriding her rather than helping her.
 *
 * NO FOOD CONTENT. Section 4: "Do not show food recommendations on this
 * screen." Nothing here names a food or a gram value, and FlareGate renders
 * this INSTEAD of its children, so nothing downstream can either.
 *
 * THE ORDER OF THE LINES IS LOAD BEARING.
 *
 *   action      what to do
 *   permission  the sentence that gets her to actually do it
 *   [buttons]   how to do it
 *   emergency   the 911 line, AFTER the buttons so it reads as escalation
 *   unreachable the fallback when nobody picks up
 *   [fold]
 *   continue    her assertion that she has already called
 *
 * Moving the 911 line above the buttons would turn it from an escalation into
 * the default suggestion, which is a different and worse screen. See the note
 * on TRIAGE_COPY in lib/triage.ts, which also records the one line spec section
 * 4 asks for that is deliberately NOT here.
 */
export function UrgentPanel() {
  const { settings } = useSettings()
  const { alreadyContacted } = useTriage()
  const contacts = contactsFrom(settings)

  return (
    <section
      aria-labelledby="triage-urgent-heading"
      data-testid="urgent-panel"
      className="mx-auto max-w-xl rounded-lg border-4 border-clay bg-paper p-5"
    >
      <h2 id="triage-urgent-heading" className="mt-0 mb-3 text-3xl text-clay">
        {TRIAGE_COPY.urgentTitle}
      </h2>

      <p className="mt-0 mb-3 text-xl leading-snug text-ink">{TRIAGE_COPY.urgentAction}</p>

      {/*
        The one line on this screen that is about her rather than about what to
        do. The failure this panel exists to prevent is hesitation, and
        hesitation is social rather than informational.
      */}
      <p className="mt-0 mb-5 text-lg leading-snug text-ink">{TRIAGE_COPY.urgentPermission}</p>

      {contacts.length > 0 ? (
        <div className="flex flex-col gap-3">
          {contacts.map((contact) => (
            <DialButton key={contact.id} contact={contact} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-stone bg-white/50 p-4">
          <p className="mt-0 mb-3 text-ink">{TRIAGE_COPY.urgentNoContacts}</p>
          {/*
            The editor, right here, in the middle of a flare. This is the reason
            care team numbers are not behind a settings screen: the screen where
            a missing number costs her something is this one, and a settings
            screen showing her fat target would be behind the gate she is
            currently standing at. See lib/careTeam.ts.
          */}
          <CareTeamEditor compact />
        </div>
      )}

      {/*
        AFTER the buttons, on purpose. Above them it would read as the default
        rather than as escalation. Past what spec section 4 authorizes, and kept
        because "racing heartbeat, dizziness, or feeling faint" is exactly where
        calling the office is the wrong speed.
      */}
      <p className="mt-5 mb-0 text-lg leading-snug text-ink">{TRIAGE_COPY.urgentEmergency}</p>

      <p className="mt-3 mb-0 text-ink">{TRIAGE_COPY.urgentUnreachable}</p>

      {/*
        BELOW THE FOLD, per spec section 4: "because sometimes she has already
        called and is waiting."

        The spacer is what puts it there, and it is not decoration. A link that
        skips triage should take a deliberate scroll to reach, not sit under her
        thumb while she is reading the number. It is a link at body size rather
        than a button, so it never competes with the dial buttons above.
      */}
      <div className="h-[45vh]" aria-hidden="true" />

      <button
        type="button"
        onClick={alreadyContacted}
        className="mx-auto block rounded-lg px-2 py-2 text-creek underline underline-offset-4 hover:text-ridge-deep"
      >
        {TRIAGE_COPY.urgentContinue}
      </button>
    </section>
  )
}
