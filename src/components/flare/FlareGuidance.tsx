import { TRIAGE_COPY } from '../../lib/triage.ts'
import { useTriage } from '../../state/triage.tsx'

/**
 * She reported no red flags. Spec section 4's "no" branch, and addendum section
 * A's flare guidance.
 *
 * Renders ABOVE the rest of the app rather than instead of it, so the checker,
 * the budget bar, and everything else come back with flare thresholds applied.
 * The gate has done its job by this point.
 *
 * THREE VISIBLE BLOCKS, AND THE REST BEHIND A DISCLOSURE.
 *
 * The first draft of this screen had six blocks. That is too much to read when
 * she feels terrible, and the part that matters most on arrival is the first
 * one: clear liquids, and the fact that the schedule for advancing her diet
 * comes from her doctor rather than from this app. Everything about eating
 * solid food again is true but not urgent, so it is one tap away.
 *
 * TWO THINGS STAY OUT OF THE DISCLOSURE ON PURPOSE.
 *
 * "If you cannot eat at all" is the one line here that routes to a person, and
 * a line that routes to a person is never hidden behind a tap.
 *
 * The way back to the red flag list is the other. A "no" is not a clearance,
 * and nothing in this app tells her she is fine. She answered a question about
 * the last few minutes; if that changes, the list is one tap away rather than
 * behind a mode switch.
 */
export function FlareGuidance() {
  const { reopenCheck } = useTriage()

  return (
    <section
      aria-labelledby="flare-guidance-heading"
      data-testid="flare-guidance"
      className="mx-auto mb-6 max-w-xl rounded-lg border border-stone bg-white/50 p-5"
    >
      <h2 id="flare-guidance-heading" className="mt-0 mb-2 text-xl">
        {TRIAGE_COPY.guidanceTitle}
      </h2>
      <p className="mt-0 mb-2 text-ink">{TRIAGE_COPY.guidanceLiquids}</p>
      <p className="mt-0 mb-0 text-ink">{TRIAGE_COPY.guidanceSchedule}</p>

      {/*
        Closed by default, and its state is not persisted. A plain <details>
        rather than a hand rolled toggle: the platform already gives correct
        keyboard behaviour, correct semantics, and find-in-page that opens it.
      */}
      <details className="mt-4 border-t border-stone pt-4">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold text-creek">
          {TRIAGE_COPY.guidanceMoreLabel}
        </summary>

        <div className="mt-2">
          <h3 className="mt-0 mb-1 text-lg">{TRIAGE_COPY.guidanceReadyTitle}</h3>
          <p className="mt-0 mb-3 text-ink">{TRIAGE_COPY.guidanceReady}</p>
          <p className="mt-0 mb-3 text-ink">{TRIAGE_COPY.guidanceFlags}</p>
          {/*
            Addendum section A: framed as an upper bound rather than a goal. The
            budget bar carries the same framing under its own readout, via
            BAR_COPY.flareCeilingNote, so the two halves of the screen agree.
          */}
          <p className="mt-0 mb-0 text-ink">{TRIAGE_COPY.guidanceCeiling}</p>
        </div>
      </details>

      <p className="mt-4 mb-0 border-t border-stone pt-4 text-ink">
        {TRIAGE_COPY.guidanceCannotEat}
      </p>

      <p className="mt-3 mb-0 text-ink">
        {TRIAGE_COPY.guidanceStillWrong}{' '}
        <button
          type="button"
          onClick={reopenCheck}
          className="rounded-lg px-1 text-creek underline underline-offset-4 hover:text-ridge-deep"
        >
          {TRIAGE_COPY.guidanceBackToCheck}
        </button>
      </p>
    </section>
  )
}
