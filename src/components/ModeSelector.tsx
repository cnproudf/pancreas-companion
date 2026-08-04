import { useSettings } from '../state/settings.tsx'
import { MODES, type Mode } from '../types.ts'

/**
 * Spec section 4. Three states, persisted, prominently displayed, changeable in
 * two taps from anywhere. Radio group semantics so a screen reader announces it
 * as one choice among three rather than three unrelated buttons.
 */

const MODE_COPY: Record<Mode, { label: string; hint: string }> = {
  stable: { label: 'Feeling good', hint: 'Normal thresholds' },
  recovering: {
    label: 'Being careful',
    hint: 'Coming out of something',
  },
  flare: { label: 'A bad time', hint: 'Having a hard day right now' },
}

export function ModeSelector() {
  const { settings, update } = useSettings()

  return (
    <div
      role="radiogroup"
      aria-label="How are you doing today?"
      className="grid grid-cols-3 gap-2"
    >
      {MODES.map((mode) => {
        const selected = settings.currentMode === mode
        const copy = MODE_COPY[mode]
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => update({ currentMode: mode })}
            className={[
              'flex min-h-[64px] flex-col items-center justify-center gap-0.5',
              'rounded-lg border-2 px-2 py-2 text-center transition-colors',
              selected
                ? 'border-ridge-deep bg-ridge-deep text-paper'
                : 'border-stone bg-paper text-ink hover:border-ridge-mid',
            ].join(' ')}
          >
            <span className="text-base leading-tight font-semibold">{copy.label}</span>
            <span
              className={`text-xs leading-tight ${selected ? 'text-paper/85' : 'text-ridge-mid'}`}
            >
              {copy.hint}
            </span>
          </button>
        )
      })}
    </div>
  )
}
