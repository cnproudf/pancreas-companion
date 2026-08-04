export type GuidanceIconName = 'check' | 'skip' | 'ask'

/**
 * The three list marks on the cuisine guidance.
 *
 * Carries over the principle behind invariant 8: the safe bets, avoid, and ask
 * for lists are colour coded, so each one also gets a distinct shape and a word.
 * The shapes differ from each other rather than only the colours, so the three
 * lists stay distinguishable in greyscale or with a colour vision deficiency.
 *
 * aria-hidden, because each icon sits beside its own heading word and would
 * otherwise be announced twice.
 */
export function GuidanceIcon({
  icon,
  className = '',
}: {
  icon: GuidanceIconName
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icon === 'check' && (
        <>
          <circle cx="12" cy="12" r="9.5" />
          <path d="M7.5 12.5 L10.75 15.75 L16.5 9" />
        </>
      )}

      {/* A circle with a bar through it. Distinct from the food checker's stop
          octagon on purpose: this list is "not here", not "this is red". */}
      {icon === 'skip' && (
        <>
          <circle cx="12" cy="12" r="9.5" />
          <path d="M6.5 12 H17.5" />
        </>
      )}

      {/* A speech bubble. This is the list of things to say out loud. */}
      {icon === 'ask' && (
        <>
          <path d="M4 5.5 H20 V16 H13 L8.5 20 V16 H4 Z" />
          <path d="M8.5 10.75 H15.5" />
        </>
      )}
    </svg>
  )
}
