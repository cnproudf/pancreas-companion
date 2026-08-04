import { useState } from 'react'
import type { SavedRestaurant } from '../../lib/savedRestaurants.ts'
import type { Cuisine } from '../../types.ts'
import { Ridgeline } from '../Ridgeline.tsx'

/**
 * Her spots, newest first.
 *
 * The cuisine label is resolved from the playbook at render rather than stored,
 * so an improved Italian entry reaches the Italian place she saved last year.
 * A row whose cuisine is no longer in the playbook still renders: it just shows
 * her name and her notes without a label. See the long note at the top of
 * lib/savedRestaurants.ts.
 *
 * The empty state carries the ridgeline at low opacity, which addendum section C
 * names as one of exactly three permitted uses ("no entries yet, no saved
 * restaurants").
 */

interface SavedRestaurantListProps {
  saved: readonly SavedRestaurant[]
  labelFor: (cuisine: Cuisine | null) => string | null
  /** Loads this restaurant back into the screen above. */
  onUse: (restaurant: SavedRestaurant) => void
  onUpdateNotes: (id: string, notes: string) => void
  onRemove: (id: string) => void
}

export function SavedRestaurantList({
  saved,
  labelFor,
  onUse,
  onUpdateNotes,
  onRemove,
}: SavedRestaurantListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftNotes, setDraftNotes] = useState('')

  if (saved.length === 0) {
    return (
      <section
        aria-labelledby="saved-heading"
        className="overflow-hidden rounded-lg border border-stone bg-white/50"
      >
        <div className="p-5">
          <h2 id="saved-heading" className="mt-0 mb-1 text-lg">
            Your places
          </h2>
          <p className="m-0 text-ink">
            Nothing saved yet. When somewhere works, keep it here with a note about what
            you asked for and who was good about it.
          </p>
        </div>
        <Ridgeline className="opacity-25" />
      </section>
    )
  }

  return (
    <section
      aria-labelledby="saved-heading"
      className="rounded-lg border border-stone bg-white/50 p-5"
    >
      <h2 id="saved-heading" className="mt-0 mb-3 text-lg">
        Your places
      </h2>

      <ul className="m-0 list-none p-0">
        {saved.map((restaurant) => {
          const label = labelFor(restaurant.cuisine)
          const editing = editingId === restaurant.id

          return (
            <li
              key={restaurant.id}
              className="border-t border-stone/70 py-4 first:border-t-0 first:pt-0"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="m-0 font-serif text-[1.05rem] text-ridge-deep">{restaurant.name}</p>
                  {label !== null && (
                    <p className="mt-0.5 mb-0 text-sm text-ridge-mid">{label}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onUse(restaurant)}
                  className="shrink-0 rounded-lg border border-stone bg-paper px-3 py-2 text-sm text-ink hover:border-creek"
                >
                  Open
                </button>
              </div>

              {editing ? (
                <>
                  <label htmlFor={`notes-${restaurant.id}`} className="sr-only">
                    Your notes about {restaurant.name}
                  </label>
                  <textarea
                    id={`notes-${restaurant.id}`}
                    value={draftNotes}
                    onChange={(event) => setDraftNotes(event.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-lg border-2 border-stone bg-paper px-4 py-3 text-ink focus:border-creek"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateNotes(restaurant.id, draftNotes)
                        setEditingId(null)
                      }}
                      className="rounded-lg border-2 border-ridge-deep bg-ridge-deep px-4 py-2 text-sm font-semibold text-paper hover:border-ridge-mid hover:bg-ridge-mid"
                    >
                      Save note
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg px-3 py-2 text-sm text-ridge-mid underline underline-offset-4 hover:text-creek"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {restaurant.notes.trim() !== '' && (
                    <p className="mt-2 mb-0 whitespace-pre-wrap text-ink">{restaurant.notes}</p>
                  )}

                  <div className="mt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(restaurant.id)
                        setDraftNotes(restaurant.notes)
                      }}
                      className="rounded-lg py-2 text-sm text-ridge-mid underline underline-offset-4 hover:text-creek"
                    >
                      {restaurant.notes.trim() === '' ? 'Add a note' : 'Edit note'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(restaurant.id)}
                      aria-label={`Remove ${restaurant.name} from your places`}
                      className="rounded-lg py-2 text-sm text-ridge-mid underline underline-offset-4 hover:text-creek"
                    >
                      Remove
                    </button>
                  </div>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
