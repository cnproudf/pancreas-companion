import { useCallback, useState } from 'react'
import { dateKey } from '../../lib/days.ts'
import {
  GLASS_TARGET,
  HYDRATION_COPY,
  glassesOn,
  hydrationReadout,
  readHydration,
  tapGlass,
  writeHydration,
} from '../../lib/hydration.ts'

/**
 * Eight glasses she taps. Spec section 5.8, and nothing beyond it.
 *
 * A plain hook rather than a context provider. The criterion restaurants.tsx
 * sets out is whether several screens have to agree, and here exactly one does:
 * this row renders in one place, on the home screen. See symptomLog.tsx for the
 * opposite case, where two screens on either side of the flare gate had to
 * share a log.
 *
 * INVARIANT 8'S REASONING, APPLIED TO GLASSES. A filled glass differs from an
 * empty one by colour and shape alone, so the count is written out above the
 * row as well. She should never have to count icons to know where she is.
 *
 * No history, no average, no goal, no reminder, no streak. See the header note
 * in lib/hydration.ts for why that list is deliberate rather than unfinished.
 */
export function HydrationRow() {
  const [log, setLog] = useState(readHydration)
  const [persisted, setPersisted] = useState(true)

  /*
   * Read once per render rather than held in state. The day boundary moves on
   * its own at midnight, and deriving the key means the row follows it without
   * a timer, exactly as FatBudgetBar reads today's entries.
   */
  const today = dateKey()
  const count = glassesOn(log, today)

  const tap = useCallback(
    (n: number) => {
      setLog((current) => {
        const next = tapGlass(current, n, dateKey())
        setPersisted(writeHydration(next))
        return next
      })
    },
    [],
  )

  return (
    <section aria-labelledby="hydration-heading" data-testid="hydration">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="hydration-heading" className="mt-0 mb-0 text-lg">
          {HYDRATION_COPY.title}
        </h3>
        {/*
          The count in words. This is the readout, not a caption for the icons.
        */}
        <p className="numeral m-0 text-lg font-semibold text-ridge-deep">
          {hydrationReadout(count)}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {Array.from({ length: GLASS_TARGET }, (_, index) => index + 1).map((n) => {
          const filled = n <= count
          /*
            Tapping the glass that is already the count clears the day, so the
            control needs to say that rather than repeating the set label. This
            is the only route back from one glass to none.
          */
          const label =
            n === count
              ? HYDRATION_COPY.clearLabel
              : HYDRATION_COPY.glassLabel
                  .replace('{n}', String(n))
                  .replace('{target}', String(GLASS_TARGET))

          return (
            <button
              key={n}
              type="button"
              onClick={() => tap(n)}
              aria-label={label}
              aria-pressed={filled}
              className={`flex size-11 items-center justify-center rounded-lg border-2 ${
                filled ? 'border-creek bg-creek text-paper' : 'border-stone bg-paper text-stone'
              } hover:border-creek`}
            >
              {/*
                A tumbler. Filled ones carry the creek colour AND a solid body;
                empty ones are an outline. Two signals, not one, for the same
                reason ratings never rest on colour alone.
              */}
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6">
                <path
                  d="M6 3h12l-1.4 17.1A1 1 0 0 1 15.6 21H8.4a1 1 0 0 1-1-0.9L6 3z"
                  fill={filled ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )
        })}
      </div>

      <p className="mt-2 mb-0 text-sm text-ridge-mid">{HYDRATION_COPY.note}</p>

      {!persisted && (
        <p role="status" className="mt-2 mb-0 text-sm text-gold-text">
          This device is not letting the app save right now.
        </p>
      )}
    </section>
  )
}
