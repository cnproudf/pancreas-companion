/**
 * The only module in the app that talks to persistent storage.
 *
 * Invariant 3: all user data lives in localStorage. No accounts, no analytics,
 * no server storage of anything she enters.
 *
 * Nothing here ever throws. A corrupted blob, a full disk, or Safari private
 * mode should cost her a setting, never a white screen.
 */

const PREFIX = 'pc:'

function namespaced(key: string): string {
  return key.startsWith(PREFIX) ? key : `${PREFIX}${key}`
}

/**
 * Feature detects localStorage. Safari private mode throws on access, not just
 * on write, so even reading the property needs the try/catch.
 */
export function isAvailable(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    const probe = `${PREFIX}__probe__`
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

/**
 * JSON.parse that never throws. Returns the fallback for null input, malformed
 * JSON, and for JSON that legitimately parses to null or undefined (otherwise a
 * stored literal "null" would blank out a setting).
 */
export function safeParse<T>(raw: string | null, fallback: T): T {
  if (raw === null || raw === '') return fallback
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || parsed === undefined) return fallback
    return parsed as T
  } catch {
    return fallback
  }
}

export function get<T>(key: string, fallback: T): T {
  try {
    return safeParse(localStorage.getItem(namespaced(key)), fallback)
  } catch {
    return fallback
  }
}

/**
 * Returns false rather than throwing when storage is unavailable, the quota is
 * exceeded, or the value is cyclic and breaks JSON.stringify. Callers decide
 * whether a failed write is worth telling her about. Usually it is not.
 */
export function set(key: string, value: unknown): boolean {
  try {
    const serialized = JSON.stringify(value)
    if (serialized === undefined) return false
    localStorage.setItem(namespaced(key), serialized)
    return true
  } catch {
    return false
  }
}

export function remove(key: string): boolean {
  try {
    localStorage.removeItem(namespaced(key))
    return true
  } catch {
    return false
  }
}

/**
 * Clears only this app's keys. Never touches anything else on the origin.
 *
 * NOTHING IN THE APP CALLS THIS TODAY, AND WHATEVER CALLS IT FIRST HAS A
 * PROBLEM TO SOLVE FIRST.
 *
 * It sweeps every `pc:` key, which includes `pc:myVersions`. Her workarounds are
 * the only content in this app that cannot be regenerated from the repo: see the
 * note above commitVersion in myVersions.ts. If a reset or a "start over"
 * feature is ever built, myVersions has to be excluded from this call and given
 * its own separate, explicit confirmation. Sweeping it up with settings and logs
 * would be a permanent loss dressed up as a housekeeping action.
 */
export function clearAll(): boolean {
  try {
    const doomed: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key !== null && key.startsWith(PREFIX)) doomed.push(key)
    }
    for (const key of doomed) localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

export const STORAGE_PREFIX = PREFIX
