import { formatDayLong } from '../../lib/days.ts'
import { formatGrams } from '../../lib/rating.ts'
import type { PatternWindow } from '../../lib/patterns.ts'

/**
 * The chart, as a table, for anyone not looking at the picture.
 *
 * Visually hidden rather than absent. PatternChart's <svg> is aria-hidden, so
 * this is the only path a screen reader has to the same data, and it has to
 * carry the same guarantees.
 *
 * INVARIANT 5 HOLDS HERE TOO, AND THAT IS THE WHOLE REASON THIS IS HAND WRITTEN
 * RATHER THAN GENERATED FROM THE LOGGED DAYS.
 *
 * Every calendar day in the window gets a row, including the ones with nothing
 * in them, and those rows say "no entry" in words. Listing only the logged days
 * would be the screen reader equivalent of a chart that omits its gaps: the
 * quiet stretches would simply not exist, and a run of thirty unlogged days
 * would be indistinguishable from thirty days that never happened.
 *
 * "No entry" is also not "no symptoms". The three pain states are spelled out
 * separately below for the same reason they are drawn differently.
 */
export function ChartDataTable({ window }: { window: PatternWindow }) {
  return (
    <div className="sr-only">
      <table>
        <caption>
          Every day in this window. Days with no entry are listed as such, and are not
          days without symptoms.
        </caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">What you logged</th>
            <th scope="col">Food logged</th>
          </tr>
        </thead>
        <tbody>
          {window.days.map((dateKey, index) => {
            const symptomDay = window.symptomDays[index]
            const fatDay = window.fatDays[index]

            /* The three pain states, in words. */
            const symptomText =
              symptomDay === undefined || symptomDay.kind === 'gap'
                ? 'No entry'
                : symptomDay.worstPain === null
                  ? `${symptomDay.events.length} ${
                      symptomDay.events.length === 1 ? 'entry' : 'entries'
                    }, no pain number given`
                  : `Pain ${symptomDay.worstPain} at its highest, from ${
                      symptomDay.events.length
                    } ${symptomDay.events.length === 1 ? 'entry' : 'entries'}`

            const fatText =
              fatDay === undefined || fatDay.kind === 'gap'
                ? 'No food logged'
                : `${formatGrams(fatDay.grams)} across ${fatDay.entryCount} ${
                    fatDay.entryCount === 1 ? 'item' : 'items'
                  }`

            return (
              <tr key={dateKey}>
                <th scope="row">{formatDayLong(dateKey)}</th>
                <td>{symptomText}</td>
                <td>{fatText}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
