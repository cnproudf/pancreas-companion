import { useState } from 'react'
import type { MyVersion, MyVersionDraft } from '../../lib/myVersions.ts'
import { Ridgeline } from '../Ridgeline.tsx'

/**
 * Her versions, newest first. The most valuable thing on this screen.
 *
 * The subject label is resolved at render rather than stored, the same way a
 * saved restaurant's cuisine label is, so improved guidance reaches a version
 * she wrote last year. A version whose subject is no longer in
 * substitutions.json still renders in full and simply carries no label. It is
 * never dropped. See the note at the top of lib/myVersions.ts.
 *
 * REMOVAL TAKES TWO EXPLICIT ACTIONS ON THIS ROW AND NOTHING ELSE CAN DO IT.
 *
 * There is no bulk clear, no select-all, and no keyboard shortcut, here or
 * anywhere else in the app. Remove opens an inline confirmation on that row, and
 * only the second click on that same row removes anything. This is heavier than
 * the pattern used for saved restaurants on purpose: a restaurant can be typed
 * in again in ten seconds, and a version she worked out over a winter cannot be
 * recovered from anywhere.
 *
 * The empty state carries the ridgeline at low opacity, one of the three uses
 * addendum section C permits.
 */

interface MyVersionListProps {
  versions: readonly MyVersion[]
  /** Resolves a subjectId to a display name, or null when it is gone. */
  subjectNameFor: (subjectId: string | null) => string | null
  onUpdate: (id: string, draft: MyVersionDraft) => void
  /** Removes exactly this row. Called only from its own confirmation. */
  onRemove: (id: string) => void
  /** Heading, so the screen can say "yours" or "your version of this". */
  heading: string
  /** Shown when the list is empty. Null renders nothing at all. */
  emptyMessage: string | null
}

export function MyVersionList({
  versions,
  subjectNameFor,
  onUpdate,
  onRemove,
  heading,
  emptyMessage,
}: MyVersionListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  if (versions.length === 0) {
    if (emptyMessage === null) return null
    return (
      <section
        aria-labelledby="my-versions-heading"
        className="overflow-hidden rounded-lg border border-stone bg-white/50"
      >
        <div className="p-5">
          <h2 id="my-versions-heading" className="mt-0 mb-1 text-lg">
            {heading}
          </h2>
          <p className="m-0 text-ink">{emptyMessage}</p>
        </div>
        <Ridgeline className="opacity-25" />
      </section>
    )
  }

  return (
    <section
      aria-labelledby="my-versions-heading"
      className="rounded-lg border border-stone bg-white/50 p-5"
    >
      <h2 id="my-versions-heading" className="mt-0 mb-3 text-lg">
        {heading}
      </h2>

      <ul className="m-0 list-none p-0">
        {versions.map((version) => {
          const label = subjectNameFor(version.subjectId)
          const editing = editingId === version.id
          const confirming = confirmingId === version.id

          return (
            <li
              key={version.id}
              className="border-t border-stone/70 py-4 first:border-t-0 first:pt-0"
            >
              {editing ? (
                <>
                  <label htmlFor={`version-title-${version.id}`} className="text-sm text-ink">
                    What do you call it?
                  </label>
                  <input
                    id={`version-title-${version.id}`}
                    type="text"
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    className="mt-1 w-full rounded-lg border-2 border-stone bg-paper px-4 py-3 text-ink focus:border-creek"
                  />

                  <label
                    htmlFor={`version-body-${version.id}`}
                    className="mt-3 block text-sm text-ink"
                  >
                    How you make it
                  </label>
                  <textarea
                    id={`version-body-${version.id}`}
                    value={draftBody}
                    onChange={(event) => setDraftBody(event.target.value)}
                    rows={7}
                    className="mt-1 w-full rounded-lg border-2 border-stone bg-paper px-4 py-3 text-ink focus:border-creek"
                  />

                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={draftTitle.trim() === ''}
                      onClick={() => {
                        onUpdate(version.id, {
                          title: draftTitle,
                          body: draftBody,
                          subjectId: version.subjectId,
                        })
                        setEditingId(null)
                      }}
                      className="min-h-11 rounded-lg border-2 border-ridge-deep bg-ridge-deep px-4 py-2 text-sm font-semibold text-paper hover:border-ridge-mid hover:bg-ridge-mid disabled:border-stone disabled:bg-stone disabled:text-ridge-mid"
                    >
                      Save changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="min-h-11 rounded-lg px-3 py-2 text-sm text-ridge-mid underline underline-offset-4 hover:text-creek"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="m-0 font-serif text-[1.05rem] text-ridge-deep">{version.title}</p>
                  {label !== null && (
                    <p className="mt-0.5 mb-0 text-sm text-ridge-mid">Your take on {label}</p>
                  )}

                  {version.body.trim() !== '' && (
                    <p className="mt-2 mb-0 whitespace-pre-wrap text-ink">{version.body}</p>
                  )}

                  {confirming ? (
                    /*
                      The second explicit action, on this row. Nothing outside
                      this block calls onRemove.
                    */
                    <div className="mt-3 rounded-lg border border-clay/50 bg-paper p-3">
                      <p className="m-0 text-sm text-ink">
                        Remove {version.title}? This is your own writing and there is no copy
                        of it anywhere else.
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onRemove(version.id)
                            setConfirmingId(null)
                          }}
                          className="min-h-11 rounded-lg border-2 border-clay px-4 py-2 text-sm font-semibold text-clay hover:bg-clay hover:text-paper"
                        >
                          Yes, remove it
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingId(null)}
                          className="min-h-11 rounded-lg border-2 border-ridge-deep bg-ridge-deep px-4 py-2 text-sm font-semibold text-paper hover:border-ridge-mid hover:bg-ridge-mid"
                        >
                          Keep it
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(version.id)
                          setDraftTitle(version.title)
                          setDraftBody(version.body)
                          setConfirmingId(null)
                        }}
                        className="min-h-11 rounded-lg py-2 text-sm text-ridge-mid underline underline-offset-4 hover:text-creek"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(version.id)}
                        aria-label={`Remove ${version.title} from your versions`}
                        className="min-h-11 rounded-lg py-2 text-sm text-ridge-mid underline underline-offset-4 hover:text-creek"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
