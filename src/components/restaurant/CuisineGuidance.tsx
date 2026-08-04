import type { CuisinePlaybook } from '../../types.ts'
import { GuidanceIcon, type GuidanceIconName } from './GuidanceIcon.tsx'

/**
 * Safe bets, what to skip, and what to ask for, in that order.
 *
 * Safe bets come first deliberately. The point of the app is not to say no, it
 * is to say here is the version of this you can have, so the first thing on the
 * screen after the universal strategy is a list of things she can order.
 *
 * The colour, icon, and heading word all carry the same meaning, which is
 * invariant 8's principle applied past the traffic light: colour is never doing
 * the work on its own. --gold-text rather than --gold on the avoid heading is
 * not in play here, but the same contrast rule is why avoid uses --clay, which
 * does meet AA on paper.
 */

interface ListSpec {
  key: 'safeBets' | 'avoid' | 'askFor'
  heading: string
  icon: GuidanceIconName
  /** Tailwind text colour for the heading and its icon. */
  tone: string
}

const LISTS: readonly ListSpec[] = [
  { key: 'safeBets', heading: 'Safe bets', icon: 'check', tone: 'text-laurel' },
  { key: 'avoid', heading: 'Skip', icon: 'skip', tone: 'text-clay' },
  { key: 'askFor', heading: 'Ask for', icon: 'ask', tone: 'text-creek' },
]

export function CuisineGuidance({ playbook }: { playbook: CuisinePlaybook }) {
  return (
    <section
      aria-labelledby="cuisine-heading"
      className="rounded-lg border border-stone bg-white/50 p-5"
    >
      <h2 id="cuisine-heading" className="mt-0 mb-4 text-lg">
        {playbook.label}
      </h2>

      <div className="flex flex-col gap-5">
        {LISTS.map((list) => (
          <div key={list.key}>
            <h3 className={`m-0 flex items-center gap-2 text-base font-semibold ${list.tone}`}>
              <GuidanceIcon icon={list.icon} className="h-5 w-5 shrink-0" />
              {list.heading}
            </h3>

            <ul className="mt-2 mb-0 flex list-none flex-col gap-2 p-0">
              {playbook[list.key].map((line) => (
                <li key={line} className="flex gap-3 text-ink">
                  <span
                    aria-hidden="true"
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-stone"
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
