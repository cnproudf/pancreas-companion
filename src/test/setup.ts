/**
 * Minimal in-memory localStorage for the test run, so the storage layer can be
 * exercised without pulling a whole DOM implementation into the project.
 *
 * It is a real class with real prototype methods, so vi.spyOn(Storage.prototype)
 * works the same way it would against a browser Storage.
 */

class MemoryStorage {
  #entries = new Map<string, string>()

  get length(): number {
    return this.#entries.size
  }

  key(index: number): string | null {
    return [...this.#entries.keys()][index] ?? null
  }

  getItem(key: string): string | null {
    return this.#entries.has(key) ? (this.#entries.get(key) as string) : null
  }

  setItem(key: string, value: string): void {
    this.#entries.set(String(key), String(value))
  }

  removeItem(key: string): void {
    this.#entries.delete(key)
  }

  clear(): void {
    this.#entries.clear()
  }
}

const globals = globalThis as unknown as {
  Storage?: unknown
  localStorage?: unknown
}

if (globals.Storage === undefined) {
  globals.Storage = MemoryStorage
}

if (globals.localStorage === undefined) {
  globals.localStorage = new MemoryStorage()
}
