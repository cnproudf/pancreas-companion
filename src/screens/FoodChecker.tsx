import { useMemo, useState } from 'react'
import { BudgetImpactLine } from '../components/foodChecker/BudgetImpactLine.tsx'
import { FoodSearchInput } from '../components/foodChecker/FoodSearchInput.tsx'
import { ModificationsSection } from '../components/foodChecker/ModificationsSection.tsx'
import { NearMissList } from '../components/foodChecker/NearMissList.tsx'
import { TargetPrompt } from '../components/foodChecker/TargetPrompt.tsx'
import { TrafficLightCard } from '../components/foodChecker/TrafficLightCard.tsx'
import { searchFoods, type FoodMatch } from '../lib/foodSearch.ts'
import { NEAR_MISS_SCORE, normalize } from '../lib/fuzzy.ts'
import { rateFoodForSettings } from '../lib/rateForSettings.ts'
import { useFoodLog } from '../state/foodLog.tsx'
import { useSettings } from '../state/settings.tsx'

/**
 * The food checker. Main spec section 5.1.
 *
 * Local data only. No Worker, no AI: that is Phase 11, and until it exists the
 * honest answer to an unknown food is "not in my list yet, here is the closest
 * thing I do have", never a spinner that goes nowhere.
 *
 * This screen renders inside FlareGate (see App.tsx), so in flare mode it does
 * not mount at all and triage comes first. Invariant 1.
 */

/** Enough alternates to correct a wrong first guess, few enough to scan. */
const RESULT_LIMIT = 5
const NEAR_MISS_LIMIT = 3

type SearchState =
  | { kind: 'idle' }
  | { kind: 'matched'; best: FoodMatch; alternates: FoodMatch[] }
  | { kind: 'near-miss'; candidates: FoodMatch[] }

export function FoodChecker() {
  const { settings } = useSettings()
  const { gramsUsedToday, logFood } = useFoodLog()

  const [query, setQuery] = useState('')
  // Set when she taps an alternate, so the card can follow her choice instead
  // of snapping back to whatever the raw query scores highest.
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [justLogged, setJustLogged] = useState<string | null>(null)

  const search = useMemo<SearchState>(() => {
    if (normalize(query) === '') return { kind: 'idle' }

    const matches = searchFoods(query, { limit: RESULT_LIMIT })
    if (matches.length > 0) {
      const picked = matches.find((match) => match.food.id === pickedId)
      const best = picked ?? (matches[0] as FoodMatch)
      return { kind: 'matched', best, alternates: matches.filter((m) => m.food.id !== best.food.id) }
    }

    // Nothing cleared MIN_MATCH_SCORE. searchFoods filters below its floor, so
    // finding the near misses means asking again with a lower one.
    return {
      kind: 'near-miss',
      candidates: searchFoods(query, { minScore: NEAR_MISS_SCORE, limit: NEAR_MISS_LIMIT }),
    }
  }, [query, pickedId])

  const result =
    search.kind === 'matched'
      ? rateFoodForSettings(settings, search.best.food, { gramsUsedToday })
      : null

  function onQueryChange(next: string) {
    setQuery(next)
    setPickedId(null)
    setJustLogged(null)
  }

  /** An alternate under a real match. Keep her query, just switch the card. */
  function onPick(match: FoodMatch) {
    setPickedId(match.food.id)
    setJustLogged(null)
  }

  /*
   * A near miss is different. Her query scored below MIN_MATCH_SCORE, so the
   * screen is not in the matched state and pinning an id would change nothing.
   * Promote the food she picked into the query instead, which both rates it and
   * shows her the spelling that works next time.
   */
  function onPickNearMiss(match: FoodMatch) {
    setQuery(match.food.name)
    setPickedId(match.food.id)
    setJustLogged(null)
  }

  /*
   * One concise live region rather than aria-live on the card itself. The card
   * rebuilds on every keystroke, and announcing the whole thing each time would
   * read a wall of text over her while she is still typing.
   */
  const announcement =
    search.kind === 'matched' && result !== null
      ? result.status === 'rated'
        ? `${search.best.food.name}. ${result.rating.presentation.label}. About ${result.rating.fatGrams} grams of fat.`
        : `${search.best.food.name}. About ${search.best.food.fatGrams} grams of fat. No daily target set yet.`
      : search.kind === 'near-miss'
        ? 'Not in my list yet.'
        : ''

  return (
    <section aria-labelledby="checker-heading" className="flex flex-col gap-4">
      <h2 id="checker-heading" className="mt-0 mb-0 text-lg">
        Can I eat this?
      </h2>

      <FoodSearchInput value={query} onChange={onQueryChange} />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {search.kind === 'idle' && (
        <p className="m-0 text-ink">
          Type a food and you will get a rating, the fat estimate, and how to make it easier.
        </p>
      )}

      {search.kind === 'near-miss' && (
        <NearMissList candidates={search.candidates} onPick={onPickNearMiss} />
      )}

      {search.kind === 'matched' && result !== null && result.status === 'rated' && (
        <TrafficLightCard food={search.best.food} rating={result.rating}>
          <BudgetImpactLine
            target={result.target}
            targetSource={result.targetSource}
            usedGrams={gramsUsedToday}
            itemGrams={result.rating.fatGrams}
          />

          <ModificationsSection rating={result.rating} />

          <div className="mt-4 border-t border-stone pt-3">
            <button
              type="button"
              onClick={() => {
                const entry = logFood(search.best.food)
                setJustLogged(entry.name)
              }}
              className="w-full rounded-lg border-2 border-ridge-deep bg-ridge-deep px-4 py-3 font-semibold text-paper hover:border-ridge-mid hover:bg-ridge-mid"
            >
              Log this
            </button>

            <p role="status" className="mt-2 mb-0 text-center text-sm text-ink">
              {justLogged === null ? '' : `Added to today. ${justLogged}.`}
            </p>
          </div>
        </TrafficLightCard>
      )}

      {/*
        No target yet, so there is nothing honest to rate against. The food, its
        estimate, and its modifications are still shown: those are facts about
        the food and do not depend on her numbers. Only the traffic light is
        withheld, and never faked.
      */}
      {search.kind === 'matched' && result !== null && result.status === 'no-target' && (
        <article
          aria-labelledby="untargeted-heading"
          className="rounded-lg border border-stone bg-white/50 p-5"
        >
          <h3 id="untargeted-heading" className="mt-0 mb-0 text-xl">
            {search.best.food.name}
          </h3>

          <p className="numeral mt-3 mb-0 text-5xl leading-none font-semibold text-ridge-deep">
            {search.best.food.fatGrams}
            <span className="ml-1 text-xl font-normal">g</span>
          </p>
          <p className="mt-1 mb-0 text-sm text-ink">
            Estimated fat for {search.best.food.servingDescription}. Brands and kitchens vary.
          </p>

          <TargetPrompt />
        </article>
      )}

      {search.kind === 'matched' && search.alternates.length > 0 && (
        <section aria-labelledby="alternates-heading">
          <h3 id="alternates-heading" className="mt-0 mb-2 text-base font-semibold text-ridge-deep">
            Did you mean
          </h3>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {search.alternates.map((match) => (
              <li key={match.food.id}>
                <button
                  type="button"
                  onClick={() => onPick(match)}
                  className="w-full rounded-lg border border-stone bg-paper px-4 py-2 text-left text-ink hover:border-creek"
                >
                  {match.food.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}
