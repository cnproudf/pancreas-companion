import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // A small in-memory localStorage stands in for the browser one, so the
    // storage layer is testable without adding a DOM implementation.
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
  },
})
