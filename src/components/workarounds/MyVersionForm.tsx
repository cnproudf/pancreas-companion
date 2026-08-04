import { useEffect, useState } from 'react'
import type { MyVersionDraft } from '../../lib/myVersions.ts'

/**
 * Save my version. Spec section 5.3, and the reason this screen exists.
 *
 * "Add a 'save my version' field so when she works out a version that succeeds,
 * it becomes hers permanently, in her own words. Over months, this becomes the
 * most valuable screen in the app, because it is authored by her."
 *
 * So this is not a footer on someone else's content. It is open whether or not
 * the list matched what she typed, because the workaround she worked out for a
 * food the file has never heard of is worth more than any entry in the file.
 * When there is no match, her typed text becomes the title and subjectId stays
 * null.
 *
 * Nothing she writes is validated for content, ever. The title has to be
 * non-empty only because an untitled row cannot be found again later.
 *
 * Saving always adds a new version rather than replacing one with the same
 * title. See the note above commitVersion in lib/myVersions.ts for why that is
 * deliberate and must stay that way.
 */
export function MyVersionForm({
  seedTitle,
  subjectId,
  onSave,
}: {
  /** The matched entry's name, or whatever she typed. May be empty. */
  seedTitle: string
  /** The substitutions.json entry this is about, or null for freehand. */
  subjectId: string | null
  onSave: (draft: MyVersionDraft) => void
}) {
  const [title, setTitle] = useState(seedTitle)
  const [body, setBody] = useState('')
  const [confirmation, setConfirmation] = useState('')

  /*
   * A new subject is a new note. Reseeding the title on change keeps the field
   * useful without her retyping, and clearing the body stops last night's note
   * about cornbread being saved against soup beans.
   *
   * Keyed on seedTitle rather than subjectId so it also follows her typing when
   * nothing matched, which is the case where the seed is her own words.
   */
  useEffect(() => {
    setTitle(seedTitle)
    setBody('')
    setConfirmation('')
  }, [seedTitle])

  const trimmedTitle = title.trim()
  const canSave = trimmedTitle !== ''

  return (
    <section
      aria-labelledby="my-version-heading"
      /*
        Warmer than the other cards on this screen, because this is the one that
        is hers. Same gold the Daily Lift uses.
      */
      className="rounded-lg border-2 border-gold/40 bg-white/60 p-5"
    >
      <h2 id="my-version-heading" className="mt-0 mb-1 text-lg">
        Save my version
      </h2>
      <p className="mt-0 mb-4 text-ink">
        When you work one out that you like, write it down here in your own words. It
        stays on this device and it stays exactly as you wrote it.
      </p>

      <label htmlFor="my-version-title" className="text-sm text-ink">
        What do you call it?
      </label>
      <input
        id="my-version-title"
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Mamaw's cornbread, my way"
        className="mt-1 w-full rounded-lg border-2 border-stone bg-paper px-4 py-3 text-ink focus:border-creek"
      />

      <label htmlFor="my-version-body" className="mt-4 block text-sm text-ink">
        How you make it
      </label>
      <textarea
        id="my-version-body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={7}
        placeholder="Skim buttermilk, two egg whites, applesauce where the oil went. Hot sprayed skillet, 425. Better the second day."
        className="mt-1 w-full rounded-lg border-2 border-stone bg-paper px-4 py-3 text-ink focus:border-creek"
      />

      <button
        type="button"
        disabled={!canSave}
        onClick={() => {
          onSave({ title: trimmedTitle, body, subjectId })
          setConfirmation(`Saved. ${trimmedTitle} is yours now.`)
          setBody('')
        }}
        className="mt-4 min-h-11 w-full rounded-lg border-2 border-ridge-deep bg-ridge-deep px-4 py-3 font-semibold text-paper hover:border-ridge-mid hover:bg-ridge-mid disabled:border-stone disabled:bg-stone disabled:text-ridge-mid"
      >
        Save my version
      </button>

      <p role="status" className="mt-2 mb-0 text-center text-sm text-ink">
        {confirmation === '' && !canSave ? 'Give it a name and it is yours.' : confirmation}
      </p>
    </section>
  )
}
