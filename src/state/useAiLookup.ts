import { useCallback, useEffect, useRef, useState } from 'react'
import { toDisplayable, type AiAdvice, type ToDisplayableContext } from '../lib/aiAdvice.ts'
import { askAI, type AiQueryType } from '../lib/askAI.ts'
import { useTriage } from './triage.tsx'

/**
 * One lookup, with its timing and its guards. Used by both screens. Phase 11.
 *
 * INVARIANT 1, AND THE PART OF IT THIS FILE ADDS. Both call sites already render
 * inside FlareGate, so their components do not mount during an uncleared triage
 * and no AI result can appear on screen. That is necessary and it is not
 * sufficient: a request started a moment before she switched to flare mode is
 * still in flight, and a fetch does not care that its component unmounted. The
 * gate stops results from RENDERING. This stops calls from EXISTING.
 *
 * So there are two enforcement points below, and both ask the same
 * foodGuidanceAllowed that the other three guards ask, through useTriage:
 *
 *   1. run() returns without fetching when the gate is closed.
 *   2. an effect aborts anything in flight the moment it closes.
 *
 * That makes this the fourth consumer of foodGuidanceAllowed. It is reached
 * through useTriage().foodAllowed like the other three, never by writing
 * currentMode === 'flare' by hand.
 *
 * INVARIANT 7. There is no error state in this hook's type. A failure of any
 * kind returns to 'idle', which is the state the screen was in before she
 * tapped, and is byte for byte the state a missing Worker produces.
 */

/**
 * NOTHING APPEARS FOR THE FIRST 400ms.
 *
 * A call that comes back quickly should never have flashed a placeholder at her,
 * and most of them come back quickly. Under this threshold the screen simply
 * does not change until the answer is there.
 *
 * Past it, the pending line goes up and HOLDS THE SLOT until the answer arrives
 * or the request aborts. That is what keeps the layout still: the space is
 * reserved from 400ms onward, so the card replacing the line moves nothing under
 * her thumb. Giving up early and letting a late result land would save nothing
 * and would push content around a screen she had already finished reading.
 */
const REVEAL_DELAY_MS = 400

export type AiLookupState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'ready'; advice: AiAdvice }

export interface AiLookupInput {
  query: string
  queryType: AiQueryType
  mode: string
  dailyTarget: number
  remainingBudget: number
  context: ToDisplayableContext
}

export interface AiLookupApi {
  state: AiLookupState
  /** No-op when the gate is closed, when a call is already running, or on a blank query. */
  run: (input: AiLookupInput) => void
  /** Back to idle, aborting anything in flight. Called when her query changes. */
  reset: () => void
}

export function useAiLookup(): AiLookupApi {
  const { foodAllowed } = useTriage()

  const [state, setState] = useState<AiLookupState>({ kind: 'idle' })

  /*
   * The controller for the request that is allowed to update state. A new run,
   * a reset, an unmount, or the gate closing all replace or clear it, and a
   * response whose controller is no longer this one is dropped on arrival. That
   * is what stops a slow answer to an old query from landing on a new one.
   */
  const active = useRef<AbortController | null>(null)
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stop = useCallback(() => {
    active.current?.abort()
    active.current = null
    if (revealTimer.current !== null) {
      clearTimeout(revealTimer.current)
      revealTimer.current = null
    }
  }, [])

  const reset = useCallback(() => {
    stop()
    setState({ kind: 'idle' })
  }, [stop])

  /*
   * ENFORCEMENT POINT 2. The gate closing kills the request.
   *
   * An effect is the right shape here, unlike in triage.tsx where deriving
   * during render was load bearing: there is nothing to leak in an intermediate
   * render, because a pending or ready state renders nothing while the gate is
   * closed. FlareGate has already unmounted the whole subtree. What this cleans
   * up is the socket and the state behind it, so that clearing triage a minute
   * later does not repaint a stale answer to a question she asked before the
   * flare started.
   */
  useEffect(() => {
    if (foodAllowed) return
    stop()
    setState({ kind: 'idle' })
  }, [foodAllowed, stop])

  /** Unmount. Same reasoning, different trigger. */
  useEffect(() => stop, [stop])

  const run = useCallback(
    (input: AiLookupInput) => {
      // ENFORCEMENT POINT 1. No call may fire while triage is uncleared.
      if (!foodAllowed) return
      if (input.query.trim() === '') return
      if (active.current !== null) return

      const controller = new AbortController()
      active.current = controller

      revealTimer.current = setTimeout(() => {
        revealTimer.current = null
        // Still the live request, and still worth showing a line for.
        if (active.current === controller) setState({ kind: 'pending' })
      }, REVEAL_DELAY_MS)

      void askAI(
        {
          query: input.query,
          queryType: input.queryType,
          mode: input.mode,
          dailyTarget: input.dailyTarget,
          remainingBudget: input.remainingBudget,
        },
        controller.signal,
      ).then((raw) => {
        // Superseded, aborted, or the gate closed while this was in the air.
        if (active.current !== controller) return

        if (revealTimer.current !== null) {
          clearTimeout(revealTimer.current)
          revealTimer.current = null
        }
        active.current = null

        /*
         * Both nulls land here and mean the same thing to the screen. A dead
         * Worker (askAI returned null) and a model that wrote something the copy
         * guards refused (toDisplayable returned null) are indistinguishable to
         * her by design, and both leave her with the local answer that was
         * already on screen.
         */
        const advice = raw === null ? null : toDisplayable(raw, input.context)
        setState(advice === null ? { kind: 'idle' } : { kind: 'ready', advice })
      })
    },
    [foodAllowed],
  )

  return { state, run, reset }
}
