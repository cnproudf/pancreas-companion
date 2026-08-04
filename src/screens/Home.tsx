import { computeFatTarget, FLARE_CEILING_GRAMS } from '../lib/fatTarget.ts'
import { useSettings } from '../state/settings.tsx'
import { Ridgeline } from '../components/Ridgeline.tsx'

/**
 * Phase 1 placeholder home screen. It exists to prove the settings store and
 * the fat target calculator are wired together and persisting. The Daily Lift
 * card, the fat budget bar, and the food checker all land here in later phases.
 */
export function Home() {
  const { settings, persisted } = useSettings()
  const target = computeFatTarget(settings)

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
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
                  : 'A starting estimate based on your height, weight, age, and activity, kept inside the range the National Pancreas Foundation publishes.'}
            </p>
          </>
        )}

        <p className="mt-4 mb-0 text-sm text-ink">
          Spread this across 4 to 6 small meals rather than 2 or 3 large ones.
        </p>
      </section>

      <section
        aria-labelledby="soon-heading"
        className="relative overflow-hidden rounded-lg border border-stone p-5"
      >
        <div className="pointer-events-none absolute inset-x-0 bottom-0 opacity-15">
          <Ridgeline variant="band" />
        </div>
        <div className="relative">
          <h2 id="soon-heading" className="mt-0 mb-2 text-lg">
            Still being built
          </h2>
          <p className="m-0 text-ink">
            This is the skeleton. The food checker, your daily fat budget, and
            the Daily Lift are the next things to arrive.
          </p>
        </div>
      </section>

      {!persisted && (
        <p role="status" className="m-0 text-sm text-gold-text">
          This device is not letting the app save right now, so your settings may
          not be here next time.
        </p>
      )}
    </div>
  )
}
