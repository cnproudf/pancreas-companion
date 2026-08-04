import { LIFT_COPY } from '../../lib/liftRotation.ts'

/**
 * Saves the lift currently showing.
 *
 * Carries an icon, a word, and aria-pressed. Never state by colour alone: that
 * rule is written for the traffic light in invariant 8, but a filled-versus-
 * outlined heart at two thirds of a centimetre is exactly the same problem, and
 * she may be reading this half awake.
 */

interface HeartButtonProps {
  saved: boolean
  onToggle: () => void
  /** Friend notes get warmer chrome and no border. */
  tone: 'card' | 'note'
}

const TONE: Record<HeartButtonProps['tone'], { saved: string; unsaved: string }> = {
  card: {
    saved: 'border-gold/45 bg-gold/12 text-gold-text',
    unsaved: 'border-moss/50 bg-white/45 text-ink hover:border-creek',
  },
  note: {
    saved: 'border-transparent bg-gold/15 text-gold-text',
    unsaved: 'border-transparent bg-[#F1E2C9] text-gold-text hover:bg-[#EDDBBC]',
  },
}

export function HeartButton({ saved, onToggle, tone }: HeartButtonProps) {
  const palette = TONE[tone]

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={saved}
      aria-label={saved ? LIFT_COPY.savedLabel : LIFT_COPY.saveLabel}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
        saved ? palette.saved : palette.unsaved
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        aria-hidden="true"
        focusable="false"
        fill={saved ? 'var(--gold)' : 'none'}
        stroke={saved ? 'var(--gold)' : 'currentColor'}
        strokeWidth="1.8"
        strokeLinejoin="round"
        className="shrink-0"
      >
        <path d="M12 21.35 10.55 20C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54Z" />
      </svg>
      {saved ? LIFT_COPY.saved : LIFT_COPY.save}
    </button>
  )
}
