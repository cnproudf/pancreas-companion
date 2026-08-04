import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  appendEntry,
  dateKey,
  entriesFor,
  makeEntry,
  readLog,
  removeEntry as removeFromLog,
  sumFat,
  updateEntry as updateInLog,
  writeLog,
  type FoodLog,
  type FoodLogEntry,
} from '../lib/foodLog.ts'
import type { Food } from '../types.ts'

/**
 * Today's log, shared across the app. Mirrors settings.tsx, including the ref
 * that keeps the writers referentially stable across renders.
 *
 * This is the one source of truth for grams used today. The Phase 4 budget bar,
 * the log panel, and the food checker's budget line all read gramsUsedToday
 * from here; none of them recomputes it.
 */

export interface FoodLogApi {
  /** The local day the app currently considers "today". */
  todayKey: string
  /** Sorted by loggedAt, so display order and meal clustering agree. */
  entriesToday: FoodLogEntry[]
  gramsUsedToday: number
  /** Appends to today and persists. Returns the entry so the UI can name it. */
  logFood: (food: Food) => FoodLogEntry
  /** Returns the entry it removed, so the UI can offer an undo. Null if absent. */
  removeEntry: (id: string) => FoodLogEntry | null
  /** Corrects the grams on one entry. Name and serving are not editable. */
  updateEntryGrams: (id: string, fatGrams: number) => void
  /** Undo for removeEntry. Re-files under the entry's own day, not today's. */
  restoreEntry: (entry: FoodLogEntry) => void
  /** False when the last write did not stick (quota, private mode). */
  persisted: boolean
}

const FoodLogContext = createContext<FoodLogApi | null>(null)

export function FoodLogProvider({ children }: { children: ReactNode }) {
  const [log, setLog] = useState<FoodLog>(readLog)
  const [todayKey, setTodayKey] = useState<string>(() => dateKey())
  const [persisted, setPersisted] = useState(true)

  const latest = useRef(log)
  latest.current = log

  /**
   * The app is a PWA and can sit open across midnight. Recompute the day when
   * she comes back to it, rather than running an interval that would wake the
   * device to answer a question nobody is asking.
   */
  useEffect(() => {
    const sync = () => setTodayKey(dateKey())
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('focus', sync)
    }
  }, [])

  /** One place to commit a new log, so every writer persists the same way. */
  const commit = useCallback((next: FoodLog) => {
    latest.current = next
    setLog(next)
    setPersisted(writeLog(next))
  }, [])

  const logFood = useCallback(
    (food: Food): FoodLogEntry => {
      const entry = makeEntry(food)
      // Derive the day from the entry itself, so logging at 00:00:01 files it
      // under the new day even if the tab has been open since yesterday.
      const key = dateKey(new Date(entry.loggedAt))

      commit(appendEntry(latest.current, entry, key))
      // Logging is the other thing that heals a stale day, alongside the focus
      // listener above.
      setTodayKey(key)
      return entry
    },
    [commit],
  )

  /*
   * These two key off todayKey, not a fresh dateKey(). todayKey is what
   * entriesToday is derived from, so it is the day the panel is actually
   * showing. If the two ever disagree, which is exactly what happens when the
   * tab has sat open across midnight, keying off the clock would look for the
   * row in a day the panel is not displaying and silently do nothing.
   */
  const removeEntry = useCallback(
    (id: string): FoodLogEntry | null => {
      const found = entriesFor(latest.current, todayKey).find((entry) => entry.id === id) ?? null
      if (found === null) return null

      commit(removeFromLog(latest.current, todayKey, id))
      return found
    },
    [commit, todayKey],
  )

  const updateEntryGrams = useCallback(
    (id: string, fatGrams: number) => {
      commit(updateInLog(latest.current, todayKey, id, fatGrams))
    },
    [commit, todayKey],
  )

  /*
   * Undo. Files the entry under the day of its own timestamp rather than
   * today's, so an undo tapped a minute after midnight cannot move yesterday's
   * dinner into today's budget.
   */
  const restoreEntry = useCallback(
    (entry: FoodLogEntry) => {
      commit(appendEntry(latest.current, entry, dateKey(new Date(entry.loggedAt))))
    },
    [commit],
  )

  /*
   * Sorted, because the array order is not the order of the day: an undone
   * removal is re-appended at the end. The panel renders this order and
   * countMeals clusters it, and those two disagreeing would be invisible until
   * the meal count was wrong.
   */
  const entriesToday = useMemo(
    () =>
      [...entriesFor(log, todayKey)].sort(
        (a, b) => Date.parse(a.loggedAt) - Date.parse(b.loggedAt),
      ),
    [log, todayKey],
  )
  const gramsUsedToday = useMemo(() => sumFat(entriesToday), [entriesToday])

  const value = useMemo<FoodLogApi>(
    () => ({
      todayKey,
      entriesToday,
      gramsUsedToday,
      logFood,
      removeEntry,
      updateEntryGrams,
      restoreEntry,
      persisted,
    }),
    [
      todayKey,
      entriesToday,
      gramsUsedToday,
      logFood,
      removeEntry,
      updateEntryGrams,
      restoreEntry,
      persisted,
    ],
  )

  return <FoodLogContext value={value}>{children}</FoodLogContext>
}

export function useFoodLog(): FoodLogApi {
  const context = useContext(FoodLogContext)
  if (context === null) {
    throw new Error('useFoodLog must be used inside a FoodLogProvider')
  }
  return context
}
