import { useEffect, useState } from 'react'
import type { Cuisine } from '../../types.ts'

/**
 * Save this restaurant, with her own notes. Spec section 5.2: "so her regular
 * spots build up a personal, growing list of what worked, along with her own
 * notes."
 *
 * The name and cuisine come from the screen above rather than being retyped
 * here, so there is exactly one place on this screen where a restaurant is
 * named. Saving a name already on the list updates that row instead of adding a
 * second copy of it, which savedRestaurants.commitSaved handles.
 */
export function SaveRestaurantForm({
  name,
  cuisineLabel,
  alreadySaved,
  onSave,
}: {
  name: string
  cuisine: Cuisine | null
  cuisineLabel: string | null
  /** True when a row with this name is already on her list. */
  alreadySaved: boolean
  onSave: (notes: string) => void
}) {
  const [notes, setNotes] = useState('')
  const [confirmation, setConfirmation] = useState('')

  // A new restaurant is a new note. Clearing on name change stops last night's
  // note about one place from being saved against another.
  useEffect(() => {
    setNotes('')
    setConfirmation('')
  }, [name])

  const trimmed = name.trim()

  return (
    <section
      aria-labelledby="save-heading"
      className="rounded-lg border border-stone bg-white/50 p-5"
    >
      <h2 id="save-heading" className="mt-0 mb-1 text-lg">
        Keep this one
      </h2>

      {trimmed === '' ? (
        <p className="mt-0 mb-0 text-ink">
          Type a restaurant name above and you can save it here with your own notes.
        </p>
      ) : (
        <>
          <p className="mt-0 mb-3 text-sm text-ink">
            Saving {trimmed}
            {cuisineLabel === null ? '' : `, ${cuisineLabel}`}.
          </p>

          <label htmlFor="restaurant-notes" className="text-sm text-ink">
            Anything worth remembering?
          </label>
          <textarea
            id="restaurant-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="The Tuesday manager here is great about this"
            className="mt-1 w-full rounded-lg border-2 border-stone bg-paper px-4 py-3 text-ink focus:border-creek"
          />

          <button
            type="button"
            onClick={() => {
              onSave(notes)
              setConfirmation(alreadySaved ? `Updated ${trimmed}.` : `Saved ${trimmed}.`)
            }}
            className="mt-3 w-full rounded-lg border-2 border-ridge-deep bg-ridge-deep px-4 py-3 font-semibold text-paper hover:border-ridge-mid hover:bg-ridge-mid"
          >
            {alreadySaved ? 'Update this restaurant' : 'Save this restaurant'}
          </button>

          <p role="status" className="mt-2 mb-0 text-center text-sm text-ink">
            {confirmation}
          </p>
        </>
      )}
    </section>
  )
}
