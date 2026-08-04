import { useState } from 'react'
import { PREP_COPY } from '../../lib/appointmentPrep.ts'
import { PrepSheet } from './PrepSheet.tsx'

/**
 * Spec section 5.6's one button: "I have a doctor visit coming up."
 *
 * Lives on the Patterns tab, which is where her logged history already is, and
 * therefore inside FlareGate. That is the right side of the gate: the sheet it
 * opens names foods and prints gram values. See the header note in PrepSheet.
 */
export function AppointmentPrepButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border-2 border-ridge-deep bg-paper px-4 py-3 font-semibold text-ridge-deep hover:border-creek hover:text-creek"
      >
        {PREP_COPY.openAction}
      </button>

      {open && <PrepSheet onClose={() => setOpen(false)} />}
    </>
  )
}
