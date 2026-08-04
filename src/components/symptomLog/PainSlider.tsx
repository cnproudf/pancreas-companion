import { useId } from 'react'
import { PAIN_MAX, PAIN_MIN, SYMPTOM_COPY } from '../../lib/symptomLog.ts'

/**
 * The 0 to 10 pain slider, skippable.
 *
 * SKIPPING IS AN EXPLICIT CONTROL, NOT AN ABSENT INTERACTION, and that is worth
 * the extra button.
 *
 * A slider that starts at 0 and reports 0 when untouched cannot tell "no pain
 * right now" apart from "I did not feel like answering". Those are different
 * facts, they render differently on the chart, and the whole three state design
 * in patterns.ts depends on the difference arriving here intact. So null is a
 * state she chooses, and it is the state the sheet opens in.
 *
 * The value is also shown as a numeral, because a thumb position on a track is
 * not a reading, and invariant 8's principle applies: never position alone.
 */
export function PainSlider({
  value,
  onChange,
}: {
  value: number | null
  onChange: (value: number | null) => void
}) {
  const id = useId()
  const skipped = value === null

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="font-semibold text-ridge-deep">
          {SYMPTOM_COPY.painLabel}
        </label>

        <button
          type="button"
          onClick={() => onChange(skipped ? 5 : null)}
          className="rounded-lg px-2 py-1 text-sm text-creek underline underline-offset-4 hover:text-ridge-deep"
        >
          {skipped ? SYMPTOM_COPY.painSkipAction : SYMPTOM_COPY.painUnskipAction}
        </button>
      </div>

      {/*
        The readout, in words when there is no number. "No number given" rather
        than a dash or a 0, so what is on screen matches what gets stored.
      */}
      <p
        className={`numeral mt-1 mb-2 leading-none ${
          skipped ? 'text-lg text-ridge-mid' : 'text-4xl font-semibold text-ridge-deep'
        }`}
      >
        {skipped ? SYMPTOM_COPY.painSkipped : value}
      </p>

      <input
        id={id}
        type="range"
        min={PAIN_MIN}
        max={PAIN_MAX}
        step={1}
        /*
          A skipped slider still needs a thumb somewhere, so it parks at the
          middle while the control is visually and semantically disabled. It
          cannot report that position: onChange is the only way a number is
          produced, and it is unreachable while disabled.
        */
        value={value ?? 5}
        disabled={skipped}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-describedby={`${id}-ends`}
        className="w-full accent-ridge-deep disabled:opacity-40"
      />

      <div id={`${id}-ends`} className="flex justify-between text-sm text-ridge-mid">
        <span>0, nothing right now</span>
        <span>10, the worst it gets</span>
      </div>

      {skipped && (
        <p className="mt-2 mb-0 text-sm text-ridge-mid">
          You can leave this alone. An entry with no number is still worth having.
        </p>
      )}
    </div>
  )
}
