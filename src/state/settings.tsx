import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import * as storage from '../lib/storage.ts'
import type { Settings } from '../types.ts'
import {
  BODY_STAT_FIELDS,
  DEFAULT_SETTINGS,
  hydrateSettings,
  SETTINGS_STORAGE_KEY,
} from './settingsModel.ts'

export { DEFAULT_SETTINGS, hydrateSettings, SETTINGS_STORAGE_KEY }

function loadSettings(): Settings {
  return hydrateSettings(storage.get<unknown>(SETTINGS_STORAGE_KEY, null))
}

export interface SettingsApi {
  settings: Settings
  /** Merge a partial update, persist it, and restamp body stats if touched. */
  update: (patch: Partial<Settings>) => void
  /** Back to defaults. For the settings screen's reset, later. */
  reset: () => void
  /** False when the last write did not stick (quota, private mode). */
  persisted: boolean
}

const SettingsContext = createContext<SettingsApi | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [persisted, setPersisted] = useState(true)
  // Held in a ref so update() stays referentially stable across renders.
  const latest = useRef(settings)
  latest.current = settings

  const commit = useCallback((next: Settings) => {
    latest.current = next
    setSettings(next)
    setPersisted(storage.set(SETTINGS_STORAGE_KEY, next))
  }, [])

  const update = useCallback(
    (patch: Partial<Settings>) => {
      const touchesBodyStats = BODY_STAT_FIELDS.some(
        (field) => field in patch && patch[field] !== latest.current[field],
      )
      commit({
        ...latest.current,
        ...patch,
        ...(touchesBodyStats ? { bodyStatsUpdatedAt: new Date().toISOString() } : {}),
      })
    },
    [commit],
  )

  const reset = useCallback(() => {
    commit({ ...DEFAULT_SETTINGS })
  }, [commit])

  const value = useMemo<SettingsApi>(
    () => ({ settings, update, reset, persisted }),
    [settings, update, reset, persisted],
  )

  return <SettingsContext value={value}>{children}</SettingsContext>
}

export function useSettings(): SettingsApi {
  const context = useContext(SettingsContext)
  if (context === null) {
    throw new Error('useSettings must be used inside a SettingsProvider')
  }
  return context
}
