/**
 * The app's two screens, as of Phase 6.
 *
 * A useState switch rather than a router. There are two destinations, no URLs
 * worth sharing (everything is on her device), and no back button behaviour to
 * get right, so a router would be a dependency bought for nothing. If a later
 * phase needs deep links this is the one place that changes.
 *
 * Rendered INSIDE FlareGate, so in flare mode the tabs disappear along with
 * everything else and triage is the whole screen. Both destinations are food
 * content, so neither may sit above the gate. Invariant 1.
 */

export type TabId = 'food' | 'restaurant'

interface Tab {
  id: TabId
  label: string
}

const TABS: readonly Tab[] = [
  { id: 'food', label: 'Can I eat this?' },
  { id: 'restaurant', label: 'Eating out' },
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
            /* min-h-11 is the 44px minimum touch target from addendum section C. */
            className={`min-h-11 flex-1 rounded-lg border-2 px-4 py-2 font-semibold ${
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
