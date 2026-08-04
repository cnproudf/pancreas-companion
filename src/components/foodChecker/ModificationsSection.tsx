import type { FoodRating } from '../../lib/rating.ts'

/**
 * Always present, on every result, including green ones. Spec section 5.1.
 *
 * The point of the rating engine is not to say no, it is to say here is the
 * version of this you can have. A green food still gets the section, because
 * "this is already good, and here is how it is even better" is the tone the
 * addendum asks for.
 *
 * rating.modifications is legitimately empty in two cases and the section still
 * renders, with copy honest about which case it is.
 */
export function ModificationsSection({ rating }: { rating: FoodRating }) {
  const isAlcohol = rating.reasons.some((reason) => reason.code === 'alcohol')
  const hasModifications = rating.modifications.length > 0

  /*
   * "Ways to get closer" promises a smaller portion or a swap. For alcohol
   * there is none, and offering the heading anyway would imply one exists,
   * which is the thing invariant 4 is there to prevent.
   */
  const heading = isAlcohol
    ? 'No modified version'
    : rating.rating !== 'green'
      ? 'Ways to get closer'
      : hasModifications
        ? 'Already a good one. To make it easier still'
        : 'Already a good one'

  return (
    <section aria-labelledby="modifications-heading" className="mt-4 border-t border-stone pt-3">
      <h4 id="modifications-heading" className="mt-0 mb-2 text-base font-semibold text-ridge-deep">
        {heading}
      </h4>

      {hasModifications ? (
        <ul className="m-0 list-disc space-y-1 pl-5 text-ink">
          {rating.modifications.map((modification) => (
            <li key={modification}>{modification}</li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-ink">
          {isAlcohol
            ? /*
                Invariant 4: no modifications are ever offered for alcohol.
                rateFood already strips them, including the one that
                data/foods.json ships on that entry, and this branch must not
                quietly put it back by suggesting a substitute drink.
              */
              'This one does not have a modified version.'
            : rating.rating === 'green'
              ? 'Nothing to change here. The serving above is already the version to have.'
              : /*
                  Not every entry in the dataset ships a swap, and on a yellow or
                  red food "nothing to change here" would contradict the heading
                  above it. Portion is always a lever, so say that instead.
                */
                'No specific swap for this one. A smaller portion is the lever you have.'}
        </p>
      )}
    </section>
  )
}
