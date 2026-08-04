import { ENZYME_COPY } from '../../lib/enzymeLog.ts'
import { useSettings } from '../../state/settings.tsx'

/**
 * "I take pancreatic enzymes." Spec 5.7 makes the enzyme log conditional on it.
 *
 * THIS IS STANDING IN FOR A SETTINGS SCREEN THAT DOES NOT EXIST YET.
 *
 * The settings screen is Phase 1 scope and is still owed: the fat calculator's
 * inputs, the body stats, the manual override, and the 90 day soft prompt all
 * belong there and none of them have a UI. This one checkbox is here because
 * Phase 9 needs a way to turn the enzyme log on and building the rest of that
 * screen now would be building ahead of what was asked for.
 *
 * WHEN THE REAL SETTINGS SCREEN LANDS, THIS MOVES INTO IT AND THIS FILE GOES
 * AWAY. Nothing else should accumulate in the disclosure that holds it. Note
 * that the care team numbers are NOT a candidate to move: they are edited
 * inside When To Call on purpose, because that screen is reachable during a
 * flare and a settings screen showing her fat target cannot be. See the header
 * note in lib/careTeam.ts.
 *
 * No food content here, but it renders inside FlareGate anyway, because it sits
 * on the home screen and there is no reason for it to be reachable before
 * triage.
 */
export function EnzymeToggle() {
  const { settings, update } = useSettings()

  return (
    <div>
      <label className="flex min-h-11 cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={settings.takesEnzymes}
          onChange={(event) => update({ takesEnzymes: event.target.checked })}
          className="mt-1 size-5 shrink-0 accent-ridge-deep"
        />
        <span className="text-ink">
          {ENZYME_COPY.toggleLabel}
          {/*
            Whether she needs enzymes is her care team's call. The app offers a
            place to record them and says nothing about whether she should be
            taking them, which is the same line invariant 2 draws everywhere
            else.
          */}
          <span className="mt-0.5 block text-sm text-ridge-mid">{ENZYME_COPY.toggleHint}</span>
        </span>
      </label>
    </div>
  )
}
