import { useState, type FormEvent } from 'react'
import { useSettings } from '../../state/settings.tsx'

/**
 * Shown when there is no daily target yet, so the traffic light has nothing to
 * measure against.
 *
 * Writes provisionalFatTarget, never dailyFatTarget. That distinction is the
 * whole reason the two fields exist: dailyFatTarget means a number from her care
 * team, and a placeholder she typed in to get the app working is not that. The
 * copy has to match the field, so it says plainly that this is a starting number
 * and does not claim precedence, because it has none.
 */
export function TargetPrompt() {
  const { update } = useSettings()
  const [value, setValue] = useState('')

  const parsed = Number(value.trim())
  const isUsable = value.trim() !== '' && Number.isFinite(parsed) && parsed > 0

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!isUsable) return
    update({ provisionalFatTarget: parsed })
  }

  return (
    <form
      onSubmit={onSubmit}
      aria-labelledby="target-prompt-heading"
      className="mt-4 border-t border-stone pt-3"
    >
      <h4 id="target-prompt-heading" className="mt-0 mb-2 text-base font-semibold text-ridge-deep">
        I need a daily target first
      </h4>

      <p className="mt-0 mb-3 text-ink">
        A starting number so I can rate things. Ask your doctor or dietitian for your real target
        and we will replace this.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="provisional-target" className="text-sm text-ink">
            Grams of fat per day
          </label>
          <input
            id="provisional-target"
            type="number"
            inputMode="decimal"
            min="1"
            step="1"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="numeral w-32 rounded-lg border border-stone bg-paper px-3 py-2 text-ink"
          />
        </div>

        <button
          type="submit"
          disabled={!isUsable}
          className="rounded-lg border-2 border-ridge-deep bg-ridge-deep px-4 py-2 font-semibold text-paper disabled:border-stone disabled:bg-stone disabled:text-ridge-mid"
        >
          Use this for now
        </button>
      </div>
    </form>
  )
}
