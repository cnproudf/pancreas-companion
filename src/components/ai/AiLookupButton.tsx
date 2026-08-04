import { AI_COPY } from '../../lib/aiAdvice.ts'

/**
 * The trigger. Phase 11.
 *
 * A BUTTON RATHER THAN AN AUTOMATIC CALL, for three reasons.
 *
 * The mechanical one: both screens derive their search from a useMemo on the
 * query, which recomputes on every keystroke. An automatic lookup would fire a
 * request per character, spend the Worker's hundred an hour on half typed words,
 * and put a pending line on screen while she was still mid-word.
 *
 * The honest one: this is the only moment in the app when something she typed
 * leaves the device. Everything else is localStorage, by invariant 3. That is
 * worth a deliberate tap rather than a background send she never asked for.
 *
 * The third: a button that does nothing visible for 400ms still feels like it
 * worked, because she pressed it. A page that changes on its own after 400ms
 * does not.
 */
export function AiLookupButton({
  onClick,
  disabled,
  hasResult,
}: {
  onClick: () => void
  disabled: boolean
  hasResult: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-lg border-2 border-dashed border-ridge-mid bg-paper px-4 py-3 font-semibold text-ridge-deep hover:border-ridge-deep hover:bg-white/50 disabled:opacity-60"
    >
      {hasResult ? AI_COPY.lookupAgainAction : AI_COPY.lookupAction}
    </button>
  )
}
