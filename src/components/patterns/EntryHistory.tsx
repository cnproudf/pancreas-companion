import { useState } from 'react'
import { formatDayLong } from '../../lib/days.ts'
import { chipLabels, PATTERN_COPY } from '../../lib/patterns.ts'
import { formatGrams } from '../../lib/rating.ts'
import { dateKey } from '../../lib/days.ts'
import { isBareEntry, SYMPTOM_COPY, type SymptomEntry } from '../../lib/symptomLog.ts'
import { Ridgeline } from '../Ridgeline.tsx'

/**
 * Everything she has logged, newest first, with edit and remove.
 *
 * She has to be able to correct her own record. Without this an entry saved
 * against the wrong day, or a pain number she fat fingered, would be permanent,
 * and this log is meant to be evidence she takes to a doctor.
 *
 * Removing is immediate with an undo rather than a confirm dialog, matching
 * TodayLogPanel. Challenging her over one local row would be the app second
 * guessing an adult correcting her own record, and undo is the friendlier shape
 * at the same safety.
 *
 * This list renders INSIDE FlareGate, along with the rest of the Patterns tab,
 * because an entry can carry attached foods and those are food content.
 *
 * Addendum section C allows the ridgeline motif in empty states at low opacity,
 * which is the one place it appears on this screen.
 */
export function EntryHistory({
  entries,
  onEdit,
  onRemove,
  onRestore,
}: {
  entries: readonly SymptomEntry[]
  onEdit: (entry: SymptomEntry) => void
  onRemove: (id: string) => SymptomEntry | null
  onRestore: (entry: SymptomEntry) => void
}) {
  /* Lives here rather than on the row, because a removed row unmounts. */
  const [undoable, setUndoable] = useState<SymptomEntry | null>(null)

  if (entries.length === 0) {
    return (
      <section
        aria-labelledby="history-heading"
        className="overflow-hidden rounded-lg border border-stone bg-white/50"
      >
        <div className="px-5 pt-5">
          <h2 id="history-heading" className="mt-0 mb-2 text-lg">
            {PATTERN_COPY.historyTitle}
          </h2>
          {/*
            No obligation anywhere in this sentence. It says where entries will
            appear and that there is no schedule, and stops.
          */}
          <p className="mt-0 mb-4 text-ink">{PATTERN_COPY.empty}</p>
        </div>
        <Ridgeline variant="band" className="opacity-25" />
      </section>
    )
  }

  return (
    <section
      aria-labelledby="history-heading"
      className="rounded-lg border border-stone bg-white/50 p-5"
    >
      <h2 id="history-heading" className="mt-0 mb-3 text-lg">
        {PATTERN_COPY.historyTitle}
      </h2>

      {undoable !== null && (
        <div
          role="status"
          className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-stone bg-paper px-3 py-2 text-sm"
        >
          <span className="text-ink">{SYMPTOM_COPY.removed}</span>
          <button
            type="button"
            onClick={() => {
              onRestore(undoable)
              setUndoable(null)
            }}
            className="shrink-0 rounded-lg px-2 py-1 text-creek underline underline-offset-4 hover:text-ridge-deep"
          >
            {SYMPTOM_COPY.undo}
          </button>
        </div>
      )}

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {entries.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            onEdit={() => onEdit(entry)}
            onRemove={() => {
              const removed = onRemove(entry.id)
              if (removed !== null) setUndoable(removed)
            }}
          />
        ))}
      </ul>
    </section>
  )
}

const SECONDARY_BUTTON =
  'rounded-lg border border-stone bg-paper px-3 py-2 text-sm text-ink hover:border-creek'

function EntryRow({
  entry,
  onEdit,
  onRemove,
}: {
  entry: SymptomEntry
  onEdit: () => void
  onRemove: () => void
}) {
  const when = new Date(entry.at)
  const time = Number.isNaN(when.getTime())
    ? ''
    : when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

  const chips = chipLabels(entry.symptoms)

  return (
    <li className="rounded-lg border border-stone bg-paper px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="numeral m-0 font-semibold text-ridge-deep">
          {formatDayLong(dateKey(when))}
          {time === '' ? '' : `, ${time}`}
        </p>

        {/*
          Pain in colour AND number AND word, never a bare coloured dot.
          Invariant 8's principle: a rating is never rendered as colour alone,
          and "no number" is a state that has to read as a state.
        */}
        <p className="numeral m-0 shrink-0 text-sm text-ridge-mid">
          {entry.pain === null ? PATTERN_COPY.noPainNumber : `Pain ${entry.pain}`}
        </p>
      </div>

      {/*
        An entry carrying only a timestamp is valid and means "something was
        happening here", so it gets a sentence rather than an empty row.
      */}
      {isBareEntry(entry) && (
        <p className="m-0 mt-1 text-sm text-ridge-mid">{PATTERN_COPY.bareEntry}</p>
      )}

      {chips.length > 0 && (
        <ul className="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0">
          {chips.map((label) => (
            <li
              key={label}
              className="rounded-full border border-stone px-3 py-1 text-sm text-ink"
            >
              {label}
            </li>
          ))}
        </ul>
      )}

      {entry.note.trim() !== '' && <p className="mt-2 mb-0 text-ink">{entry.note}</p>}

      {entry.attachedFoods.length > 0 && (
        <div className="mt-2">
          <p className="m-0 text-sm font-semibold text-ridge-mid">
            {PATTERN_COPY.attachedTitle}
          </p>
          <ul className="m-0 mt-1 flex list-none flex-col gap-0.5 p-0">
            {entry.attachedFoods.map((food) => (
              <li key={food.sourceEntryId + food.name} className="text-sm text-ink">
                {food.name}
                <span className="numeral text-ridge-mid"> ({formatGrams(food.fatGrams)})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onEdit} className={SECONDARY_BUTTON}>
          Change this
        </button>
        <button type="button" onClick={onRemove} className={SECONDARY_BUTTON}>
          Remove
        </button>
      </div>
    </li>
  )
}
