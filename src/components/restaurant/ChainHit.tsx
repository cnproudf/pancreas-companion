import type { RestaurantChain } from '../../types.ts'

/**
 * Shown when the name she typed matches a chain in the playbook.
 *
 * The nutrition link is labelled as theirs, not ours, and says it leaves the
 * app. These URLs rot: chains reorganise their sites constantly, and
 * _meta.maintenanceNote in the data file tells whoever maintains this what to do
 * about it. Until someone does, a link that has moved should read as the
 * restaurant moving their page rather than the app being broken, which is what
 * the wording buys.
 *
 * The link section renders nothing at all when the chain publishes nothing
 * findable. An empty promise of a link is worse than no link.
 *
 * When she has overridden the cuisine, this card stays but stops claiming the
 * guidance below is the chain's. The published nutrition page is a fact about
 * the restaurant and is still worth having; the sentence about which guidance is
 * showing would simply be untrue.
 */
export function ChainHit({
  chain,
  label,
  followed,
}: {
  chain: RestaurantChain
  label: string
  /** True when the guidance below is the chain's own cuisine. */
  followed: boolean
}) {
  return (
    <div className="rounded-lg border border-stone bg-paper p-4">
      <p className="m-0 text-ink">
        {followed
          ? `This looks like ${chain.name}, so the ${label} guidance is below.`
          : `This looks like ${chain.name}.`}
      </p>

      {chain.nutritionUrl !== null && (
        <p className="mt-2 mb-0">
          <a
            href={chain.nutritionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-creek underline underline-offset-4"
          >
            Published nutrition info (opens their site)
          </a>
        </p>
      )}
    </div>
  )
}
