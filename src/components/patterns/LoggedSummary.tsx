import {
  daysLineText,
  fatLineText,
  hardestLineText,
  painLineText,
  PATTERN_COPY,
  type LoggedSummary as Summary,
} from '../../lib/patterns.ts'

/**
 * The summary lines above the chart.
 *
 * EVERY SENTENCE HERE NAMES ITS DENOMINATOR, and the components of that
 * guarantee are split deliberately: the arithmetic is in patterns.ts, where
 * daysLogged is the only divisor in LoggedSummary and windowDays exists to be
 * named rather than divided by, and the wording is in PATTERN_COPY, where
 * patterns.test.ts runs CALENDAR_RATE_PATTERN over every string and asserts
 * that each statistic line contains "you logged".
 *
 * Both halves are needed. A sentence can violate invariant 5 while the
 * arithmetic behind it is perfect: "your pain averaged 2 per day this month" is
 * false even when the average was computed over logged days only, because it
 * invites her to read the quiet days as calm ones.
 *
 * This component only renders what those two produce. It builds no strings of
 * its own and does no arithmetic, so there is nowhere here for an unguarded
 * sentence to appear.
 */
export function LoggedSummary({
  summary,
  isAllTime,
}: {
  summary: Summary
  isAllTime: boolean
}) {
  if (summary.daysLogged === 0 && summary.daysWithFoodLogged === 0) {
    return <p className="m-0 text-ink">{PATTERN_COPY.empty}</p>
  }

  const hardest = hardestLineText(summary)
  const fat = fatLineText(summary)

  return (
    <div className="flex flex-col gap-1">
      <p className="numeral m-0 text-ink">{daysLineText(summary, isAllTime)}</p>

      {summary.entryCount > 0 && (
        <p className="numeral m-0 text-sm text-ridge-mid">
          {PATTERN_COPY.entriesLine.replace('{entryCount}', String(summary.entryCount))}
        </p>
      )}

      {summary.daysLogged > 0 && (
        <p className="numeral mt-2 mb-0 text-ink">{painLineText(summary)}</p>
      )}

      {hardest !== null && <p className="numeral m-0 text-ink">{hardest}</p>}
      {fat !== null && <p className="numeral m-0 text-ink">{fat}</p>}
    </div>
  )
}
