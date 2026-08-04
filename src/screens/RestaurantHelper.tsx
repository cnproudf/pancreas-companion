import { useMemo, useState } from 'react'
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
import { findChain } from '../lib/restaurantSearch.ts'
import { findByName } from '../lib/savedRestaurants.ts'
import { useSavedRestaurants } from '../state/restaurants.tsx'
import type { Cuisine } from '../types.ts'

/**
 * The restaurant helper. Main spec section 5.2.
 *
 * Local data only. No Worker, no AI: that is Phase 11, and until it exists the
 * honest answer to a restaurant the playbook does not know is the universal
 * strategy plus a cuisine she picks herself, never a spinner that goes nowhere.
 * Same policy the food checker follows for an unknown food.
 *
 * This screen renders inside FlareGate (see App.tsx). It is food content, so in
 * flare mode it does not mount at all and triage comes first. Invariant 1.
 */
export function RestaurantHelper() {
  const { saved, save, update, remove, persisted } = useSavedRestaurants()

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

  function onNameChange(next: string) {
    setName(next)
    // A new restaurant means the chain match gets to speak again.
    setCuisineIsHers(false)
    setChosenCuisine(null)
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
