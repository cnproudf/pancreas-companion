import { useCallback, useRef, useState } from 'react'
import {
  commitVersion,
  readVersions,
  removeVersion as removeFromList,
  updateVersion,
  writeVersions,
  type MyVersion,
  type MyVersionDraft,
} from '../lib/myVersions.ts'

/**
 * Her saved workarounds.
 *
 * A plain hook rather than a context provider, for the same reason as
 * useSavedRestaurants and useDailyLift: settings.tsx and foodLog.tsx exist
 * because several screens have to agree on one number. This has one consumer and
 * nothing to coordinate, and a provider would be ceremony around a useState.
 */

export interface MyVersionsApi {
  /** Newest first. */
  versions: MyVersion[]
  /** Always adds a new one. Never overwrites by title. See myVersions.ts. */
  save: (draft: MyVersionDraft) => void
  update: (id: string, draft: MyVersionDraft) => void
  /** One row, by id. There is deliberately no bulk equivalent. */
  remove: (id: string) => void
  /** False when the last write did not stick (quota, private mode). */
  persisted: boolean
}

export function useMyVersions(): MyVersionsApi {
  const [versions, setVersions] = useState<MyVersion[]>(readVersions)
  const [persisted, setPersisted] = useState(true)

  // Same shape as useSavedRestaurants: the ref lets the callbacks stay stable
  // while still reading the current list.
  const versionsRef = useRef(versions)
  versionsRef.current = versions

  const commit = useCallback((next: MyVersion[]) => {
    versionsRef.current = next
    setVersions(next)
    setPersisted(writeVersions(next))
  }, [])

  const save = useCallback(
    (draft: MyVersionDraft) => {
      commit(commitVersion(versionsRef.current, draft))
    },
    [commit],
  )

  const update = useCallback(
    (id: string, draft: MyVersionDraft) => {
      commit(updateVersion(versionsRef.current, id, draft))
    },
    [commit],
  )

  const remove = useCallback(
    (id: string) => {
      commit(removeFromList(versionsRef.current, id))
    },
    [commit],
  )

  return { versions, save, update, remove, persisted }
}
