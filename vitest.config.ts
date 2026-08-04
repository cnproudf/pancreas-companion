import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

// Merged with the app config rather than redeclaring resolve.alias here. Two
// alias maps drift, and the failure mode is "tests pass, the build resolves a
// different file", which is the worst possible bug in a data loading layer.
// From Phase 2 the loaders import @data/*.json, so the alias has to be present
// in the test run too.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'node',
      // A small in-memory localStorage stands in for the browser one, so the
      // storage layer is testable without adding a DOM implementation.
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.ts'],
    },
  }),
)
