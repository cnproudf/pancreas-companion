/**
 * Local ids for things she creates: food log entries, saved restaurants.
 *
 * crypto.randomUUID is unavailable on http origins in some browsers, and this
 * app is meant to keep working in awkward places, so there is a fallback. The
 * counter makes the fallback unique within a session, and the timestamp prefix
 * makes it unique across sessions, which together is enough for ids that never
 * leave the device.
 *
 * Extracted from foodLog.ts in Phase 6, when saved restaurants needed the same
 * thing. One counter shared between both is correct: it only has to make two
 * ids generated in the same millisecond differ.
 */

let counter = 0

export function newId(when: Date = new Date()): string {
  const uuid = globalThis.crypto?.randomUUID
  if (typeof uuid === 'function') return globalThis.crypto.randomUUID()
  counter += 1
  return `${when.getTime()}-${counter}`
}
