import {
  hardDaysLineText,
  patternItemText,
  PATTERN_COPY,
  type PatternFindings,
} from '../../lib/patterns.ts'

/**
 * Foods that showed up before her hardest logged days.
 *
 * "Present all correlations as possible patterns worth mentioning to your
 * doctor. Never causal. A sample of one produces spurious associations
 * constantly, and the harm of her wrongly eliminating a food she loves is real."
 * Addendum section B.
 *
 * THIS IS THE MOST DANGEROUS SCREEN IN THE APP, so the framing is not a footnote
 * under the list. It is the heading, and it is the paragraph above the list, and
 * both are read before any food is named.
 *
 * Four guards stand behind what renders here, and three of them are not in this
 * file, which is the point. A rendering change cannot weaken them:
 *
 * 1. Every item carries the counter-evidence count, because beforeOtherDays is a
 *    REQUIRED field on PossiblePattern. A list that reports only the hits is the
 *    exact mechanism by which she stops eating something she loves for no
 *    reason, and patternItemText always renders both numbers.
 * 2. Nothing renders below the minimum-data gate.
 * 3. "Hardest logged days" is a capped minority selected by whole tie groups,
 *    and returns nothing rather than splitting a tie. See hardestLoggedDays.
 * 4. CAUSAL_PATTERN runs over every string in PATTERN_COPY in the test suite.
 *
 * Note the two different empty states. "Not enough logged" and "the pain does
 * not separate into a harder group" are different facts and get different
 * sentences, because telling her there is not enough data when there is plenty
 * would be false.
 */
export function PossiblePatterns({ findings }: { findings: PatternFindings }) {
  const hardDaysLine = hardDaysLineText(findings.hardDays)

  return (
    <section
      aria-labelledby="possible-patterns-heading"
      className="rounded-lg border border-stone bg-white/50 p-5"
    >
      <h2 id="possible-patterns-heading" className="mt-0 mb-2 text-lg">
        {PATTERN_COPY.patternsTitle}
      </h2>

      {/* Read before any food is named, always. */}
      <p className="mt-0 mb-4 text-ink">{PATTERN_COPY.patternsFraming}</p>

      {findings.belowGate ? (
        <p className="m-0 text-ink">{PATTERN_COPY.belowGate}</p>
      ) : findings.hardDays.dateKeys.length === 0 ? (
        <p className="m-0 text-ink">{PATTERN_COPY.noHardGroup}</p>
      ) : findings.patterns.length === 0 ? (
        <p className="m-0 text-ink">
          Nothing in your food log shows up often enough around those days to be worth
          listing.
        </p>
      ) : (
        <>
          {/*
            Names the group and the actual threshold, so she can audit the
            comparison rather than take it on faith.
          */}
          {hardDaysLine !== null && (
            <p className="numeral mt-0 mb-3 text-sm text-ridge-mid">{hardDaysLine}</p>
          )}

          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {findings.patterns.map((pattern) => (
              <li
                key={pattern.name}
                className="rounded-lg border border-stone bg-paper px-4 py-3"
              >
                {/*
                  One sentence carrying both numbers. Splitting the hits and the
                  counter-evidence into separate lines, or into a heading and a
                  detail, would let the second one be skipped on a glance.
                */}
                <p className="numeral m-0 text-ink">{patternItemText(pattern)}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
