import { useMemo, useState } from 'react'
import { ChartLegend } from '../components/patterns/ChartLegend.tsx'
import { EntryHistory } from '../components/patterns/EntryHistory.tsx'
import { LoggedSummary } from '../components/patterns/LoggedSummary.tsx'
import { PatternChart } from '../components/patterns/PatternChart.tsx'
import { PossiblePatterns } from '../components/patterns/PossiblePatterns.tsx'
import { SymptomSheet } from '../components/symptomLog/SymptomSheet.tsx'
import { buildMarks } from '../lib/chartGeometry.ts'
import {
  buildWindow,
  findPatterns,
  PATTERN_COPY,
  spanFor,
  summarize,
  WINDOW_CHOICES,
  type WindowChoice,
} from '../lib/patterns.ts'
import type { SymptomEntry } from '../lib/symptomLog.ts'
import { useFoodLog } from '../state/foodLog.tsx'
import { useSymptomLog } from '../state/symptomLog.tsx'

/**
 * The pattern view. Addendum section B.
 *
 * THIS SCREEN RENDERS INSIDE FlareGate, and it has to. The chart's background
 * series is her logged fat intake, and the entry history shows attached food
 * names, so this is food content and cannot appear above the triage screen.
 * Invariant 1.
 *
 * That is the opposite call from the log sheet, which renders outside the gate,
 * and the two together are the seam this phase turns on: recording how she feels
 * carries no food content and must work on her worst day, while looking at
 * patterns in what she ate is food content and waits behind triage.
 *
 * The ordering here is deliberate. The chart and its summary come first, then
 * the possible patterns, then her entries. The correlation list is the most
 * dangerous thing on this screen and sits below the picture of how sparse her
 * data actually is, so she reaches it having already seen how much of the window
 * is gaps.
 */
export function Patterns() {
  const { log: symptomLog, entries, update, remove, restore } = useSymptomLog()
  const { log: foodLog, todayKey } = useFoodLog()

  const [choice, setChoice] = useState<WindowChoice | 'all'>(30)
  const [editing, setEditing] = useState<SymptomEntry | null>(null)

  const window = useMemo(
    () => buildWindow(spanFor(choice, symptomLog, foodLog, todayKey), symptomLog, foodLog),
    [choice, symptomLog, foodLog, todayKey],
  )

  const summary = useMemo(() => summarize(window), [window])
  const findings = useMemo(() => findPatterns(window, foodLog), [window, foodLog])
  const fatMax = useMemo(() => buildMarks(window).fatMax, [window])

  const nothingLogged = summary.daysLogged === 0 && summary.daysWithFoodLogged === 0

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <section
        aria-labelledby="patterns-heading"
        className="rounded-lg border border-stone bg-white/50 p-5"
      >
        <h2 id="patterns-heading" className="mt-0 mb-3 text-lg">
          {PATTERN_COPY.title}
        </h2>

        <WindowPicker value={choice} onChange={setChoice} />

        <div className="mt-4">
          <LoggedSummary summary={summary} isAllTime={choice === 'all'} />
        </div>

        {/*
          No chart when there is nothing on it. An empty grid with a full window
          of hatching would be technically correct and useless, and the summary
          above already says the honest thing in words.
        */}
        {!nothingLogged && (
          <div className="mt-5">
            <PatternChart window={window} />
            <ChartLegend fatMax={fatMax} />
          </div>
        )}
      </section>

      {!nothingLogged && <PossiblePatterns findings={findings} />}

      <EntryHistory
        entries={entries}
        onEdit={setEditing}
        onRemove={remove}
        onRestore={restore}
      />

      {/*
        The same sheet the sticky bar opens, reused for corrections. Reopening an
        old entry here is also how a food attachment deferred during a flare gets
        made later: AttachFoodSection anchors its 24 hour window on the entry's
        own timestamp, not on now.
      */}
      <SymptomSheet
        open={editing !== null}
        editing={editing}
        onSave={(draft) => {
          if (editing !== null) update(editing.id, draft)
          setEditing(null)
        }}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}

function WindowPicker({
  value,
  onChange,
}: {
  value: WindowChoice | 'all'
  onChange: (value: WindowChoice | 'all') => void
}) {
  const options: { value: WindowChoice | 'all'; label: string }[] = [
    ...WINDOW_CHOICES.map((choice) => ({ value: choice.days as WindowChoice, label: choice.label })),
    { value: 'all', label: 'Everything' },
  ]

  return (
    <div role="group" aria-label="How far back to look" className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`min-h-11 rounded-lg border-2 px-4 py-2 text-sm font-semibold ${
              selected
                ? 'border-ridge-deep bg-ridge-deep text-paper'
                : 'border-stone bg-paper text-ink hover:border-creek'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
