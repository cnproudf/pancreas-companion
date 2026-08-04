import { useMemo, useState } from 'react'
import { AiEstimateCard } from '../components/ai/AiEstimateCard.tsx'
import { AiLookupButton } from '../components/ai/AiLookupButton.tsx'
import { AiPending } from '../components/ai/AiPending.tsx'
import { ChainHit } from '../components/restaurant/ChainHit.tsx'
import { CuisineGuidance } from '../components/restaurant/CuisineGuidance.tsx'
import { CuisinePicker } from '../components/restaurant/CuisinePicker.tsx'
import { RestaurantNameInput } from '../components/restaurant/RestaurantNameInput.tsx'
import { SavedRestaurantList } from '../components/restaurant/SavedRestaurantList.tsx'
import { SaveRestaurantForm } from '../components/restaurant/SaveRestaurantForm.tsx'
import { ScriptLine } from '../components/restaurant/ScriptLine.tsx'
import { UniversalStrategy } from '../components/restaurant/UniversalStrategy.tsx'
import {
  CUISINE_PLAYBOOKS,
  PLAYBOOK_BY_CUISINE,
  UNIVERSAL_PLAYBOOK,
} from '../lib/restaurantPlaybook.ts'
import { computeFatTarget } from '../lib/fatTarget.ts'
import { findChain } from '../lib/restaurantSearch.ts'
import { findByName } from '../lib/savedRestaurants.ts'
import { useAiLookup } from '../state/useAiLookup.ts'
import { useFoodLog } from '../state/foodLog.tsx'
import { useSavedRestaurants } from '../state/restaurants.tsx'
import { useSettings } from '../state/settings.tsx'
import type { Cuisine } from '../types.ts'

/**
 * The restaurant helper. Main spec section 5.2.
 *
 * THE WORKER IS ASKED AFTER THE LOCAL PLAYBOOK, NEVER INSTEAD OF IT. Spec 5.2
 * puts AI suggestions at position five of its output ordering, under everything
 * local, and that ordering is the whole policy: the universal strategy is at
 * position one because it is the only part that works at a restaurant nobody has
 * heard of, and it is true whether or not a model ever answers. So the lookup
 * button sits below the cuisine guidance and the script line, and the card it
 * produces sits below that.
 *
 * Unlike the food checker, this one is offered even when a chain matched. A
 * chain hit gives her a nutrition PDF and a cuisine, not a dish, and "what
 * should I order here" is still unanswered.
 *
 * No log button on the card. The recommendation lives inside prose, so there is
 * no honest name and serving to write into the food log; on the food checker
 * there is, because she typed the name herself.
 *
 * This screen renders inside FlareGate (see App.tsx). It is food content, so in
 * flare mode it does not mount at all and triage comes first. Invariant 1, with
 * the in-flight half handled in useAiLookup.ts.
 */
export function RestaurantHelper() {
  const { saved, save, update, remove, persisted } = useSavedRestaurants()
  const { settings } = useSettings()
  const { gramsUsedToday } = useFoodLog()
  const ai = useAiLookup()

  const [name, setName] = useState('')
  /*
   * Null means "she has not chosen", which is different from "she chose nothing".
   * Once she touches the picker, her choice wins over the chain match for as long
   * as the name stays put. Same shape as pickedId in FoodChecker.
   */
  const [chosenCuisine, setChosenCuisine] = useState<Cuisine | null>(null)
  const [cuisineIsHers, setCuisineIsHers] = useState(false)

  const chainMatch = useMemo(() => (name.trim() === '' ? null : findChain(name)), [name])

  const cuisine = cuisineIsHers ? chosenCuisine : (chainMatch?.chain.cuisine ?? chosenCuisine)
  const playbook = cuisine === null ? null : (PLAYBOOK_BY_CUISINE.get(cuisine) ?? null)

  /*
   * The cuisine script when there is one, the universal script otherwise. There
   * is always something to copy, because "no oil, no butter, sauce on the side"
   * is true everywhere and she should never reach an empty box.
   */
  const script = playbook?.scriptLine ?? UNIVERSAL_PLAYBOOK?.scriptLine ?? ''

  const alreadySaved = findByName(saved, name) !== null

  /* Same policy as the food checker: no target, nothing honest to rate against. */
  const target = computeFatTarget(settings)
  const lookupAvailable = target.source !== 'incomplete' && name.trim() !== ''

  function onNameChange(next: string) {
    setName(next)
    // A new restaurant means the chain match gets to speak again.
    setCuisineIsHers(false)
    setChosenCuisine(null)
    ai.reset()
  }

  function runLookup() {
    if (target.source === 'incomplete') return
    ai.run({
      query: name,
      queryType: 'restaurant',
      mode: settings.currentMode,
      dailyTarget: target.grams,
      remainingBudget: Math.max(0, target.grams - gramsUsedToday),
      context: { settings, gramsUsedToday, query: name },
    })
  }

  function onCuisineChange(next: Cuisine | null) {
    setChosenCuisine(next)
    setCuisineIsHers(true)
  }

  /*
   * One short live region rather than aria-live on the guidance itself, for the
   * reason spelled out in FoodChecker: the guidance rebuilds on every keystroke,
   * and announcing three full lists each time would read a wall of text over her
   * while she is still typing.
   */
  const announcement =
    playbook === null ? '' : `${playbook.label} guidance. Safe bets, what to skip, what to ask for.`

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      {/*
        Universal first, always, before any cuisine is chosen and after. Spec
        section 5.2 puts it at position one because it is the only part that
        works at a restaurant the playbook has never heard of.
      */}
      {UNIVERSAL_PLAYBOOK !== null && <UniversalStrategy playbook={UNIVERSAL_PLAYBOOK} />}

      <section
        aria-labelledby="where-heading"
        className="flex flex-col gap-4 rounded-lg border border-stone bg-white/50 p-5"
      >
        <h2 id="where-heading" className="mt-0 mb-0 text-lg">
          Where are you going?
        </h2>

        <RestaurantNameInput value={name} onChange={onNameChange} />

        {chainMatch !== null && (
          <ChainHit
            chain={chainMatch.chain}
            label={PLAYBOOK_BY_CUISINE.get(chainMatch.chain.cuisine)?.label ?? chainMatch.chain.cuisine}
            followed={cuisine === chainMatch.chain.cuisine}
          />
        )}

        <CuisinePicker value={cuisine} playbooks={CUISINE_PLAYBOOKS} onChange={onCuisineChange} />

        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>

        {playbook === null && (
          <p className="m-0 text-ink">
            Pick the kind of food and you will get the safe bets, what to skip, and what to
            ask for. The strategies above work either way.
          </p>
        )}
      </section>

      {playbook !== null && <CuisineGuidance playbook={playbook} />}

      {script !== '' && <ScriptLine script={script} />}

      {/*
        Position five in spec 5.2's output ordering, and everything above it has
        already rendered. If the Worker never answers, this block is simply
        absent and the screen is what it was in Phase 8.
      */}
      {lookupAvailable && (
        <AiLookupButton
          onClick={runLookup}
          disabled={ai.state.kind === 'pending'}
          hasResult={ai.state.kind === 'ready'}
        />
      )}

      {ai.state.kind === 'pending' && <AiPending />}
      {ai.state.kind === 'ready' && <AiEstimateCard advice={ai.state.advice} />}

      <SaveRestaurantForm
        name={name}
        cuisine={cuisine}
        cuisineLabel={playbook?.label ?? null}
        alreadySaved={alreadySaved}
        onSave={(notes) => save({ name, cuisine, notes })}
      />

      <SavedRestaurantList
        saved={saved}
        labelFor={(value) => (value === null ? null : (PLAYBOOK_BY_CUISINE.get(value)?.label ?? null))}
        onUse={(restaurant) => {
          setName(restaurant.name)
          setChosenCuisine(restaurant.cuisine)
          // Her saved cuisine is a choice she already made. It outranks whatever
          // the chain matcher would say about the same name.
          setCuisineIsHers(true)
        }}
        onUpdateNotes={(id, notes) => {
          const existing = saved.find((restaurant) => restaurant.id === id)
          if (existing === undefined) return
          update(id, { name: existing.name, cuisine: existing.cuisine, notes })
        }}
        onRemove={remove}
      />

      {!persisted && (
        <p role="status" className="m-0 text-sm text-gold-text">
          This device is not letting the app save right now, so your places may not be here
          next time.
        </p>
      )}
    </div>
  )
}
