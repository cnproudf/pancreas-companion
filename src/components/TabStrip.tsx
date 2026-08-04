/**
 * The app's three screens, as of Phase 7.
 *
 * A useState switch rather than a router. There are three destinations, no URLs
 * worth sharing (everything is on her device), and no back button behaviour to
 * get right, so a router would be a dependency bought for nothing. If a later
 * phase needs deep links this is the one place that changes.
 *
 * Rendered INSIDE FlareGate, so in flare mode the tabs disappear along with
 * everything else and triage is the whole screen. ALL THREE destinations are
 * food content, so none may sit above the gate. Invariant 1.
 *
 * Patterns belongs in here for a reason worth stating: its chart carries her
 * logged fat intake as a background series and its entry list shows attached
 * food names. The symptom LOG is the opposite case and lives above the gate, in
 * AppShell, because pain and chips and a note are not food content. Recording
 * how she feels has to work on her worst day; looking at what she ate can wait
 * behind triage.
 *
 * The labels are short because three of them share one row at flex-1 on a
 * phone. "Can I eat this?" lost its question mark for the same reason.
 */

export type TabId = 'food' | 'restaurant' | 'patterns'

interface Tab {
  id: TabId
  label: string
}

const TABS: readonly Tab[] = [
  { id: 'food', label: 'Can I eat this' },
  { id: 'restaurant', label: 'Eating out' },
  { id: 'patterns', label: 'How I have been' },
]

export function TabStrip({
  active,
  onChange,
}: {
  active: TabId
  onChange: (id: TabId) => void
}) {
  return (
    <div role="tablist" aria-label="Screens" className="mb-6 flex gap-2">
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
              Padding tightens and the text drops a step at three tabs, so the
              longest label still fits on a narrow phone without wrapping to
              three lines.
            */
            className={`min-h-11 flex-1 rounded-lg border-2 px-2 py-2 text-sm font-semibold sm:px-4 sm:text-base ${
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
