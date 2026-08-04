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
  sumFat,
  writeLog,
  type FoodLog,
  type FoodLogEntry,
} from '../lib/foodLog.ts'
import type { Food } from '../types.ts'

/**
 * Today's log, shared across the app. Mirrors settings.tsx, including the ref
 * that keeps logFood referentially stable across renders.
 *
 * The visible budget bar is Phase 4. This provider exists now because the food
 * checker needs to write an entry and immediately see the budget line change.
 */

export interface FoodLogApi {
  /** The local day the app currently considers "today". */
  todayKey: string
  entriesToday: FoodLogEntry[]
  gramsUsedToday: number
  /** Appends to today and persists. Returns the entry so the UI can name it. */
  logFood: (food: Food) => FoodLogEntry
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

  const logFood = useCallback((food: Food): FoodLogEntry => {
    const entry = makeEntry(food)
    // Derive the day from the entry itself, so logging at 00:00:01 files it
    // under the new day even if the tab has been open since yesterday.
    const key = dateKey(new Date(entry.loggedAt))
    const next = appendEntry(latest.current, entry, key)

    latest.current = next
    setLog(next)
    setTodayKey(key)
    setPersisted(writeLog(next))
    return entry
  }, [])

  const entriesToday = useMemo(() => entriesFor(log, todayKey), [log, todayKey])
  const gramsUsedToday = useMemo(() => sumFat(entriesToday), [entriesToday])

  const value = useMemo<FoodLogApi>(
    () => ({ todayKey, entriesToday, gramsUsedToday, logFood, persisted }),
    [todayKey, entriesToday, gramsUsedToday, logFood, persisted],
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
