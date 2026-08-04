import type { UniversalPlaybook } from '../../types.ts'

/**
 * The universal ordering strategy. Always first, always shown, whether or not a
 * cuisine has been chosen. Spec section 5.2 puts it at position one for a
 * reason: it is the only part that works at a restaurant the playbook has never
 * heard of, which is most restaurants.
 *
 * Deliberately not collapsed behind a disclosure. The one thing she should be
 * able to do here is open the app at a table and read down a list.
 */
export function UniversalStrategy({ playbook }: { playbook: UniversalPlaybook }) {
  return (
    <section
      aria-labelledby="universal-heading"
      className="rounded-lg border border-stone bg-white/50 p-5"
    >
      <h2 id="universal-heading" className="mt-0 mb-1 text-lg">
        {playbook.title}
      </h2>
      <p className="mt-0 mb-4 text-sm text-ink">
        This part works anywhere, whether or not the app knows the restaurant.
      </p>

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {playbook.strategies.map((strategy) => (
          <li key={strategy} className="flex gap-3 text-ink">
            {/*
              A ridge mark rather than a bullet glyph, so the list reads as this
              app's rather than a browser default. Decorative, so it carries no
              meaning a screen reader needs.
            */}
            <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-moss" />
            <span>{strategy}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
