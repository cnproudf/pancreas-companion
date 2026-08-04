/**
 * Setup for the jsdom project. See the note in vitest.config.ts for why there
 * are two.
 *
 * jsdom brings its own localStorage, so setup.ts's in-memory stand-in is not
 * needed here. What IS needed is clearing it between tests: the app persists
 * settings on every mode change, and a leaked currentMode would mean a test
 * that passes only because the one before it happened to leave flare mode set.
 * In a suite whose whole job is proving invariant 1, that failure mode is
 * exactly the one that must not exist.
 */

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

/*
 * jsdom does not implement the native <dialog> methods. The symptom sheet and
 * the When To Call card both use showModal, and without these an unrelated test
 * that happens to render either one dies on "node.showModal is not a function".
 *
 * These are the minimum that makes the element behave: `open` reflects, and
 * close fires the close event the components listen for. Nothing here fakes the
 * top layer, focus trapping, or inert, because no test asserts on those. If one
 * ever needs to, that is the moment to reach for a real polyfill rather than
 * growing this.
 */
const dialog = globalThis.HTMLDialogElement?.prototype
if (dialog !== undefined) {
  if (typeof dialog.showModal !== 'function') {
    dialog.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true
    }
  }
  if (typeof dialog.show !== 'function') {
    dialog.show = function show(this: HTMLDialogElement) {
      this.open = true
    }
  }
  if (typeof dialog.close !== 'function') {
    dialog.close = function close(this: HTMLDialogElement, returnValue?: string) {
      this.open = false
      if (returnValue !== undefined) this.returnValue = returnValue
      this.dispatchEvent(new Event('close'))
    }
  }
}
