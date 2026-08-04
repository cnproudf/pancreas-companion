import type { FoodMatch } from '../../lib/foodSearch.ts'

/**
 * What to show when nothing scored high enough to be an answer.
 *
 * Not an error state. No red, no warning icon, no apology. The local dataset is
 * 211 foods and will never cover everything she eats; the Worker fills that gap
 * in Phase 11. Until then the honest thing is to say so plainly and hand her the
 * closest things that ARE known, because a near miss is usually a typo.
 */
export function NearMissList({
  candidates,
  onPick,
}: {
  candidates: FoodMatch[]
  onPick: (match: FoodMatch) => void
}) {
  return (
    <section
      aria-labelledby="near-miss-heading"
      className="rounded-lg border border-stone bg-white/50 p-5"
    >
      <h3 id="near-miss-heading" className="mt-0 mb-2 text-lg">
        Not in my list yet
      </h3>

      {candidates.length > 0 ? (
        <>
          <p className="mt-0 mb-3 text-ink">
            I do not have that one yet. These are the closest things I do have.
          </p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {candidates.map((match) => (
              <li key={match.food.id}>
                <button
                  type="button"
                  onClick={() => onPick(match)}
                  className="w-full rounded-lg border border-stone bg-paper px-4 py-2 text-left text-ink hover:border-creek"
                >
                  {match.food.name}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="m-0 text-ink">
          I do not have that one yet. Try a simpler word, like the main ingredient.
        </p>
      )}
    </section>
  )
}
