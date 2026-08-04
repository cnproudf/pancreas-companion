import type { FavoriteLift } from '../../lib/liftFavorites.ts'
import { LIFT_COPY } from '../../lib/liftRotation.ts'

/**
 * The lifts she kept, newest first. Spec section 5.11: "a favorites collection
 * she can revisit on hard days."
 *
 * Rows render from the snapshot stored at save time, not from a lookup into
 * data/, which is why a friend note she kept survives someone editing or
 * deleting it on GitHub. See the note at the top of lib/liftFavorites.ts.
 */

interface FavoritesPanelProps {
  favorites: readonly FavoriteLift[]
  onRemove: (id: string) => void
}

export function FavoritesPanel({ favorites, onRemove }: FavoritesPanelProps) {
  return (
    <ul className="m-0 list-none p-0">
      {favorites.map((favorite) => (
        <li
          key={favorite.id}
          className="flex items-start justify-between gap-3 border-t border-stone/70 py-4 first:border-t-0 first:pt-0"
        >
          {/*
            Smaller and tighter than the card. This is a list she scans, not the
            one thing she reads, and at card size four saved lifts would fill the
            header twice over. Not truncated though: she kept these to reread
            them, so they all render in full.
          */}
          <div className="min-w-0">
            <p className="m-0 font-serif text-[0.95rem] leading-[1.45] text-ridge-deep">
              {favorite.content}
            </p>

            {favorite.from !== undefined && (
              <p className="mt-1.5 mb-0 font-serif text-sm italic text-gold-text">
                {LIFT_COPY.friendPrefix} {favorite.from}
              </p>
            )}

            {favorite.attribution !== undefined && (
              <p className="mt-1.5 mb-0 font-serif text-sm italic text-ridge-mid">
                {favorite.attribution}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => onRemove(favorite.id)}
            aria-label={LIFT_COPY.removeFavoriteLabel}
            className="shrink-0 rounded-lg px-2 py-2 text-xs text-ridge-mid underline underline-offset-4 hover:text-creek"
          >
            {LIFT_COPY.removeFavorite}
          </button>
        </li>
      ))}
    </ul>
  )
}
