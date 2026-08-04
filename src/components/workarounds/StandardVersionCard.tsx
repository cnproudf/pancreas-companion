import type { Substitution } from '../../types.ts'

/**
 * The standard version, and why it lands where it does. Spec section 5.3.
 *
 * NO TRAFFIC LIGHT HERE, DELIBERATELY. The food checker's job is a verdict, and
 * it has a target to rate against. This screen's job is the comparison between
 * the standard version and the swap underneath it, which the two gram numbers
 * make on their own. A rating would also drag in the no-target branch on a
 * screen where the number is a fact about the food and does not depend on her
 * settings at all.
 *
 * The grams come from foods.json through the loader, never from this file's own
 * data, so a corrected estimate reaches here too. It is labelled an estimate for
 * the same reason every other surface in the app labels it one.
 */
export function StandardVersionCard({ substitution }: { substitution: Substitution }) {
  return (
    <article
      aria-labelledby="standard-heading"
      className="rounded-lg border border-stone bg-white/50 p-5"
    >
      <h3 id="standard-heading" className="mt-0 mb-0 text-xl">
        {substitution.name}
      </h3>

      <p className="numeral mt-3 mb-0 text-5xl leading-none font-semibold text-ridge-deep">
        {substitution.standardFatGrams}
        <span className="ml-1 text-xl font-normal">g</span>
      </p>
      <p className="mt-1 mb-0 text-sm text-ink">
        Estimated fat for {substitution.standardServingDescription}, made the usual way.
        Brands and kitchens vary.
      </p>

      <p className="mt-3 mb-0 text-ink">{substitution.why}</p>
    </article>
  )
}
