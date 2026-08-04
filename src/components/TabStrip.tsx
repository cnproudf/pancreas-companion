/**
 * The app's five screens, as of Phase 9.
 *
 * A useState switch rather than a router. There are five destinations, no URLs
 * worth sharing (everything is on her device), and no back button behaviour to
 * get right, so a router would be a dependency bought for nothing. If a later
 * phase needs deep links this is the one place that changes.
 *
 * Rendered INSIDE FlareGate, so in flare mode the tabs disappear along with
 * everything else and triage is the whole screen. ALL FIVE destinations are
 * food content, so none may sit above the gate. Invariant 1.
 *
 * Patterns belongs in here for a reason worth stating: its chart carries her
 * logged fat intake as a background series and its entry list shows attached
 * food names. Workarounds names foods and gram values on every card, hers and
 * ours alike. Groceries is a list of foods. The symptom LOG is the opposite
 * case and lives above the gate, in AppShell, because pain and chips and a note
 * are not food content. Recording how she feels has to work on her worst day;
 * looking at what she ate can wait behind triage.
 *
 * The labels are short because they share a two-column grid on a phone. Five of
 * these will not fit one row at a readable size, and a horizontally scrolling
 * strip would put a destination off screen, so the row wraps below sm and opens
 * out to five across above it. "Can I eat this?" lost its question mark back
 * when three shared one row, and it stays lost for consistency.
 *
 * With five tabs the phone grid has an odd one out, so the last cell spans both
 * columns rather than leaving a hole beside it. An orphan half-width button at
 * the bottom of a 2x2 reads as a mistake.
 */

export type TabId = 'food' | 'restaurant' | 'patterns' | 'workarounds' | 'staples'

interface Tab {
  id: TabId
  label: string
}

const TABS: readonly Tab[] = [
  { id: 'food', label: 'Can I eat this' },
  { id: 'restaurant', label: 'Eating out' },
  { id: 'patterns', label: 'How I have been' },
  { id: 'workarounds', label: 'Foods I miss' },
  { id: 'staples', label: 'Groceries' },
]

export function TabStrip({
  active,
  onChange,
}: {
  active: TabId
  onChange: (id: TabId) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Screens"
      className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-5"
    >
      {TABS.map((tab) => {
        const selected = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            onClick={() => onChange(tab.id)}
            /*
              min-h-11 is the 44px minimum touch target from addendum section C.
              The grid cell supplies the width, so no flex-1 here. Padding
              tightens and the text drops a step below sm, where two labels share
              a row, so the longest one still fits without wrapping to three
              lines.
            */
            className={`min-h-11 w-full rounded-lg border-2 px-2 py-2 text-sm font-semibold last:col-span-2 sm:px-3 sm:text-base sm:last:col-span-1 ${
              selected
                ? 'border-ridge-deep bg-ridge-deep text-paper'
                : 'border-stone bg-paper text-ink hover:border-creek'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
