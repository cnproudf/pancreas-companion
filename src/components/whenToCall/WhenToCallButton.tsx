import { useState } from 'react'
import { TRIAGE_COPY } from '../../lib/triage.ts'
import { WhenToCallCard } from './WhenToCallCard.tsx'

/**
 * The persistent header control for When To Call. Spec 5.10: "reachable from a
 * persistent icon in the header."
 *
 * AN ICON AND A WORD, NOT AN ICON ALONE.
 *
 * Invariant 8 is about ratings, but its reasoning is general and applies here
 * with more force than anywhere else in the app: a phone glyph in clay means
 * nothing on its own, and this is the control she needs to find while feeling
 * terrible, possibly for the first time. The word costs a few pixels in the
 * header and removes every guess.
 *
 * IT RENDERS ABOVE FlareGate AND MUST STAY THERE.
 *
 * AppShell mounts this outside the gate, on the same footing as the Daily Lift
 * and the symptom log bar: red flags and phone numbers are not food guidance.
 * Unlike those two, this one is reachable at EVERY triage stage, including the
 * urgent panel, which is the point. The card must never become something she
 * can only reach after answering a question.
 */
export function WhenToCallButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border-2 border-clay bg-paper px-3 py-1.5 font-semibold text-clay hover:bg-clay hover:text-paper"
      >
        {/*
          A handset, drawn rather than imported, so there is no icon dependency
          and no font to load before it appears. Decorative: the word beside it
          is the label.
        */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-5 shrink-0"
          fill="currentColor"
        >
          <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.5.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.2.2 2.4.57 3.5a1 1 0 0 1-.25 1z" />
        </svg>
        {TRIAGE_COPY.whenToCallOpen}
      </button>

      <WhenToCallCard open={open} onClose={() => setOpen(false)} />
    </>
  )
}
