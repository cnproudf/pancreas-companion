import type { SubstitutionResource } from '../../types.ts'

/**
 * Real places where people have solved this before. Spec section 5.3.
 *
 * Always present, matched or not. The point of the section is that she is not
 * the first person to work out how to eat cornbread again, and that is true
 * whether or not the list happens to know the food she typed.
 *
 * Every link says it leaves the app, the same wording policy ChainHit uses, and
 * for the same reason: these URLs rot, and a link that has moved should read as
 * the site moving their page rather than as the app being broken.
 * _meta.maintenanceNote in data/substitutions.json tells whoever finds a dead
 * one what to do about it.
 *
 * A resource whose url is null renders its name and note with no link. That is
 * the deliberate state for a community that has closed: the name is still worth
 * knowing, and an empty promise of a link is worse than no link.
 */
export function ResourceLinks({ resources }: { resources: readonly SubstitutionResource[] }) {
  if (resources.length === 0) return null

  return (
    <section
      aria-labelledby="resources-heading"
      className="rounded-lg border border-stone bg-white/50 p-5"
    >
      <h2 id="resources-heading" className="mt-0 mb-1 text-lg">
        People who have solved this
      </h2>
      <p className="mt-0 mb-3 text-ink">
        You are not the first person to work this out. These are the ones worth your time.
      </p>

      <ul className="m-0 list-none p-0">
        {resources.map((resource) => (
          <li
            key={resource.id}
            className="border-t border-stone/70 py-3 first:border-t-0 first:pt-0"
          >
            {resource.url === null ? (
              <p className="m-0 font-semibold text-ink">{resource.name}</p>
            ) : (
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-creek underline underline-offset-4"
              >
                {resource.name} (opens their site)
              </a>
            )}
            <p className="mt-1 mb-0 text-sm text-ridge-mid">{resource.note}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
