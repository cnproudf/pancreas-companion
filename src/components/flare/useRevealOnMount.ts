import { useEffect, useRef } from 'react'

/**
 * Brings a triage screen to the top of the viewport when it appears.
 *
 * FOUND BY MEASURING, NOT BY GUESSING. On a 375x812 phone the header band is
 * around 700px tall: the app name, the Daily Lift card, the ridgeline, the mode
 * selector. Tapping "A bad time" put the red flag check's heading at y=710,
 * which is a sliver at the bottom edge, with all five questions and both
 * answers below the fold. Invariant 1 was satisfied (nothing about food was on
 * screen) and the spec's intent was not: flare mode is supposed to OPEN with
 * the triage screen, and what it actually opened with was the Daily Lift and a
 * hint that something was further down.
 *
 * The urgent panel had the same problem one step worse, since it is the taller
 * of the two.
 *
 * Instant rather than smooth, for two reasons. A smooth scroll on a screen
 * someone reaches while in pain is an animation nobody asked for, and it would
 * need a prefers-reduced-motion branch to be correct. Jumping is also the
 * honest description of what happened: the main region was replaced.
 *
 * Scrolls the ELEMENT to the top rather than the page, so the header above it
 * scrolls away rather than being covered. She can scroll back up to the Daily
 * Lift and the mode selector whenever she wants; they are not taken from her,
 * only moved out of the way of the thing she needs to read.
 */
export function useRevealOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
  }, [])

  return ref
}
