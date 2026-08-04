import { useId, useState } from 'react'
import { LIFT_COPY } from '../../lib/liftRotation.ts'
import { useDailyLift } from '../../state/dailyLift.tsx'
import { FavoritesPanel } from './FavoritesPanel.tsx'
import { LiftCard } from './LiftCard.tsx'

/**
 * The Daily Lift. Spec section 5.11, and the reason she opens the app.
 *
 * INVARIANT 1, and read this before moving anything.
 *
 * AppShell mounts this OUTSIDE FlareGate, alongside FatBudgetBar and, from
 * Phase 7, LogFeelingBar. That is deliberate: this is the one piece she should
 * still see on her worst day, and it is allowed above the gate for exactly one
 * reason, which is that it renders no food content. The log bar sits there on
 * the same reasoning; FatBudgetBar sits there for layout and carries its own
 * flare guard because it does show food content.
 *
 * That reason is load bearing. If anything here ever starts showing a rating, a
 * gram count, a meal suggestion, or a food name, this component moves inside
 * FlareGate and the signature image goes with it. Do not add food content here
 * and leave it where it is.
 *
 * The rotation already carries its own half of this: liftRotation.ts withholds
 * the two entries in the data that instruct her to eat something, in flare mode
 * only. See the note on instructsEating there.
 */
export function DailyLift() {
  const { item, another, saved, toggleSaved, favorites, removeSaved, persisted } = useDailyLift()
  const [showFavorites, setShowFavorites] = useState(false)
  const panelId = useId()

  // Only reachable if the rotation is empty, which the data makes impossible.
  // Rendering nothing beats rendering an empty box.
  if (item === null) return null

  return (
    <section aria-label={LIFT_COPY.regionLabel} className="mx-auto w-full max-w-xl">
      {/*
        The live region wraps the card rather than living inside it, because the
        two variants render different roots and a live region that unmounts does
        not announce. She taps "show me another" and a screen reader reads the
        new one.
      */}
      <div aria-live="polite">
        <LiftCard item={item} saved={saved} onToggleSaved={toggleSaved} onAnother={another} />
      </div>

      {favorites.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowFavorites((open) => !open)}
            aria-expanded={showFavorites}
            aria-controls={panelId}
            className="rounded-lg px-2 py-2 text-sm text-ridge-deep underline underline-offset-4 hover:text-creek"
          >
            {showFavorites ? LIFT_COPY.hideFavorites : LIFT_COPY.showFavorites} ({favorites.length})
          </button>

          {showFavorites && (
            /*
              Bounded height. This panel lives in the header, above the ridge, so
              an unbounded list would push the sunrise and everything under it
              off the screen once she has kept a dozen of these.
            */
            <div
              id={panelId}
              className="mt-2 max-h-[45vh] overflow-y-auto rounded-xl border border-stone bg-[#FCFAF6]/90 px-5 py-4"
            >
              <FavoritesPanel favorites={favorites} onRemove={removeSaved} />
            </div>
          )}
        </div>
      )}

      {!persisted && (
        <p role="status" className="mt-3 mb-0 text-sm text-gold-text">
          {LIFT_COPY.notPersisted}
        </p>
      )}
    </section>
  )
}
