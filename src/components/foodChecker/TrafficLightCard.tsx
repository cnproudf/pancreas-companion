import type { ReactNode } from 'react'
import type { FoodRating } from '../../lib/rating.ts'
import type { Food } from '../../types.ts'
import { RatingIcon } from './RatingIcon.tsx'
import { RATING_CLASSES } from './ratingClasses.ts'

/**
 * The result card. Spec section 5.1: large and immediately legible.
 *
 * No ridgeline, no decoration. Addendum section C is explicit that this screen
 * stays clean, because ornament on a screen someone reads while unwell is a
 * cost rather than a feature.
 *
 * Invariant 8: colour AND icon AND text. The rating word is real text next to
 * the icon, so the card still says what it means in greyscale, with a colour
 * vision deficiency, or read aloud.
 */
export function TrafficLightCard({
  food,
  rating,
  children,
}: {
  food: Food
  rating: FoodRating
  children?: ReactNode
}) {
  const colors = RATING_CLASSES[rating.rating]
  const [headline, ...rest] = rating.reasons

  /*
   * The engine always appends the arithmetic reason last, so reasons[0] is the
   * headline. When a flag overrode the arithmetic, that trailing reason is
   * describing a verdict the card is not showing: alcohol is red at zero grams,
   * and printing "this fits comfortably in what you have to work with today"
   * underneath a red card reads as contradiction at best and encouragement at
   * worst, on the one item that must never be encouraged.
   *
   * mathRating exists precisely so a consumer can tell the two apart.
   */
  const overridden = rating.rating !== rating.mathRating
  const supporting = overridden ? rest.filter((reason) => reason.flag !== null) : rest

  return (
    <article
      aria-labelledby="result-heading"
      className={`rounded-lg border-2 p-5 ${colors.border} ${colors.tint}`}
    >
      <div className="flex items-center gap-3">
        <RatingIcon icon={rating.presentation.icon} className={`h-10 w-10 shrink-0 ${colors.icon}`} />
        <p className={`m-0 text-2xl font-semibold ${colors.text}`}>{rating.presentation.label}</p>
      </div>

      <h3 id="result-heading" className="mt-3 mb-0 text-xl">
        {food.name}
      </h3>

      <p className="numeral mt-3 mb-0 text-5xl leading-none font-semibold text-ridge-deep">
        {rating.fatGrams}
        <span className="ml-1 text-xl font-normal">g</span>
      </p>
      {/*
        Spec 5.1 requires the number be labelled an estimate wherever it appears.
        data/foods.json says the same thing in its own _meta.disclaimer: values
        vary by brand, cut, and preparation.
      */}
      <p className="mt-1 mb-0 text-sm text-ink">
        Estimated fat for {food.servingDescription}. Brands and kitchens vary.
      </p>

      {headline !== undefined && <p className="mt-4 mb-0 text-ink">{headline.text}</p>}

      {supporting.length > 0 && (
        <ul className="mt-2 mb-0 list-disc space-y-1 pl-5 text-sm text-ink">
          {supporting.map((reason) => (
            <li key={`${reason.code}-${reason.flag ?? 'none'}`}>{reason.text}</li>
          ))}
        </ul>
      )}

      {food.notes !== null && (
        <p className="mt-4 mb-0 border-t border-stone pt-3 text-sm text-ink">{food.notes}</p>
      )}

      {children}
    </article>
  )
}
