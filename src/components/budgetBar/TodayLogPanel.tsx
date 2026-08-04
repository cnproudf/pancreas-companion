import { useState } from 'react'
import { formatGrams } from '../../lib/rating.ts'
import { MEAL_COPY } from '../../lib/meals.ts'
import { SOURCE_NOTE } from '../../lib/targetSource.ts'
import { useFoodLog } from '../../state/foodLog.tsx'
import type { TargetSource } from '../../lib/rateForSettings.ts'
import type { FoodLogEntry } from '../../lib/foodLog.ts'

/**
 * Today's log, opened by tapping the budget bar. Spec section 5.4.
 *
 * Only the grams are editable. Name and serving stay as they were logged,
 * because the whole reason those fields are copied into the entry rather than
 * resolved from foodId is that this log has to keep saying what was true at the
 * time. The Phase 7 pattern view and the Phase 10 export both treat it as
 * evidence.
 *
 * Removing is immediate with an undo rather than a confirm dialog. Challenging
 * her over one local row would be the app second guessing an adult correcting
 * her own record, and undo is the friendlier shape at the same safety.
 *
 * The undo state lives here rather than on the row, because a removed row
 * unmounts the moment it leaves entriesToday.
 */

const SECONDARY_BUTTON =
  'rounded-lg border border-stone bg-paper px-3 py-2 text-sm text-ink hover:border-creek'

function timeOfDay(isoTimestamp: string): string {
  const when = new Date(isoTimestamp)
  if (Number.isNaN(when.getTime())) return ''
  return when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function EntryRow({
  entry,
  onRemove,
}: {
  entry: FoodLogEntry
  onRemove: (entry: FoodLogEntry) => void
}) {
  const { updateEntryGrams } = useFoodLog()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const subtitle =
    entry.servingDescription === ''
      ? timeOfDay(entry.loggedAt)
      : `${entry.servingDescription} at ${timeOfDay(entry.loggedAt)}`

  return (
    <li className="border-t border-stone py-3 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-ink">{entry.name}</p>
          <p className="mt-0.5 mb-0 text-sm text-ridge-mid">{subtitle}</p>
        </div>
        <p className="numeral m-0 shrink-0 font-semibold text-ridge-deep">{entry.fatGrams}g</p>
      </div>

      {editing ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="text-sm text-ink" htmlFor={`grams-${entry.id}`}>
            Fat grams
          </label>
          <input
            id={`grams-${entry.id}`}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.1"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="numeral w-24 rounded-lg border border-stone bg-paper px-3 py-2 text-ink"
          />
          <button
            type="button"
            className={SECONDARY_BUTTON}
            onClick={() => {
              // updateEntryGrams rejects anything unusable on its own, so a
              // blank or nonsense field just closes without changing the row.
              if (draft.trim() !== '') updateEntryGrams(entry.id, Number(draft))
              setEditing(false)
            }}
          >
            Save
          </button>
          <button type="button" className={SECONDARY_BUTTON} onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className={SECONDARY_BUTTON}
            onClick={() => {
              setDraft(String(entry.fatGrams))
              setEditing(true)
            }}
          >
            Edit grams
          </button>
          <button type="button" className={SECONDARY_BUTTON} onClick={() => onRemove(entry)}>
            Remove
          </button>
        </div>
      )}
    </li>
  )
}

export function TodayLogPanel({
  id,
  targetSource,
}: {
  id: string
  targetSource: TargetSource | null
}) {
  const { entriesToday, gramsUsedToday, removeEntry, restoreEntry } = useFoodLog()
  const [removed, setRemoved] = useState<FoodLogEntry | null>(null)

  return (
    <div
      id={id}
      className="mt-3 max-h-[60vh] overflow-y-auto rounded-lg border border-stone bg-white/50 p-4"
    >
      <h2 className="mt-0 mb-2 text-base">Today's log</h2>

      {entriesToday.length === 0 ? (
        <p className="m-0 text-ink">{MEAL_COPY.none}</p>
      ) : (
        <>
          <ul className="m-0 list-none p-0">
            {entriesToday.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                onRemove={(target) => setRemoved(removeEntry(target.id))}
              />
            ))}
          </ul>

          <div className="mt-3 flex justify-between gap-3 border-t border-stone pt-3">
            <p className="m-0 text-sm text-ink">Logged today</p>
            <p className="numeral m-0 text-sm font-semibold text-ridge-deep">
              {formatGrams(gramsUsedToday)}
            </p>
          </div>
        </>
      )}

      {removed !== null && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-stone pt-3">
          <p role="status" className="m-0 text-sm text-ink">
            Removed {removed.name}.
          </p>
          <button
            type="button"
            className={SECONDARY_BUTTON}
            onClick={() => {
              restoreEntry(removed)
              setRemoved(null)
            }}
          >
            Undo
          </button>
        </div>
      )}

      {targetSource !== null && (
        <p className="mt-2 mb-0 text-sm text-ridge-mid">{SOURCE_NOTE[targetSource]}</p>
      )}
    </div>
  )
}
