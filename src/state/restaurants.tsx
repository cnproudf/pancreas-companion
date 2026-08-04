import { useCallback, useRef, useState } from 'react'
import {
  commitSaved,
  readSaved,
  removeSaved as removeFromList,
  updateSaved,
  writeSaved,
  type RestaurantDraft,
  type SavedRestaurant,
} from '../lib/savedRestaurants.ts'

/**
 * Her saved restaurants.
 *
 * A plain hook rather than a context provider, for the same reason as
 * useDailyLift: settings.tsx and foodLog.tsx exist because several screens have
 * to agree on one number. This has one consumer and nothing to coordinate, and a
 * provider would be ceremony around a useState.
 */

export interface SavedRestaurantsApi {
  /** Newest first. */
  saved: SavedRestaurant[]
  /** Saves a new one, or updates the row that already has this name. */
  save: (draft: RestaurantDraft) => void
  update: (id: string, draft: RestaurantDraft) => void
  remove: (id: string) => void
  /** False when the last write did not stick (quota, private mode). */
  persisted: boolean
}

export function useSavedRestaurants(): SavedRestaurantsApi {
  const [saved, setSaved] = useState<SavedRestaurant[]>(readSaved)
  const [persisted, setPersisted] = useState(true)

  // Same shape as useDailyLift: the ref lets the callbacks stay stable while
  // still reading the current list.
  const savedRef = useRef(saved)
  savedRef.current = saved

  const commit = useCallback((next: SavedRestaurant[]) => {
    savedRef.current = next
    setSaved(next)
    setPersisted(writeSaved(next))
  }, [])

  const save = useCallback(
    (draft: RestaurantDraft) => {
      commit(commitSaved(savedRef.current, draft))
    },
    [commit],
  )

  const update = useCallback(
    (id: string, draft: RestaurantDraft) => {
      commit(updateSaved(savedRef.current, id, draft))
    },
    [commit],
  )

  const remove = useCallback(
    (id: string) => {
      commit(removeFromList(savedRef.current, id))
    },
    [commit],
  )

  return { saved, save, update, remove, persisted }
}
