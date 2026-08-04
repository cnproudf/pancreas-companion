import { useCallback, useId, useMemo, useState } from 'react'
import { Ridgeline } from '../components/Ridgeline.tsx'
import {
  SECTION_LABELS,
  STAPLES_COPY,
  STORE_SECTIONS,
  addStaple,
  bySection,
  hiddenStaples,
  hideStaple,
  readStaples,
  removeStaple,
  resolveStaples,
  restoreStaple,
  toggleChecked,
  uncheckAll,
  writeStaples,
  type StoreSection,
} from '../lib/staples.ts'
import { useFoodLog } from '../state/foodLog.tsx'

/**
 * Safe staples. Spec section 5.9.
 *
 * A grocery list, grouped by where things are shelved, seeded from the
 * pantry-staple tag in foods.json and editable freely. See the header note in
 * lib/staples.ts for why the store sections live in code rather than in data/,
 * and for why spec 5.9's "add from my saved favorites" reads from her food log
 * instead.
 *
 * FOOD CONTENT, so it renders inside FlareGate like every other tab. A list of
 * things to buy and eat is food guidance under any reading of the rule.
 */
export function Staples() {
  const [state, setState] = useState(readStaples)
  const [persisted, setPersisted] = useState(true)
  const [draftName, setDraftName] = useState('')
  const [draftSection, setDraftSection] = useState<StoreSection>('produce')
  const formId = useId()

  const { log } = useFoodLog()

  const commit = useCallback((next: typeof state) => {
    setState(next)
    setPersisted(writeStaples(next))
  }, [])

  const items = useMemo(() => resolveStaples(state), [state])
  const groups = useMemo(() => bySection(items), [items])
  const hidden = useMemo(() => hiddenStaples(state), [state])

  /*
   * Spec 5.9's "add from my saved favorites" path. There is no food-favorites
   * store in this app, so this offers what she has actually logged, newest
   * first, minus anything already on the list. Recorded in lib/staples.ts.
   */
  const fromLog = useMemo(() => {
    const onList = new Set(items.map((item) => item.name.toLowerCase()))
    const names: string[] = []

    for (const day of Object.keys(log).sort().reverse()) {
      for (const entry of log[day] ?? []) {
        const key = entry.name.toLowerCase()
        if (onList.has(key)) continue
        if (names.some((name) => name.toLowerCase() === key)) continue
        names.push(entry.name)
      }
    }
    return names.slice(0, 12)
  }, [log, items])

  function submitAdd() {
    if (draftName.trim() === '') return
    commit(addStaple(state, draftName, draftSection))
    setDraftName('')
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <section aria-labelledby="staples-heading">
        <h2 id="staples-heading" className="mt-0 mb-1 text-xl">
          {STAPLES_COPY.title}
        </h2>
        <p className="mt-0 mb-0 text-ink">{STAPLES_COPY.intro}</p>
      </section>

      {groups.length === 0 ? (
        <section className="rounded-lg border border-stone bg-white/50 p-5 text-center">
          {/*
            Addendum section C allows the ridgeline on empty states, at low
            opacity. Same treatment as the other three empty states in the app.
          */}
          <Ridgeline className="opacity-25" />
          <p className="mt-3 mb-0 text-ink">{STAPLES_COPY.empty}</p>
        </section>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <section
              key={group.section}
              aria-labelledby={`section-${group.section}`}
              className="rounded-lg border border-stone bg-white/50 p-4"
            >
              <h3 id={`section-${group.section}`} className="mt-0 mb-2 text-lg">
                {SECTION_LABELS[group.section]}
              </h3>

              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {group.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-paper">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => commit(toggleChecked(state, item.id))}
                        className="size-5 shrink-0 accent-ridge-deep"
                      />
                      {/*
                        Struck through AND dimmed when ticked, so the state does
                        not rest on the checkbox glyph alone at a glance across
                        a store aisle.
                      */}
                      <span className={item.checked ? 'text-ridge-mid line-through' : 'text-ink'}>
                        {item.name}
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        commit(item.own ? removeStaple(state, item.id) : hideStaple(state, item.id))
                      }
                      aria-label={`${item.own ? STAPLES_COPY.remove : STAPLES_COPY.hide}: ${item.name}`}
                      className="shrink-0 rounded-lg px-2 py-1 text-sm text-creek underline underline-offset-4 hover:text-ridge-deep"
                    >
                      {item.own ? STAPLES_COPY.remove : STAPLES_COPY.hide}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <section
        aria-labelledby="staples-add-heading"
        className="rounded-lg border border-stone bg-white/50 p-4"
      >
        <h3 id="staples-add-heading" className="mt-0 mb-3 text-lg">
          {STAPLES_COPY.addLabel}
        </h3>

        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor={`${formId}-name`} className="sr-only">
              {STAPLES_COPY.addLabel}
            </label>
            <input
              id={`${formId}-name`}
              type="text"
              value={draftName}
              placeholder={STAPLES_COPY.addPlaceholder}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitAdd()
              }}
              className="min-h-11 w-full rounded-lg border-2 border-stone bg-paper px-4 py-2 text-ink focus:border-creek"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-section`} className="font-semibold text-ridge-deep">
              {STAPLES_COPY.addSection}
            </label>
            <select
              id={`${formId}-section`}
              value={draftSection}
              onChange={(event) => setDraftSection(event.target.value as StoreSection)}
              className="mt-1 min-h-11 w-full rounded-lg border-2 border-stone bg-paper px-4 py-2 text-ink focus:border-creek"
            >
              {STORE_SECTIONS.map((section) => (
                <option key={section} value={section}>
                  {SECTION_LABELS[section]}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={submitAdd}
            className="rounded-lg border-2 border-ridge-deep bg-ridge-deep px-4 py-3 font-semibold text-paper hover:border-ridge-mid hover:bg-ridge-mid"
          >
            {STAPLES_COPY.addSubmit}
          </button>
        </div>
      </section>

      <section
        aria-labelledby="staples-fromlog-heading"
        className="rounded-lg border border-stone bg-white/50 p-4"
      >
        <h3 id="staples-fromlog-heading" className="mt-0 mb-3 text-lg">
          {STAPLES_COPY.fromLogTitle}
        </h3>

        {fromLog.length === 0 ? (
          <p className="m-0 text-sm text-ridge-mid">{STAPLES_COPY.fromLogEmpty}</p>
        ) : (
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {fromLog.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => commit(addStaple(state, name, 'other'))}
                  className="min-h-11 rounded-lg border-2 border-stone bg-paper px-3 py-2 text-sm text-ink hover:border-creek"
                >
                  {name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {hidden.length > 0 && (
        <section
          aria-labelledby="staples-hidden-heading"
          className="rounded-lg border border-stone bg-white/50 p-4"
        >
          <h3 id="staples-hidden-heading" className="mt-0 mb-3 text-lg">
            {STAPLES_COPY.hiddenTitle}
          </h3>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {hidden.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2">
                <span className="text-ridge-mid">{item.name}</span>
                <button
                  type="button"
                  onClick={() => commit(restoreStaple(state, item.id))}
                  aria-label={`${STAPLES_COPY.restore}: ${item.name}`}
                  className="shrink-0 rounded-lg px-2 py-1 text-sm text-creek underline underline-offset-4 hover:text-ridge-deep"
                >
                  {STAPLES_COPY.restore}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/*
        The post-shopping-trip reset. Unchecks everything and touches nothing
        else: her own items stay, hidden items stay hidden, the list is intact.
      */}
      <button
        type="button"
        onClick={() => commit(uncheckAll(state))}
        className="rounded-lg border-2 border-stone bg-paper px-4 py-3 text-ink hover:border-creek"
      >
        {STAPLES_COPY.startNewList}
      </button>

      {!persisted && (
        <p role="status" className="m-0 text-sm text-gold-text">
          This device is not letting the app save right now, so your list may not be here next
          time.
        </p>
      )}
    </div>
  )
}
