import { useId, useState } from 'react'
import {
  CHIP_LABELS,
  SYMPTOM_CHIPS,
  SYMPTOM_COPY,
  type SymptomChip,
} from '../../lib/symptomLog.ts'

/**
 * The multi-select symptom chips. Addendum section B, in its order.
 *
 * Toggle buttons rather than checkboxes, for the touch target. Each carries
 * aria-pressed so the state is in the accessibility tree rather than only in the
 * fill colour, which is invariant 8's principle applied outside the traffic
 * light: never colour alone.
 *
 * None of these is styled as a warning. There is no red chip, no alert icon, and
 * no ordering by severity. She is recording what is happening, and an app that
 * colour codes her symptoms back at her is interpreting them, which spec section
 * 1 rule 6 says it does not do.
 */

/** Addendum B: this one chip carries a small info tap. */
const STOOL_CHIP: SymptomChip = 'stool-greasy-floating-pale'

export function SymptomChips({
  selected,
  onToggle,
}: {
  selected: readonly SymptomChip[]
  onToggle: (chip: SymptomChip) => void
}) {
  const [showStoolInfo, setShowStoolInfo] = useState(false)
  const groupId = useId()
  const infoId = `${groupId}-stool-info`

  return (
    <div>
      <p id={groupId} className="mt-0 mb-2 font-semibold text-ridge-deep">
        {SYMPTOM_COPY.symptomsLabel}
      </p>

      <div role="group" aria-labelledby={groupId} className="flex flex-wrap gap-2">
        {SYMPTOM_CHIPS.map((chip) => {
          const on = selected.includes(chip)
          return (
            <button
              key={chip}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(chip)}
              /* min-h-11 is the 44px minimum touch target, addendum section C. */
              className={`min-h-11 rounded-full border-2 px-4 py-2 text-left ${
                on
                  ? 'border-ridge-deep bg-ridge-deep text-paper'
                  : 'border-stone bg-paper text-ink hover:border-creek'
              }`}
            >
              {CHIP_LABELS[chip]}
            </button>
          )
        })}
      </div>

      {/*
        Addendum B: "a small info tap that explains, in one plain sentence, that
        this can indicate fat malabsorption and is worth telling her doctor
        about. No alarm, no color, just information."

        Deliberately outside the chip rather than on it, so tapping to read does
        not also select the symptom.
      */}
      <button
        type="button"
        aria-expanded={showStoolInfo}
        aria-controls={infoId}
        onClick={() => setShowStoolInfo((open) => !open)}
        className="mt-2 rounded-lg px-2 py-2 text-left text-sm text-creek underline underline-offset-4 hover:text-ridge-deep"
      >
        {CHIP_LABELS[STOOL_CHIP]}: {SYMPTOM_COPY.stoolInfoLabel}
      </button>

      {showStoolInfo && (
        <p id={infoId} className="mt-1 mb-0 text-sm text-ink">
          {SYMPTOM_COPY.stoolInfo}
        </p>
      )}
    </div>
  )
}
