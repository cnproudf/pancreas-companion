import { useCallback, useState } from 'react'
import { dateKey } from '../../lib/days.ts'
import {
  ENZYME_COPY,
  MEAL_SLOTS,
  SLOT_LABELS,
  readEnzymeLog,
  slotStatusText,
  stateFor,
  toggleSlot,
  writeEnzymeLog,
  type EnzymeState,
} from '../../lib/enzymeLog.ts'

/**
 * Which meal, and whether she took them. Spec section 5.7.
 *
 * Only rendered when settings.takesEnzymes is on; the caller owns that check.
 *
 * TWO BUTTONS PER SLOT RATHER THAN ONE CYCLING BUTTON.
 *
 * The state is three-valued (unrecorded, taken, not taken) and a single button
 * that cycles through three states is a guessing game: nothing on it says what
 * the next tap will do, and a screen reader announces a control whose meaning
 * changes under it. Two buttons make both states directly reachable, and
 * aria-pressed says which one is on. Tapping the pressed one clears it, which
 * is the route back to unrecorded.
 *
 * AN UNTAPPED SLOT SHOWS NOTHING, NOT A CROSS.
 *
 * Neither button is pressed and the status line says "not recorded". That is
 * invariant 5's reasoning applied here: a slot she did not tap is unknown, not
 * a dose she skipped, and she may show this log to her gastroenterologist. See
 * the header note in lib/enzymeLog.ts.
 */
export function EnzymeLog() {
  const [log, setLog] = useState(readEnzymeLog)
  const [persisted, setPersisted] = useState(true)

  const today = dateKey()

  const tap = useCallback((slot: (typeof MEAL_SLOTS)[number], state: EnzymeState) => {
    setLog((current) => {
      const next = toggleSlot(current, slot, state, dateKey())
      setPersisted(writeEnzymeLog(next))
      return next
    })
  }, [])

  return (
    <section
      aria-labelledby="enzyme-heading"
      data-testid="enzyme-log"
      className="rounded-lg border border-stone bg-white/50 p-5"
    >
      <h2 id="enzyme-heading" className="mt-0 mb-1 text-lg">
        {ENZYME_COPY.title}
      </h2>
      <p className="mt-0 mb-4 text-sm text-ridge-mid">{ENZYME_COPY.intro}</p>

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {MEAL_SLOTS.map((slot) => {
          const state = stateFor(log, slot, today)

          return (
            <li key={slot} className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-ridge-deep">{SLOT_LABELS[slot]}</span>

              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={() => tap(slot, 'taken')}
                  aria-pressed={state === 'taken'}
                  aria-label={`${SLOT_LABELS[slot]}, ${ENZYME_COPY.taken.toLowerCase()}`}
                  className={`min-h-11 rounded-lg border-2 px-3 py-2 text-sm font-semibold ${
                    state === 'taken'
                      ? 'border-laurel bg-laurel text-paper'
                      : 'border-stone bg-paper text-ink hover:border-creek'
                  }`}
                >
                  {ENZYME_COPY.taken}
                </button>
                <button
                  type="button"
                  onClick={() => tap(slot, 'not-taken')}
                  aria-pressed={state === 'not-taken'}
                  aria-label={`${SLOT_LABELS[slot]}, ${ENZYME_COPY.notTaken.toLowerCase()}`}
                  /*
                    Ridge deep rather than clay when pressed. Clay is the alert
                    colour in this app, and a dose she chose not to take is not
                    an alert. Invariant 10: never scold.
                  */
                  className={`min-h-11 rounded-lg border-2 px-3 py-2 text-sm font-semibold ${
                    state === 'not-taken'
                      ? 'border-ridge-deep bg-ridge-deep text-paper'
                      : 'border-stone bg-paper text-ink hover:border-creek'
                  }`}
                >
                  {ENZYME_COPY.notTaken}
                </button>
              </span>
            </li>
          )
        })}
      </ul>

      {/*
        The whole day in words, for a screen reader and for a glance. Slots she
        has not tapped read "not recorded", which is the state they are actually
        in.
      */}
      <p className="mt-4 mb-0 text-sm text-ridge-mid">
        {MEAL_SLOTS.map((slot) => slotStatusText(slot, stateFor(log, slot, today))).join('. ')}.
      </p>

      {!persisted && (
        <p role="status" className="mt-2 mb-0 text-sm text-gold-text">
          This device is not letting the app save right now.
        </p>
      )}
    </section>
  )
}
