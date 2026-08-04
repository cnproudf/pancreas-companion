import { AI_COPY } from '../../lib/aiAdvice.ts'

/**
 * The line between 400ms and the answer. Phase 11.
 *
 * NO SPINNER, AND THE ABSENCE IS THE DESIGN. A spinner is a promise that
 * something is coming, and this cannot make that promise: the request aborts at
 * five seconds and the most likely outcome on a bad day is that nothing arrives
 * at all. A spinner that stops without resolving is the exact thing addendum
 * section D rules out, and animation on a screen someone reads while unwell is a
 * cost rather than a feature (addendum section C).
 *
 * So it is one sentence that is true either way. It says the local guidance above
 * is what is already known, which means this line disappearing reads as nothing
 * having happened rather than as something having failed.
 *
 * It also HOLDS THE SLOT the card will occupy. That is why it is a bordered block
 * of roughly the right shape rather than a bare line of text: the answer replaces
 * it in place, and nothing above it moves.
 */
export function AiPending() {
  return (
    <section
      aria-labelledby="ai-pending-heading"
      className="rounded-lg border border-dashed border-stone bg-white/30 p-5"
    >
      <h3 id="ai-pending-heading" className="mt-0 mb-2 text-base font-semibold text-ridge-mid">
        {AI_COPY.heading}
      </h3>
      {/*
        role="status" rather than aria-live="polite" on a wrapper: this is a
        whole region appearing, and status is the role for a non-urgent
        advisory that is not an error.
      */}
      <p role="status" className="m-0 text-ink">
        {AI_COPY.pending}
      </p>
    </section>
  )
}
