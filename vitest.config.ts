import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

/*
 * Merged with the app config rather than redeclaring resolve.alias here. Two
 * alias maps drift, and the failure mode is "tests pass, the build resolves a
 * different file", which is the worst possible bug in a data loading layer.
 * From Phase 2 the loaders import @data/*.json, so the alias has to be present
 * in the test run too.
 *
 * TWO PROJECTS SINCE PHASE 9, AND THE SPLIT IS DELIBERATE.
 *
 * Everything in src/lib and src/state is pure and runs in `node` with a small
 * in-memory localStorage, which is how it has been since Phase 1 and how it
 * should stay: a pure module that needs a DOM to be tested is a pure module
 * that has stopped being pure, and running the whole suite in jsdom would hide
 * that.
 *
 * The jsdom project exists for exactly one reason, and it is invariant 1.
 * FlareGate is structural, and the only honest way to prove a structural rule
 * is to render the real thing and look at what came out. See
 * src/components/FlareGate.test.tsx.
 *
 * The convention is the extension. A .test.ts file runs in node; a .test.tsx
 * file runs in jsdom. That means the environment is visible in the filename,
 * and nobody has to remember a config rule to know which one they are writing.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'lib',
            globals: true,
            environment: 'node',
            setupFiles: ['./src/test/setup.ts'],
            include: ['src/**/*.test.ts'],
          },
        },
        {
          extends: true,
          test: {
            name: 'dom',
            globals: true,
            environment: 'jsdom',
            setupFiles: ['./src/test/setupDom.ts'],
            include: ['src/**/*.test.tsx'],
          },
        },
      ],
    },
  }),
)
