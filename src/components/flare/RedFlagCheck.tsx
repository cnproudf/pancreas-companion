import { RED_FLAGS, TRIAGE_COPY } from '../../lib/triage.ts'
import { useTriage } from '../../state/triage.tsx'

/**
 * What flare mode opens to. Spec section 4.
 *
 * Five questions and two buttons. NOTHING ELSE GOES ON THIS SCREEN.
 *
 * No ridgeline (addendum section C keeps decoration off the screens she reads
 * while unwell, and this is the most unwell she will be when she reads
 * anything). No reassurance. No "this is probably nothing". No illustration.
 * No progress indicator. She is here because she is having a bad time and the
 * app has one thing to ask her.
 *
 * THE TWO ANSWERS ARE THE SAME SIZE, THE SAME WEIGHT, AND THE SAME COLOUR.
 *
 * That is deliberate and it should stay that way. Styling "No, but I feel off"
 * as the primary action would be the app nudging her toward the answer that
 * keeps her inside the app, on the one screen where the app has the least
 * business having a preference. The yes is listed first because it is the one
 * that matters more, and that is the only asymmetry here.
 */
export function RedFlagCheck() {
  const { reportRedFlag, reportNoRedFlag } = useTriage()

  return (
    <section
      aria-labelledby="triage-check-heading"
      data-testid="redflag-check"
      className="mx-auto max-w-xl"
    >
      <h2 id="triage-check-heading" className="mt-0 mb-2 text-2xl">
        {TRIAGE_COPY.checkTitle}
      </h2>
      <p className="mt-0 mb-4 text-ink">{TRIAGE_COPY.checkIntro}</p>

      <ul className="m-0 mb-6 flex list-none flex-col gap-3 p-0">
        {RED_FLAGS.map((flag) => (
          <li
            key={flag}
            /*
              Left rule in clay rather than a bullet glyph. It reads as a list
              at a glance without asking her to parse a marker, and it is the
              one place on this screen where colour is used at all.
            */
            className="border-l-4 border-clay py-1 pl-4 text-lg leading-snug text-ink"
          >
            {flag}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={reportRedFlag}
          className="w-full rounded-lg border-2 border-ridge-deep bg-paper px-4 py-4 text-lg font-semibold text-ridge-deep hover:bg-ridge-deep hover:text-paper"
        >
          {TRIAGE_COPY.answerYes}
        </button>
        <button
          type="button"
          onClick={reportNoRedFlag}
          className="w-full rounded-lg border-2 border-ridge-deep bg-paper px-4 py-4 text-lg font-semibold text-ridge-deep hover:bg-ridge-deep hover:text-paper"
        >
          {TRIAGE_COPY.answerNo}
        </button>
      </div>
    </section>
  )
}
