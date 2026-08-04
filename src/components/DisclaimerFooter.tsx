/**
 * Invariant 2: the app never presents itself as medical advice. This footer is
 * persistent and not dismissable on any screen giving food guidance.
 *
 * There is deliberately no dismiss control and no prop to add one, so the
 * invariant cannot be regressed by a future change to a caller.
 */
export function DisclaimerFooter() {
  return (
    <footer className="mt-auto border-t border-stone bg-paper px-5 py-4 text-center">
      <p className="m-0 text-[0.9375rem] leading-snug text-ink">
        General information only. Your care team&rsquo;s instructions always win.
      </p>
    </footer>
  )
}
