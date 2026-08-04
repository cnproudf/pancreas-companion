import { useId, useMemo, useState } from 'react'
import { PREP_COPY } from '../../lib/appointmentPrep.ts'
import {
  addQuestion,
  hiddenQuestions,
  hideQuestion,
  removeQuestion,
  resolveQuestions,
  restoreQuestion,
  WRITE_IN_LINES,
  type PrepQuestionsState,
} from '../../lib/prepQuestions.ts'

/**
 * The questions section. Spec section 5.6, pre-seeded with the four it names.
 *
 * TWO KINDS OF ROOM FOR HER OWN, AND THEY ARE NOT THE SAME KIND.
 *
 * The list is for questions she thinks of in advance, at home, with time. It
 * persists, so the one she thought of last month is still there this month. The
 * blank ruled lines at the bottom are for the ones that arrive in the waiting
 * room, or in the chair, and those get written with a pen. Neither replaces the
 * other, and a page that offered only the first would be a page she cannot add
 * to once it is printed.
 *
 * Every control here is `print:hidden`. The questions themselves print; the
 * machinery for editing them does not.
 */
export function PrepQuestions({
  state,
  onChange,
}: {
  state: PrepQuestionsState
  onChange: (next: PrepQuestionsState) => void
}) {
  const [draft, setDraft] = useState('')
  const fieldId = useId()

  const questions = useMemo(() => resolveQuestions(state), [state])
  const hidden = useMemo(() => hiddenQuestions(state), [state])

  function submit() {
    if (draft.trim() === '') return
    onChange(addQuestion(state, draft))
    setDraft('')
  }

  return (
    <section aria-labelledby="prep-questions-heading" className="mt-8">
      <h2 id="prep-questions-heading" className="mt-0 mb-2 text-xl">
        {PREP_COPY.questionsTitle}
      </h2>
      <p className="mt-0 mb-4 text-ink print:hidden">{PREP_COPY.questionsIntro}</p>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {questions.map((question) => (
          <li
            key={question.id}
            data-print-keep
            className="flex items-start justify-between gap-3 border-b border-stone pb-2"
          >
            <span className="text-ink">{question.text}</span>

            <button
              type="button"
              onClick={() =>
                onChange(
                  question.own
                    ? removeQuestion(state, question.id)
                    : hideQuestion(state, question.id),
                )
              }
              aria-label={`${question.own ? PREP_COPY.remove : PREP_COPY.hide}: ${question.text}`}
              className="shrink-0 rounded-lg px-2 py-1 text-sm text-creek underline underline-offset-4 hover:text-ridge-deep print:hidden"
            >
              {question.own ? PREP_COPY.remove : PREP_COPY.hide}
            </button>
          </li>
        ))}
      </ul>

      {/*
        The blank lines. Rendered on screen as well as in print, so what she
        sees is what comes out of the printer rather than a surprise.
      */}
      <div data-print-keep className="mt-6">
        <h3 className="mt-0 mb-3 text-lg">{PREP_COPY.writeInTitle}</h3>
        <ul aria-hidden="true" className="m-0 flex list-none flex-col gap-6 p-0">
          {Array.from({ length: WRITE_IN_LINES }, (_, index) => (
            <li key={index} className="border-b border-stone" />
          ))}
        </ul>
      </div>

      <div className="mt-6 print:hidden">
        <label htmlFor={fieldId} className="font-semibold text-ridge-deep">
          {PREP_COPY.addLabel}
        </label>
        <input
          id={fieldId}
          type="text"
          value={draft}
          placeholder={PREP_COPY.addPlaceholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
          }}
          className="mt-1 min-h-11 w-full rounded-lg border-2 border-stone bg-paper px-4 py-2 text-ink focus:border-creek"
        />
        <button
          type="button"
          onClick={submit}
          className="mt-3 rounded-lg border-2 border-ridge-deep bg-ridge-deep px-4 py-3 font-semibold text-paper hover:border-ridge-mid hover:bg-ridge-mid"
        >
          {PREP_COPY.addSubmit}
        </button>
      </div>

      {hidden.length > 0 && (
        <div className="mt-6 print:hidden">
          <h3 className="mt-0 mb-2 text-lg">{PREP_COPY.hiddenTitle}</h3>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {hidden.map((question) => (
              <li key={question.id} className="flex items-center justify-between gap-2">
                <span className="text-ridge-mid">{question.text}</span>
                <button
                  type="button"
                  onClick={() => onChange(restoreQuestion(state, question.id))}
                  aria-label={`${PREP_COPY.restore}: ${question.text}`}
                  className="shrink-0 rounded-lg px-2 py-1 text-sm text-creek underline underline-offset-4 hover:text-ridge-deep"
                >
                  {PREP_COPY.restore}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
