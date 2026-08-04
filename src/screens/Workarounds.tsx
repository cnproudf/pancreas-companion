import { useMemo, useState } from 'react'
import { MissingFoodInput } from '../components/workarounds/MissingFoodInput.tsx'
import { MyVersionForm } from '../components/workarounds/MyVersionForm.tsx'
import { MyVersionList } from '../components/workarounds/MyVersionList.tsx'
import { ResourceLinks } from '../components/workarounds/ResourceLinks.tsx'
import { StandardVersionCard } from '../components/workarounds/StandardVersionCard.tsx'
import { SwapList } from '../components/workarounds/SwapList.tsx'
import { NEAR_MISS_SCORE, normalize } from '../lib/fuzzy.ts'
import { versionsFor } from '../lib/myVersions.ts'
import {
  searchSubstitutions,
  type SubstitutionMatch,
} from '../lib/substitutionSearch.ts'
import { SUBSTITUTIONS_BY_ID, SUBSTITUTION_RESOURCES } from '../lib/substitutions.ts'
import { useMyVersions } from '../state/myVersions.tsx'

/**
 * Favorites and workarounds. Main spec section 5.3.
 *
 * "She enters a food she loves and misses" and gets the likely fat of the
 * standard version, the structural substitutions, and the places where people
 * have solved it before. Then, the part the spec says becomes the most valuable
 * screen in the app: she writes down the version that worked, in her own words.
 *
 * THE ORDER ON THIS SCREEN IS THE ARGUMENT.
 *
 * Her own versions come first, before the search box, and they are what she sees
 * when she opens the tab having typed nothing. Everything the file ships is
 * scaffolding to get her to the moment where she writes one down; a screen that
 * opened on an empty search field would have those two things backwards. When a
 * search does match, her versions for that entry are pulled to the top, above
 * the shipped swaps, for the same reason.
 *
 * Local data only. No Worker, no AI: that is Phase 11.
 *
 * This screen renders inside FlareGate (see App.tsx). It is food content, so in
 * flare mode it does not mount at all and triage comes first. Invariant 1.
 */

/** Enough alternates to correct a wrong first guess, few enough to scan. */
const RESULT_LIMIT = 4
const NEAR_MISS_LIMIT = 3

type SearchState =
  | { kind: 'idle' }
  | { kind: 'matched'; best: SubstitutionMatch; alternates: SubstitutionMatch[] }
  | { kind: 'near-miss'; candidates: SubstitutionMatch[] }

export function Workarounds() {
  const { versions, save, update, remove, persisted } = useMyVersions()

  const [query, setQuery] = useState('')
  // Set when she taps an alternate, so the card follows her choice instead of
  // snapping back to whatever the raw query scores highest. Same as FoodChecker.
  const [pickedId, setPickedId] = useState<string | null>(null)

  const search = useMemo<SearchState>(() => {
    if (normalize(query) === '') return { kind: 'idle' }

    const matches = searchSubstitutions(query, { limit: RESULT_LIMIT })
    if (matches.length > 0) {
      const picked = matches.find((match) => match.substitution.id === pickedId)
      const best = picked ?? (matches[0] as SubstitutionMatch)
      return {
        kind: 'matched',
        best,
        alternates: matches.filter((match) => match.substitution.id !== best.substitution.id),
      }
    }

    return {
      kind: 'near-miss',
      candidates: searchSubstitutions(query, {
        minScore: NEAR_MISS_SCORE,
        limit: NEAR_MISS_LIMIT,
      }),
    }
  }, [query, pickedId])

  const matched = search.kind === 'matched' ? search.best.substitution : null

  /*
   * The save form is open in every state. When nothing matched, her typed words
   * become the title and the subject stays null, because a workaround she worked
   * out for a food the file has never heard of is worth more than any entry the
   * file ships. Nothing she wants to record is blocked by the dataset.
   */
  const seedTitle = matched?.name ?? query.trim()
  const subjectId = matched?.id ?? null

  const hersForThis = matched === null ? [] : versionsFor(versions, matched.id)
  // The rest, so the list at the foot of the page does not repeat the rows
  // already pulled up above the swaps.
  const hersForOthers =
    matched === null ? versions : versions.filter((version) => version.subjectId !== matched.id)

  function subjectNameFor(id: string | null): string | null {
    if (id === null) return null
    return SUBSTITUTIONS_BY_ID.get(id)?.name ?? null
  }

  function onQueryChange(next: string) {
    setQuery(next)
    setPickedId(null)
  }

  /*
   * One concise live region rather than aria-live on the content, for the reason
   * spelled out in FoodChecker: the cards rebuild on every keystroke, and
   * announcing all of it each time would read a wall of text over her while she
   * is still typing.
   */
  const announcement =
    search.kind === 'matched' && matched !== null
      ? `${matched.name}. About ${matched.standardFatGrams} grams the usual way. ${matched.swaps.length} ways to get close.`
      : search.kind === 'near-miss'
        ? 'Not in my list yet. You can still save your own version.'
        : ''

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      {/*
        Hers first, always. See the note at the top of this file: on a screen
        whose whole point is that it is authored by her, an empty search box
        would be the wrong first thing.
      */}
      {search.kind === 'idle' && (
        <MyVersionList
          versions={versions}
          subjectNameFor={subjectNameFor}
          onUpdate={update}
          onRemove={remove}
          heading="Your versions"
          emptyMessage="Nothing here yet. When you work out a version of something you miss, write it down below and it stays yours."
        />
      )}

      <section
        aria-labelledby="missing-heading"
        className="flex flex-col gap-4 rounded-lg border border-stone bg-white/50 p-5"
      >
        <h2 id="missing-heading" className="mt-0 mb-0 text-lg">
          Something you miss
        </h2>

        <MissingFoodInput value={query} onChange={onQueryChange} />

        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>

        {search.kind === 'idle' && (
          <p className="m-0 text-ink">
            Type something you have given up and you will get what makes it what it is,
            and the swaps that get closest.
          </p>
        )}
      </section>

      {/*
        Her version of THIS one, above the shipped swaps. If she has already
        worked this out, what she wrote outranks anything in the file.
      */}
      {matched !== null && hersForThis.length > 0 && (
        <MyVersionList
          versions={hersForThis}
          subjectNameFor={subjectNameFor}
          onUpdate={update}
          onRemove={remove}
          heading={`Your ${matched.name.toLowerCase()}`}
          emptyMessage={null}
        />
      )}

      {matched !== null && (
        <>
          <StandardVersionCard substitution={matched} />
          <SwapList substitution={matched} />
        </>
      )}

      {search.kind === 'matched' && search.alternates.length > 0 && (
        <section aria-labelledby="alternates-heading">
          <h3 id="alternates-heading" className="mt-0 mb-2 text-base font-semibold text-ridge-deep">
            Did you mean
          </h3>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {search.alternates.map((match) => (
              <li key={match.substitution.id}>
                <button
                  type="button"
                  onClick={() => setPickedId(match.substitution.id)}
                  className="min-h-11 w-full rounded-lg border border-stone bg-paper px-4 py-2 text-left text-ink hover:border-creek"
                >
                  {match.substitution.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/*
        Not an error state. No red, no apology. The list will never cover
        everything she misses, and the honest answer is the closest things it
        does have plus a save form that is still open. Same policy as
        NearMissList on the food checker.
      */}
      {search.kind === 'near-miss' && (
        <section
          aria-labelledby="near-miss-heading"
          className="rounded-lg border border-stone bg-white/50 p-5"
        >
          <h3 id="near-miss-heading" className="mt-0 mb-2 text-lg">
            Not in my list yet
          </h3>
          <p className="mt-0 mb-3 text-ink">
            I do not have a workaround written for that one. You can still save your own
            version of it below, and that is the better half of this screen anyway.
          </p>

          {search.candidates.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {search.candidates.map((match) => (
                <li key={match.substitution.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery(match.substitution.name)
                      setPickedId(match.substitution.id)
                    }}
                    className="min-h-11 w-full rounded-lg border border-stone bg-paper px-4 py-2 text-left text-ink hover:border-creek"
                  >
                    {match.substitution.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <MyVersionForm seedTitle={seedTitle} subjectId={subjectId} onSave={save} />

      {/* The rest of what she has written, once a search has taken over the top. */}
      {search.kind !== 'idle' && hersForOthers.length > 0 && (
        <MyVersionList
          versions={hersForOthers}
          subjectNameFor={subjectNameFor}
          onUpdate={update}
          onRemove={remove}
          heading="Everything else you have written"
          emptyMessage={null}
        />
      )}

      <ResourceLinks resources={SUBSTITUTION_RESOURCES} />

      {!persisted && (
        <p role="status" className="m-0 text-sm text-gold-text">
          This device is not letting the app save right now, so what you write may not be
          here next time.
        </p>
      )}
    </div>
  )
}
