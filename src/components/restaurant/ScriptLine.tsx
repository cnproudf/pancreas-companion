import { useEffect, useRef, useState } from 'react'

/**
 * The sentence she reads to a server, or pastes into a delivery app's special
 * instructions box.
 *
 * THE TEXT IS ALWAYS SELECTABLE TEXT. The button is an accelerator, not the only
 * way to get the words out. navigator.clipboard needs a secure context and a
 * permissions state that a webview or an older browser can refuse, and a script
 * she cannot reach because a copy API said no would be a real failure at a
 * table. So the words render plainly, and if the write fails the component
 * selects them for her and says so, in the spirit of invariant 7: no error
 * state, just the next thing that works.
 */
export function ScriptLine({ script }: { script: string }) {
  const textRef = useRef<HTMLParagraphElement>(null)
  const [status, setStatus] = useState<'idle' | 'copied' | 'select-it'>('idle')

  // The confirmation is transient. Reset it when the script itself changes, so
  // switching cuisine never leaves "Copied" sitting under a different sentence.
  useEffect(() => {
    setStatus('idle')
  }, [script])

  async function copy() {
    try {
      await navigator.clipboard.writeText(script)
      setStatus('copied')
    } catch {
      // Select it instead, so the next thing she does is one long press away.
      const node = textRef.current
      if (node !== null) {
        const range = document.createRange()
        range.selectNodeContents(node)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
      setStatus('select-it')
    }
  }

  return (
    <section
      aria-labelledby="script-heading"
      className="rounded-lg border border-stone bg-white/50 p-5"
    >
      <h2 id="script-heading" className="mt-0 mb-1 text-lg">
        What to say
      </h2>
      <p className="mt-0 mb-3 text-sm text-ink">
        Read this to the server, or paste it into the notes box on a delivery order.
      </p>

      <p
        ref={textRef}
        className="m-0 rounded-lg border border-stone bg-paper p-4 font-serif text-[1.05rem] leading-relaxed text-ridge-deep"
      >
        {script}
      </p>

      <button
        type="button"
        onClick={() => void copy()}
        className="mt-3 w-full rounded-lg border-2 border-creek bg-creek px-4 py-3 font-semibold text-paper hover:border-ridge-mid hover:bg-ridge-mid"
      >
        Copy this
      </button>

      <p role="status" className="mt-2 mb-0 text-center text-sm text-ink">
        {status === 'copied'
          ? 'Copied. It is on your clipboard.'
          : status === 'select-it'
            ? 'This device did not let the app use the clipboard. The text is selected, so you can copy it yourself.'
            : ''}
      </p>
    </section>
  )
}
