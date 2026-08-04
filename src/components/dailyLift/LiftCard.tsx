import type { LiftItem } from '../../lib/dailyLift.ts'
import { LIFT_COPY } from '../../lib/liftRotation.ts'
import { HeartButton } from './HeartButton.tsx'
import { scaleFor, SECONDARY_BUTTON } from './liftCardClasses.ts'

/**
 * The Daily Lift itself. Spec section 5.11: design this as if it were the whole
 * app.
 *
 * Two variants, and they are meant to read as two different kinds of object
 * rather than one card with two colour schemes.
 *
 * The general card is a card: square-ish corners, a stone border, a drop shadow,
 * a rule above the buttons. It is furniture, and it looks like furniture.
 *
 * A friend note is a note. No border, no rule, no drop shadow, one corner
 * tucked in like a folded sheet, warmer ground, more air, and a signature. The
 * spec calls this the heart of the feature and asks for "no clinical chrome
 * around them", so the structure comes off rather than getting repainted.
 */

interface LiftCardProps {
  item: LiftItem
  saved: boolean
  onToggleSaved: () => void
  onAnother: () => void
}

export function LiftCard({ item, saved, onToggleSaved, onAnother }: LiftCardProps) {
  const content = item.kind === 'friend-note' ? item.note.content : item.entry.content
  const scale = scaleFor(content)

  if (item.kind === 'friend-note') {
    return (
      <article
        /*
         * Asymmetric radius. Three corners soft and the bottom right tucked in,
         * under the signature, so the shape reads as a folded note rather than
         * as the card with its border turned off.
         */
        className="rounded-[1.75rem_1.75rem_0.375rem_1.75rem] bg-[#F7EDDC] px-6 py-7 shadow-[0_6px_28px_-14px_rgba(181,118,44,0.55)] sm:px-8 sm:py-9"
      >
        <p className={`m-0 font-serif text-ink ${scale.text} ${scale.measure}`}>{content}</p>

        <p className="mt-5 mb-0 text-right font-serif text-base italic text-gold-text">
          {LIFT_COPY.friendPrefix} {item.note.from}
        </p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <HeartButton saved={saved} onToggle={onToggleSaved} tone="note" />
          <button
            type="button"
            onClick={onAnother}
            className="inline-flex items-center rounded-lg px-3 py-2 text-sm text-gold-text underline decoration-gold/40 underline-offset-4 hover:decoration-gold"
          >
            {LIFT_COPY.another}
          </button>
        </div>
      </article>
    )
  }

  return (
    <article className="rounded-xl border border-stone bg-[#FCFAF6] px-6 py-7 shadow-[0_1px_2px_rgba(28,58,75,0.06),0_10px_28px_-16px_rgba(28,58,75,0.4)] sm:px-8 sm:py-9">
      <p className={`m-0 font-serif text-ridge-deep ${scale.text} ${scale.measure}`}>{content}</p>

      {item.entry.attribution !== undefined && (
        <p className="mt-3 mb-0 font-serif text-base italic text-ridge-mid">
          {item.entry.attribution}
        </p>
      )}

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-stone/70 pt-4">
        <HeartButton saved={saved} onToggle={onToggleSaved} tone="card" />
        <button type="button" onClick={onAnother} className={SECONDARY_BUTTON}>
          {LIFT_COPY.another}
        </button>
      </div>
    </article>
  )
}
