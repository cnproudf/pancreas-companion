import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  addEntry,
  allEntries,
  findEntry,
  makeEntry,
  readSymptomLog,
  removeEntry as removeFromLog,
  updateEntry as updateInLog,
  writeSymptomLog,
  type SymptomDraft,
  type SymptomEntry,
  type SymptomLog,
} from '../lib/symptomLog.ts'

/**
 * The symptom log, shared across the app. Mirrors foodLog.tsx, including the ref
 * that keeps the writers referentially stable across renders.
 *
 * A context provider rather than a plain hook, unlike useSavedRestaurants. The
 * criterion restaurants.tsx documents is whether several screens have to agree,
 * and here they do, across the one seam in the app that matters most: the log
 * sheet renders OUTSIDE FlareGate and the Patterns tab renders INSIDE it. Two
 * useState copies would let her save an entry on a flare day and not find it on
 * the chart afterwards.
 */

export interface SymptomLogApi {
  log: SymptomLog
  /** Newest first. What the history list renders. */
  entries: SymptomEntry[]
  /** Saves a new entry and returns it, so the UI can offer an undo. */
  add: (draft: SymptomDraft) => SymptomEntry
  /** Replaces one entry's contents, keeping its id. */
  update: (id: string, draft: SymptomDraft) => void
  /** Returns the entry it removed, so the UI can offer an undo. Null if absent. */
  remove: (id: string) => SymptomEntry | null
  /** Undo for remove. Re-files under the entry's own timestamp. */
  restore: (entry: SymptomEntry) => void
  find: (id: string) => SymptomEntry | null
  /** False when the last write did not stick (quota, private mode). */
  persisted: boolean
}

const SymptomLogContext = createContext<SymptomLogApi | null>(null)

export function SymptomLogProvider({ children }: { children: ReactNode }) {
  const [log, setLog] = useState<SymptomLog>(readSymptomLog)
  const [persisted, setPersisted] = useState(true)

  const latest = useRef(log)
  latest.current = log

  /** One place to commit, so every writer persists the same way. */
  const commit = useCallback((next: SymptomLog) => {
    latest.current = next
    setLog(next)
    setPersisted(writeSymptomLog(next))
  }, [])

  const add = useCallback(
    (draft: SymptomDraft): SymptomEntry => {
      const entry = makeEntry(draft)
      commit(addEntry(latest.current, entry))
      return entry
    },
    [commit],
  )

  const update = useCallback(
    (id: string, draft: SymptomDraft) => {
      commit(updateInLog(latest.current, id, draft))
    },
    [commit],
  )

  const remove = useCallback(
    (id: string): SymptomEntry | null => {
      const found = findEntry(latest.current, id)
      if (found === null) return null

      commit(removeFromLog(latest.current, id))
      return found
    },
    [commit],
  )

  /*
   * Undo. Files under the entry's own timestamp, not today's, so an undo tapped
   * after midnight cannot move yesterday's entry onto today's column.
   */
  const restore = useCallback(
    (entry: SymptomEntry) => {
      commit(addEntry(latest.current, entry))
    },
    [commit],
  )

  const find = useCallback((id: string) => findEntry(latest.current, id), [])

  const entries = useMemo(() => allEntries(log), [log])

  const value = useMemo<SymptomLogApi>(
    () => ({ log, entries, add, update, remove, restore, find, persisted }),
    [log, entries, add, update, remove, restore, find, persisted],
  )

  return <SymptomLogContext value={value}>{children}</SymptomLogContext>
}

export function useSymptomLog(): SymptomLogApi {
  const context = useContext(SymptomLogContext)
  if (context === null) {
    throw new Error('useSymptomLog must be used inside a SymptomLogProvider')
  }
  return context
}
