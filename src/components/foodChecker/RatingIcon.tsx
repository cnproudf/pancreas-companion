import type { RatingIcon as RatingIconName } from '../../lib/rating.ts'

/**
 * The three traffic light shapes.
 *
 * Invariant 8: a rating is never colour alone. These are always rendered beside
 * the rating word, so they are aria-hidden and the text carries the meaning for
 * a screen reader. The shapes differ from each other, not just the colours, so
 * they still read as three distinct things in greyscale or with a colour vision
 * deficiency.
 */
export function RatingIcon({ icon, className = '' }: { icon: RatingIconName; className?: string }) {
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

      {icon === 'alert' && (
        <>
          <path d="M12 3 L22 20 H2 Z" />
          <path d="M12 9.5 V14" />
          <path d="M12 17.25 V17.26" />
        </>
      )}

      {icon === 'stop' && (
        <>
          <path d="M8.2 2.75 H15.8 L21.25 8.2 V15.8 L15.8 21.25 H8.2 L2.75 15.8 V8.2 Z" />
          <path d="M8.5 8.5 L15.5 15.5" />
          <path d="M15.5 8.5 L8.5 15.5" />
        </>
      )}
    </svg>
  )
}
