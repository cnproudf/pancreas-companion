import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LiftItem } from '../lib/dailyLift.ts'
import { dateKey } from '../lib/foodLog.ts'
import {
  isFavorited,
  readFavorites,
  removeFavorite as removeFromList,
  toggleFavorite,
  writeFavorites,
  type FavoriteLift,
} from '../lib/liftFavorites.ts'
import { dayNumber, liftItemId, pickLift } from '../lib/liftRotation.ts'
import { readOffset, writeOffset } from '../lib/liftToday.ts'
import { useSettings } from './settings.tsx'

/**
 * Everything the Daily Lift card needs: today's item, the walk past it, and the
 * saved collection.
 *
 * A plain hook rather than a context provider, unlike settings.tsx and
 * foodLog.tsx. Those exist because several screens have to agree on one number.
 * This has exactly one consumer and nothing to coordinate, and a provider would
 * be ceremony around a useState.
 */

export interface DailyLiftApi {
  /** Null only if the rotation is somehow empty. The card renders nothing then. */
  item: LiftItem | null
  /** Walks one further into the general rotation. */
  another: () => void
  /** Whether the item currently showing is in the saved collection. */
  saved: boolean
  toggleSaved: () => void
  /** Newest first. */
  favorites: FavoriteLift[]
  removeSaved: (id: string) => void
  /** False when the last write did not stick (quota, private mode). */
  persisted: boolean
}

function readToday(): { key: string; number: number } {
  const now = new Date()
  return { key: dateKey(now), number: dayNumber(now) }
}

export function useDailyLift(): DailyLiftApi {
  const { settings } = useSettings()

  const [today, setToday] = useState(readToday)
  const [offset, setOffset] = useState(() => readOffset(today.key))
  const [favorites, setFavorites] = useState<FavoriteLift[]>(readFavorites)
  const [persisted, setPersisted] = useState(true)

  const offsetRef = useRef(offset)
  offsetRef.current = offset
  const favoritesRef = useRef(favorites)
  favoritesRef.current = favorites

  /*
   * Same shape as foodLog.tsx. The app is a PWA and can sit open across
   * midnight, so the day is recomputed when she comes back to it rather than by
   * an interval that would wake the device to answer a question nobody asked.
   *
   * Only commits when the key actually changed, because this fires on every tab
   * focus and a new object each time would re-render the card for nothing.
   */
  useEffect(() => {
    const sync = () => {
      setToday((previous) => {
        const next = readToday()
        return next.key === previous.key ? previous : next
      })
    }
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('focus', sync)
    }
  }, [])

  /*
   * readOffset returns 0 for a stored offset belonging to any other day, so this
   * both restores her place on a reload and resets it at midnight. No clearing
   * step, no timer.
   */
  useEffect(() => {
    setOffset(readOffset(today.key))
  }, [today.key])

  const another = useCallback(() => {
    const next = offsetRef.current + 1
    offsetRef.current = next
    setOffset(next)
    // Deliberately unchecked. Losing this costs her the scroll position in a
    // list of encouragements, which is not worth telling her about.
    writeOffset(today.key, next)
  }, [today.key])

  const commitFavorites = useCallback((next: FavoriteLift[]) => {
    favoritesRef.current = next
    setFavorites(next)
    setPersisted(writeFavorites(next))
  }, [])

  const item = useMemo(
    () => pickLift(today.number, offset, settings.currentMode),
    [today.number, offset, settings.currentMode],
  )

  const saved = item !== null && isFavorited(favorites, liftItemId(item))

  const toggleSaved = useCallback(() => {
    const current = pickLift(today.number, offsetRef.current, settings.currentMode)
    if (current === null) return
    commitFavorites(toggleFavorite(favoritesRef.current, current))
  }, [commitFavorites, today.number, settings.currentMode])

  const removeSaved = useCallback(
    (id: string) => {
      commitFavorites(removeFromList(favoritesRef.current, id))
    },
    [commitFavorites],
  )

  return { item, another, saved, toggleSaved, favorites, removeSaved, persisted }
}
