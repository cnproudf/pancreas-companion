import { useId, useMemo } from 'react'
import { formatGrams } from '../../lib/rating.ts'
import {
  attachFood,
  foodsInAttachWindow,
  type AttachedFood,
} from '../../lib/symptomLog.ts'
import { useFoodLog } from '../../state/foodLog.tsx'
import { useSettings } from '../../state/settings.tsx'

/**
 * "Attach what I ate", addendum section B. The last 24 hours from the food log,
 * with checkboxes.
 *
 * INVARIANT 1. FLARE MODE OPENS THE TRIAGE SCREEN BEFORE ANY FOOD CONTENT.
 * ALWAYS. READ THIS BEFORE MOVING ANYTHING.
 *
 * The symptom sheet renders OUTSIDE FlareGate, and it has to: the day she most
 * needs to record how she feels is the day the gate is closed, and pain, chips,
 * a note, and a timestamp carry no food content whatsoever.
 *
 * This section is the exception inside that exception. It lists food names and
 * gram values, which is food content by any reading, so it carries its own flare
 * guard and renders nothing while the gate is closed. Same shape and same reason
 * as FatBudgetBar: the guard lives in the component rather than in the sheet's
 * markup so it travels with it, and anyone who later mounts this somewhere new
 * gets the rule for free.
 *
 * In flare mode the sheet renders without this and the entry is still completely
 * valid. The addendum is explicit that an entry carrying nothing but a timestamp
 * is valid and means "something was happening here".
 *
 * THE COST IS A DEFERRAL, NOT A DENIAL, and that is by design.
 *
 * foodsInAttachWindow anchors on the ENTRY'S OWN TIMESTAMP rather than on now.
 * So when she comes back to this entry later, from outside flare mode, she is
 * offered the 24 hours around when she actually felt unwell, not the 24 hours
 * around whenever she happened to reopen it. Nothing is lost by the guard, only
 * postponed. Do not "fix" this by anchoring on the current time.
 */
export function AttachFoodSection({
  at,
  attached,
  onChange,
}: {
  /** The entry's timestamp. The attach window is anchored on this, not on now. */
  at: string
  attached: readonly AttachedFood[]
  onChange: (next: AttachedFood[]) => void
}) {
  const { settings } = useSettings()
  const groupId = useId()

  /*
   * The whole log, not entriesToday. The attach window reaches back 24 hours
   * from an arbitrary moment, so it can span two days, or sit entirely in the
   * past when she is editing an old entry.
   */
  const { log } = useFoodLog()

  const candidates = useMemo(() => foodsInAttachWindow(log, at), [log, at])
  const attachedIds = useMemo(
    () => new Set(attached.map((food) => food.sourceEntryId)),
    [attached],
  )

  // The guard. Everything above this line is inert when the gate is closed.
  if (settings.currentMode === 'flare') return null

  if (candidates.length === 0) {
    return (
      <div>
        <p className="mt-0 mb-1 font-semibold text-ridge-deep">Attach what you ate</p>
        <p className="m-0 text-sm text-ridge-mid">
          Nothing logged in the 24 hours before this. You can come back and add it later if
          you want to.
        </p>
      </div>
    )
  }

  return (
    <div>
      <p id={groupId} className="mt-0 mb-1 font-semibold text-ridge-deep">
        Attach what you ate
      </p>
      <p className="mt-0 mb-2 text-sm text-ridge-mid">
        From the 24 hours before this entry. Optional, and you can change it later.
      </p>

      <ul role="group" aria-labelledby={groupId} className="m-0 flex list-none flex-col gap-1 p-0">
        {candidates.map((entry) => {
          const on = attachedIds.has(entry.id)
          return (
            <li key={entry.id}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-stone bg-paper px-3 py-2 hover:border-creek">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => {
                    onChange(
                      on
                        ? attached.filter((food) => food.sourceEntryId !== entry.id)
                        : [...attached, attachFood(entry)],
                    )
                  }}
                  className="size-5 accent-ridge-deep"
                />
                <span className="text-ink">
                  {entry.name}
                  <span className="block text-sm text-ridge-mid">
                    {entry.servingDescription === '' ? '' : `${entry.servingDescription}, `}
                    <span className="numeral">{formatGrams(entry.fatGrams)}</span>
                  </span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
