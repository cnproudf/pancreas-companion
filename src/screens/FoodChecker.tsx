import { useMemo, useState } from 'react'
import { AiEstimateCard } from '../components/ai/AiEstimateCard.tsx'
import { AiLookupButton } from '../components/ai/AiLookupButton.tsx'
import { AiPending } from '../components/ai/AiPending.tsx'
import { BudgetImpactLine } from '../components/foodChecker/BudgetImpactLine.tsx'
import { FoodSearchInput } from '../components/foodChecker/FoodSearchInput.tsx'
import { ModificationsSection } from '../components/foodChecker/ModificationsSection.tsx'
import { NearMissList } from '../components/foodChecker/NearMissList.tsx'
import { TargetPrompt } from '../components/foodChecker/TargetPrompt.tsx'
import { TrafficLightCard } from '../components/foodChecker/TrafficLightCard.tsx'
import { computeFatTarget } from '../lib/fatTarget.ts'
import { searchFoods, type FoodMatch } from '../lib/foodSearch.ts'
import { NEAR_MISS_SCORE, normalize } from '../lib/fuzzy.ts'
import { rateFoodForSettings } from '../lib/rateForSettings.ts'
import { useAiLookup } from '../state/useAiLookup.ts'
import { useFoodLog } from '../state/foodLog.tsx'
import { useSettings } from '../state/settings.tsx'

/**
 * The food checker. Main spec section 5.1.
 *
 * Local data first, always. The Worker is asked ONLY when nothing in the local
 * dataset cleared MIN_MATCH_SCORE, which is the 'near-miss' branch below. A
 * local hit never triggers a call: 211 hand authored entries with real serving
 * descriptions beat a model's guess at the same food, and spending a request to
 * second guess them would be slower and worse.
 *
 * When the Worker is unreachable, slow, or says something the copy guards
 * refuse, this screen is exactly what it was for the first ten phases: "not in
 * my list yet, here is the closest thing I do have". Invariant 7, and the reason
 * NearMissList still renders above the AI block rather than being replaced by it.
 *
 * This screen renders inside FlareGate (see App.tsx), so in flare mode it does
 * not mount at all and triage comes first. Invariant 1. The lookup carries its
 * own guard on top of that, because a request already in flight does not care
 * that its component unmounted. See useAiLookup.ts.
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
  const { gramsUsedToday, logFood, logEstimate } = useFoodLog()
  const ai = useAiLookup()

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

  /*
   * The target, for the Worker payload. computeFatTarget is already the one
   * source of T, and rateForSettings calls it too; this reads it directly
   * because the payload needs the number even in the branches where there is no
   * rating on screen.
   *
   * When there is no target there is nothing honest to send. The Worker's prompt
   * rates against a remaining budget, and a made up 30 would produce a
   * confident traffic light built on a number she never gave us. So the lookup
   * is withheld entirely, the same way the local card withholds its rating.
   */
  const target = computeFatTarget(settings)
  const lookupAvailable = target.source !== 'incomplete'

  function onQueryChange(next: string) {
    setQuery(next)
    setPickedId(null)
    setJustLogged(null)
    // A new query means the old answer is about to be wrong. Drops any result
    // on screen and aborts anything still in flight.
    ai.reset()
  }

  function runLookup() {
    if (target.source === 'incomplete') return
    ai.run({
      query,
      queryType: 'food',
      mode: settings.currentMode,
      dailyTarget: target.grams,
      remainingBudget: Math.max(0, target.grams - gramsUsedToday),
      context: { settings, gramsUsedToday, query },
    })
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

      {/*
        THE ONLY PLACE THE WORKER IS ASKED ABOUT A FOOD.

        This branch is reached only when searchFoods returned nothing at
        MIN_MATCH_SCORE. The local answer renders first and stays: whatever comes
        back, NearMissList is still above it with the closest things the dataset
        does have.
      */}
      {search.kind === 'near-miss' && (
        <>
          <NearMissList candidates={search.candidates} onPick={onPickNearMiss} />

          {lookupAvailable && (
            <AiLookupButton
              onClick={runLookup}
              disabled={ai.state.kind === 'pending'}
              hasResult={ai.state.kind === 'ready'}
            />
          )}

          {ai.state.kind === 'pending' && <AiPending />}

          {ai.state.kind === 'ready' && (
            <AiEstimateCard advice={ai.state.advice}>
              {/*
                Logging an estimate. Invariant: this must never enter the log
                with the same standing as a dataset entry, so it goes through
                logEstimate, which writes foodId null and aiEstimated true.

                Withheld when there is no gram value, because there would be
                nothing to log but a name and a zero, and a zero would quietly
                understate her day.
              */}
              {ai.state.advice.fatGrams !== null && (
                <div className="mt-4 border-t border-stone pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      const grams = ai.state.kind === 'ready' ? ai.state.advice.fatGrams : null
                      if (grams === null) return
                      const entry = logEstimate({
                        name: query,
                        servingDescription:
                          ai.state.kind === 'ready' ? ai.state.advice.servingAssumed : '',
                        fatGrams: grams,
                      })
                      setJustLogged(entry.name)
                    }}
                    className="w-full rounded-lg border-2 border-ridge-mid bg-paper px-4 py-3 font-semibold text-ridge-deep hover:border-ridge-deep hover:bg-white/50"
                  >
                    Log this estimate
                  </button>

                  <p role="status" className="mt-2 mb-0 text-center text-sm text-ink">
                    {justLogged === null ? '' : `Added to today as an estimate. ${justLogged}.`}
                  </p>
                </div>
              )}
            </AiEstimateCard>
          )}
        </>
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
