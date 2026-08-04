import { EnzymeLog } from '../components/enzymes/EnzymeLog.tsx'
import { EnzymeToggle } from '../components/enzymes/EnzymeToggle.tsx'
import { HydrationRow } from '../components/hydration/HydrationRow.tsx'
import { computeFatTarget, FLARE_CEILING_GRAMS } from '../lib/fatTarget.ts'
import { useSettings } from '../state/settings.tsx'
import { FoodChecker } from './FoodChecker.tsx'

/**
 * The home screen: hydration, her daily fat target, the food checker, and the
 * enzyme log when she takes enzymes.
 *
 * Neither the budget bar nor the Daily Lift is here. Both live in AppShell, for
 * different reasons: the bar so it is present on every screen once there is
 * more than one, and the Lift because it has to sit above FlareGate. There is
 * no router yet, so screens are composed rather than navigated to.
 *
 * Hydration is first on the screen and deliberately so. It is the cheapest
 * thing on the page to act on, it matters most on the days she feels worst, and
 * spec 5.8 is blunt about how little it should cost to build or to use.
 */
export function Home() {
  const { settings, persisted } = useSettings()
  const target = computeFatTarget(settings)

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      {/*
        Inside FlareGate, along with the rest of this screen. Glasses of water
        are not food guidance, so this could sit above the gate on the letter of
        the rule, but there is no reason for it to: nothing about the triage
        moment is improved by a hydration row beside it.
      */}
      <section className="rounded-lg border border-stone bg-white/50 p-5">
        <HydrationRow />
      </section>

      <section
        aria-labelledby="target-heading"
        className="rounded-lg border border-stone bg-white/50 p-5"
      >
        <h2 id="target-heading" className="mt-0 mb-1 text-lg">
          Your daily fat target
        </h2>

        {target.source === 'incomplete' ? (
          <>
            <p className="numeral m-0 text-5xl leading-none font-semibold text-ridge-mid">
              &ndash;
            </p>
            <p className="mt-3 mb-0 text-ink">
              Once you add your height, weight, and age in settings, a starting
              estimate appears here. You can also enter a number from your care
              team, which always wins.
            </p>
          </>
        ) : (
          <>
            <p className="numeral m-0 text-6xl leading-none font-semibold text-ridge-deep">
              {target.grams}
              <span className="ml-1 text-2xl font-normal">g</span>
            </p>
            <p className="mt-2 mb-0 text-ink">
              {target.source === 'override'
                ? 'This is the number you entered from your care team. It takes precedence over the estimate.'
                : target.source === 'flare-ceiling'
                  ? `A working ceiling of ${FLARE_CEILING_GRAMS} grams, not a goal. The schedule for advancing your diet comes from your doctor.`
                  : target.source === 'provisional'
                    ? /*
                        A number she typed in herself so the app had something to
                        work with. Saying anything stronger would misstate where
                        it came from.
                      */
                      'A starting number you entered. Add your height, weight, and age and this becomes a real estimate, and a number from your care team replaces it entirely.'
                    : 'A starting estimate based on your height, weight, age, and activity, kept inside the range the National Pancreas Foundation publishes.'}
            </p>
          </>
        )}

        <p className="mt-4 mb-0 text-sm text-ink">
          Spread this across 4 to 6 small meals rather than 2 or 3 large ones.
        </p>
      </section>

      {/*
        The checker sits in its own bordered card rather than inheriting the
        page background, so the result card reads as one object on a small
        screen. No ridgeline here: addendum section C keeps this screen clean.
      */}
      <section className="rounded-lg border border-stone bg-white/50 p-5">
        <FoodChecker />
      </section>

      {/* Spec 5.7: only appears if she takes pancreatic enzymes. */}
      {settings.takesEnzymes && <EnzymeLog />}

      {/*
        THE PLACEHOLDER FOR A SETTINGS SCREEN THAT DOES NOT EXIST YET.

        The real one is Phase 1 scope and is still owed: the fat calculator's
        inputs, the body stats, the manual override, and the 90 day soft prompt
        all belong there and none of them have a UI. This disclosure holds the
        one control Phase 9 needed, and it should not accumulate a second.

        Collapsed by default and quiet, because a settings affordance she does
        not need should not compete with the checker above it.
      */}
      <details className="rounded-lg border border-stone bg-white/50 p-4">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold text-creek">
          Settings
        </summary>
        <div className="mt-3 border-t border-stone pt-3">
          <EnzymeToggle />
        </div>
      </details>

      {!persisted && (
        <p role="status" className="m-0 text-sm text-gold-text">
          This device is not letting the app save right now, so your settings may
          not be here next time.
        </p>
      )}
    </div>
  )
}
