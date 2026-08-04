import type { ReactNode } from 'react'
import { AI_COPY, type AiAdvice } from '../../lib/aiAdvice.ts'
import { RATING_PRESENTATION } from '../../lib/rating.ts'
import { RatingIcon } from '../foodChecker/RatingIcon.tsx'
import { RATING_CLASSES } from '../foodChecker/ratingClasses.ts'

/**
 * An AI estimate. Phase 11. Spec 5.1 and 5.2, "clearly labeled as an estimate to
 * verify".
 *
 * SHE MUST BE ABLE TO TELL THIS FROM LOCAL DATA WITHOUT READING A WORD, so the
 * distinction is carried three ways and no single one of them is load bearing:
 *
 *   1. A DASHED border. Every local card in the app is solid: TrafficLightCard,
 *      NearMissList, CuisineGuidance, the untargeted article in FoodChecker. The
 *      dash is the glanceable signal and it is unique to this component.
 *   2. A heading that says "estimate" and a provenance line under it saying where
 *      the number came from and that it can be wrong.
 *   3. The estimate sentence under the gram value itself, so a number read out of
 *      context still carries its own caveat.
 *
 * INVARIANT 8 IS UNCHANGED HERE. The traffic light still carries colour AND icon
 * AND text, from the same RATING_CLASSES and the same RatingIcon as the local
 * card, because a yellow means the same thing whoever worked it out. The dashed
 * border says where the answer came from; it does not say the rating is softer.
 *
 * INVARIANT 2. This is food guidance, so it renders inside FlareGate and under
 * the persistent disclaimer footer that AppShell keeps on every screen.
 */
export function AiEstimateCard({
  advice,
  children,
}: {
  advice: AiAdvice
  children?: ReactNode
}) {
  const colors = advice.rating === null ? null : RATING_CLASSES[advice.rating]
  const presentation = advice.rating === null ? null : RATING_PRESENTATION[advice.rating]

  return (
    <section
      aria-labelledby="ai-estimate-heading"
      className="rounded-lg border border-dashed border-ridge-mid bg-white/30 p-5"
    >
      <h3 id="ai-estimate-heading" className="mt-0 mb-1 text-base font-semibold text-ridge-mid">
        {AI_COPY.heading}
      </h3>
      <p className="mt-0 mb-4 text-sm text-ridge-mid">{AI_COPY.provenance}</p>

      {/*
        The medical redirect. rating "unknown" from the Worker, which its system
        prompt returns instead of answering anything about symptoms, diagnosis,
        or seeking care. One sentence, no rating, no number, nothing to act on
        but the reasoning itself. Spec rule 6.
      */}
      {advice.isRedirect ? (
        <>
          <p className="m-0 text-ink">{advice.reasoning}</p>
          <p className="mt-2 mb-0 text-ink">{AI_COPY.redirect}</p>
        </>
      ) : (
        <>
          {colors !== null && presentation !== null && (
            <div className="flex items-center gap-3">
              <RatingIcon
                icon={presentation.icon}
                className={`h-9 w-9 shrink-0 ${colors.icon}`}
              />
              <p className={`m-0 text-xl font-semibold ${colors.text}`}>{presentation.label}</p>
            </div>
          )}

          {advice.fatGrams !== null && (
            <>
              <p className="numeral mt-3 mb-0 text-4xl leading-none font-semibold text-ridge-mid">
                {advice.fatGrams}
                <span className="ml-1 text-lg font-normal">g</span>
              </p>
              <p className="mt-1 mb-0 text-sm text-ink">
                {advice.servingAssumed === ''
                  ? AI_COPY.gramsNote
                  : `Estimated fat for ${advice.servingAssumed}. ${AI_COPY.gramsNote}`}
              </p>
            </>
          )}

          <p className="mt-4 mb-0 text-ink">{advice.reasoning}</p>

          {/*
            Confidence as a word, never as a colour on its own. Same principle as
            invariant 8: the card has to say what it means in greyscale and read
            aloud. "low" is the honest common case for a restaurant the model has
            not seen, and the Worker's prompt tells it to say so.
          */}
          <p className="mt-2 mb-0 text-sm text-ridge-mid">
            {AI_COPY.confidenceLabel}: {advice.confidence}
          </p>

          {advice.modifications.length > 0 && (
            <section
              aria-labelledby="ai-modifications-heading"
              className="mt-4 border-t border-stone pt-3"
            >
              <h4
                id="ai-modifications-heading"
                className="mt-0 mb-2 text-base font-semibold text-ridge-deep"
              >
                {AI_COPY.modificationsTitle}
              </h4>
              <ul className="m-0 list-disc space-y-1 pl-5 text-ink">
                {advice.modifications.map((modification) => (
                  <li key={modification}>{modification}</li>
                ))}
              </ul>
            </section>
          )}

          {children}
        </>
      )}
    </section>
  )
}
