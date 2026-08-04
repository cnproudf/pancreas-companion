import { formatGrams } from '../../lib/rating.ts'
import type { Substitution } from '../../types.ts'

/**
 * The structural substitutions. Spec section 5.3.
 *
 * THE COMPARISON LINE ONLY APPEARS WHEN THE TWO SERVINGS ARE THE SAME STRING.
 *
 * This matters more than it looks. Sour cream is measured in 2 tablespoons and
 * nonfat Greek yogurt in 6 ounces, so subtracting one gram figure from the other
 * would produce a saving that is not real, on a screen whose whole job is to be
 * trustworthy about swaps. Where the servings differ, both numbers are shown
 * with their own serving and no arithmetic is claimed between them. Where they
 * match, the comparison is honest and it is the most useful line on the card.
 *
 * The `tradeoff` line is what keeps this from reading like an advertisement. A
 * swap that promises no cost is one she tries once and stops believing. Fat free
 * cheddar does melt badly, and saying so is what makes the rest credible.
 */
export function SwapList({ substitution }: { substitution: Substitution }) {
  return (
    <section
      aria-labelledby="swaps-heading"
      className="rounded-lg border border-stone bg-white/50 p-5"
    >
      <h3 id="swaps-heading" className="mt-0 mb-3 text-lg">
        Ways to get close
      </h3>

      <ul className="m-0 list-none p-0">
        {substitution.swaps.map((swap) => {
          const sameServing = swap.servingDescription === substitution.standardServingDescription

          return (
            <li
              key={swap.to}
              className="border-t border-stone/70 py-4 first:border-t-0 first:pt-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="m-0 font-serif text-[1.05rem] text-ridge-deep">{swap.to}</p>
                <p className="numeral m-0 shrink-0 text-lg font-semibold text-ridge-deep">
                  {swap.fatGrams}
                  <span className="ml-0.5 text-sm font-normal">g</span>
                </p>
              </div>

              <p className="mt-0.5 mb-0 text-sm text-ridge-mid">
                {sameServing
                  ? `About ${formatGrams(swap.fatGrams)} in place of ${formatGrams(
                      substitution.standardFatGrams,
                    )}, same ${swap.servingDescription}.`
                  : `Estimated fat for ${swap.servingDescription}.`}
              </p>

              <p className="mt-2 mb-0 text-ink">{swap.how}</p>

              {swap.tradeoff !== null && (
                <p className="mt-2 mb-0 text-sm text-gold-text">
                  What you give up: {swap.tradeoff}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
