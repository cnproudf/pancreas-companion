import { useEffect, useId, useRef, useState } from 'react'
import {
  SYMPTOM_COPY,
  type AttachedFood,
  type SymptomChip,
  type SymptomDraft,
  type SymptomEntry,
} from '../../lib/symptomLog.ts'
import { AttachFoodSection } from './AttachFoodSection.tsx'
import { PainSlider } from './PainSlider.tsx'
import { SymptomChips } from './SymptomChips.tsx'

/**
 * The log sheet. Addendum section B.
 *
 * "Opens a short sheet. Timestamp is captured automatically and is the only
 * required field. Everything else is optional. She can log nothing but the time
 * and close it, and that is a valid entry meaning something was happening here."
 *
 * So the save button is never disabled, there is no validation anywhere in here,
 * and nothing is marked required. The one thing the sheet insists on is the one
 * thing it fills in for her.
 *
 * Uses the native <dialog> element with showModal, which brings focus trapping,
 * Escape to close, inert background, and the top layer without a dependency or a
 * hand rolled focus trap. Addendum B wants this reachable in one tap and gone in
 * one tap, and the platform already does that correctly.
 *
 * This sheet renders OUTSIDE FlareGate. Pain, chips, a note, and a timestamp are
 * not food content, and the day she most needs to record how she feels is the
 * day the gate is closed. The one part that IS food content, AttachFoodSection,
 * carries its own flare guard. See the long note in that file.
 */

/** A datetime-local value, "YYYY-MM-DDTHH:mm", from an ISO timestamp. */
function toLocalInput(iso: string): string {
  const when = new Date(iso)
  if (Number.isNaN(when.getTime())) return ''

  const pad = (value: number) => String(value).padStart(2, '0')
  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T${pad(
    when.getHours(),
  )}:${pad(when.getMinutes())}`
}

/** Back to ISO. Returns null when the field is empty or unparseable. */
function fromLocalInput(value: string): string | null {
  if (value === '') return null
  const when = new Date(value)
  if (Number.isNaN(when.getTime())) return null
  return when.toISOString()
}

export function SymptomSheet({
  open,
  editing,
  onSave,
  onClose,
}: {
  open: boolean
  /** The entry being corrected, or null when this is a new one. */
  editing: SymptomEntry | null
  onSave: (draft: SymptomDraft) => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  const [at, setAt] = useState('')
  const [pain, setPain] = useState<number | null>(null)
  const [symptoms, setSymptoms] = useState<SymptomChip[]>([])
  const [note, setNote] = useState('')
  const [attachedFoods, setAttachedFoods] = useState<AttachedFood[]>([])

  /*
   * Seed the fields whenever the sheet opens. Keyed on `open` and `editing` so
   * reopening for a new entry does not inherit the last one's answers, which
   * would quietly attribute yesterday's symptoms to today.
   *
   * Pain seeds to null, not to 0 or 5. The sheet opens with no number given,
   * and a number only exists once she puts one there.
   */
  useEffect(() => {
    if (!open) return

    setAt(toLocalInput(editing?.at ?? new Date().toISOString()))
    setPain(editing?.pain ?? null)
    setSymptoms(editing === null ? [] : [...editing.symptoms])
    setNote(editing?.note ?? '')
    setAttachedFoods(editing === null ? [] : [...editing.attachedFoods])
  }, [open, editing])

  /* Drive the native dialog from the open prop, and report platform closes. */
  useEffect(() => {
    const node = dialog.current
    if (node === null) return

    if (open && !node.open) node.showModal()
    if (!open && node.open) node.close()
  }, [open])

  useEffect(() => {
    const node = dialog.current
    if (node === null) return

    // Fires for Escape and for the form's dialog method alike, so the parent's
    // state cannot drift out of sync with what is actually on screen.
    const handleClose = () => onClose()
    node.addEventListener('close', handleClose)
    return () => node.removeEventListener('close', handleClose)
  }, [onClose])

  function toggleChip(chip: SymptomChip) {
    setSymptoms((current) =>
      current.includes(chip) ? current.filter((value) => value !== chip) : [...current, chip],
    )
  }

  function save() {
    /*
     * A timestamp that will not parse falls back to now rather than blocking
     * the save. She came here to record something; losing it to a malformed
     * date field would be the app protecting its data model at her expense.
     */
    onSave({
      at: fromLocalInput(at) ?? new Date().toISOString(),
      pain,
      symptoms,
      note,
      attachedFoods,
    })
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className="m-auto w-[min(34rem,92vw)] rounded-xl border border-stone bg-paper p-0 text-ink backdrop:bg-ridge-deep/40"
    >
      <div className="max-h-[85vh] overflow-y-auto px-5 py-5">
        <h2 id={titleId} className="mt-0 mb-1 text-xl">
          {SYMPTOM_COPY.sheetTitle}
        </h2>
        <p className="mt-0 mb-5 text-sm text-ridge-mid">{SYMPTOM_COPY.sheetIntro}</p>

        <div className="flex flex-col gap-6">
          <div>
            <label htmlFor="symptom-at" className="font-semibold text-ridge-deep">
              {SYMPTOM_COPY.timeLabel}
            </label>
            <input
              id="symptom-at"
              type="datetime-local"
              value={at}
              onChange={(event) => setAt(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border-2 border-stone bg-paper px-4 py-2 text-ink focus:border-creek"
            />
            <p className="mt-1 mb-0 text-sm text-ridge-mid">{SYMPTOM_COPY.timeHint}</p>
          </div>

          <PainSlider value={pain} onChange={setPain} />

          <SymptomChips selected={symptoms} onToggle={toggleChip} />

          <div>
            <label htmlFor="symptom-note" className="font-semibold text-ridge-deep">
              {SYMPTOM_COPY.noteLabel}
            </label>
            <textarea
              id="symptom-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder={SYMPTOM_COPY.notePlaceholder}
              className="mt-1 w-full rounded-lg border-2 border-stone bg-paper px-4 py-3 text-ink focus:border-creek"
            />
          </div>

          {/*
            Food content, and the only part of this sheet that is. Renders
            nothing in flare mode, by its own guard. Invariant 1.

            Anchored on the entry's timestamp, so reopening this later offers
            the 24 hours around when she felt unwell rather than around now.
          */}
          <AttachFoodSection
            at={fromLocalInput(at) ?? new Date().toISOString()}
            attached={attachedFoods}
            onChange={setAttachedFoods}
          />
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          {/*
            Never disabled. An entry carrying nothing but a timestamp is valid
            and means "something was happening here", so there is nothing here
            to validate and nothing to withhold the button for.
          */}
          <button
            type="button"
            onClick={save}
            className="flex-1 rounded-lg border-2 border-ridge-deep bg-ridge-deep px-4 py-3 font-semibold text-paper hover:border-ridge-mid hover:bg-ridge-mid"
          >
            {SYMPTOM_COPY.save}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border-2 border-stone bg-paper px-4 py-3 text-ink hover:border-creek"
          >
            {SYMPTOM_COPY.cancel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
