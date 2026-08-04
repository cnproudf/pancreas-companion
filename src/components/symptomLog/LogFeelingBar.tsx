import { useState } from 'react'
import { SYMPTOM_COPY, type SymptomDraft, type SymptomEntry } from '../../lib/symptomLog.ts'
import { useSymptomLog } from '../../state/symptomLog.tsx'
import { SymptomSheet } from './SymptomSheet.tsx'

/**
 * The persistent "Log how I am feeling" button. Addendum section B: "One
 * persistent button, reachable in a single tap from anywhere."
 *
 * INVARIANT 1, AND THE REASON THIS IS ALLOWED WHERE IT IS.
 *
 * AppShell mounts this OUTSIDE FlareGate, alongside DailyLift and FatBudgetBar.
 * DailyLift is above the gate because it renders no food content; FatBudgetBar
 * is above it for layout and carries its own guard because it does. This one is
 * the first case: pain, symptom chips, a note, and a timestamp are not food
 * content, and the day she most needs to record how she feels is precisely the
 * day the gate is closed. Withholding the log during a flare would make the
 * feature useless exactly when it matters.
 *
 * That justification is load bearing and has one exception already carved out of
 * it: AttachFoodSection, inside the sheet, does render food content and carries
 * its own flare guard. If anything else here ever starts naming a food, a gram
 * value, or a meal, it moves inside FlareGate or grows a guard of its own.
 *
 * Sticky and IN FLOW rather than fixed, so it can never cover the disclaimer
 * footer (invariant 2). It hovers above the content while she scrolls and
 * settles above the footer at the end of the page.
 */
export function LogFeelingBar() {
  const { add, remove, persisted } = useSymptomLog()

  const [open, setOpen] = useState(false)
  /** The last saved entry, so the confirmation can offer an undo. */
  const [justSaved, setJustSaved] = useState<SymptomEntry | null>(null)

  function save(draft: SymptomDraft) {
    setJustSaved(add(draft))
    setOpen(false)
  }

  return (
    <div className="sticky bottom-0 z-10 border-t border-stone bg-paper px-5 pt-3 pb-3">
      <div className="mx-auto max-w-xl">
        {/*
          The confirmation sits above the button rather than replacing it, so
          the button never moves or disappears under her thumb.

          It names the time and offers an undo, and says nothing else. No
          "great job", no count of how many she has logged, nothing that would
          turn a record into a score.
        */}
        {justSaved !== null && (
          <div
            role="status"
            className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-stone bg-white/60 px-3 py-2 text-sm"
          >
            <span className="text-ink">
              {SYMPTOM_COPY.savedAt.replace(
                '{time}',
                new Date(justSaved.at).toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                }),
              )}
            </span>
            <button
              type="button"
              onClick={() => {
                remove(justSaved.id)
                setJustSaved(null)
              }}
              className="shrink-0 rounded-lg px-2 py-1 text-creek underline underline-offset-4 hover:text-ridge-deep"
            >
              {SYMPTOM_COPY.undo}
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setJustSaved(null)
            setOpen(true)
          }}
          className="w-full rounded-lg border-2 border-creek bg-creek px-4 py-3 font-semibold text-paper hover:border-ridge-deep hover:bg-ridge-deep"
        >
          {SYMPTOM_COPY.openButton}
        </button>

        {!persisted && (
          <p role="status" className="mt-2 mb-0 text-sm text-gold-text">
            {SYMPTOM_COPY.notPersisted}
          </p>
        )}
      </div>

      <SymptomSheet
        open={open}
        editing={null}
        onSave={save}
        onClose={() => setOpen(false)}
      />
    </div>
  )
}
