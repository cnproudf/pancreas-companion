import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { buildPrep, PREP_COPY } from '../../lib/appointmentPrep.ts'
import {
  patternItemText,
  PATTERN_COPY,
  WINDOW_CHOICES,
  type WindowChoice,
} from '../../lib/patterns.ts'
import {
  readPrepQuestions,
  setPrintName,
  writePrepQuestions,
  type PrepQuestionsState,
} from '../../lib/prepQuestions.ts'
import { useFoodLog } from '../../state/foodLog.tsx'
import { useSettings } from '../../state/settings.tsx'
import { useSymptomLog } from '../../state/symptomLog.tsx'
import { DisclaimerFooter } from '../DisclaimerFooter.tsx'
import { PrepQuestions } from './PrepQuestions.tsx'

/**
 * The appointment prep export. Spec section 5.6, addendum section B.
 *
 * "Print to PDF via the browser. No server involvement." So there is no
 * dependency here, no canvas, no PDF library, and nothing leaves the device.
 * The whole mechanism is window.print() plus one block of print CSS in
 * styles/theme.css.
 *
 * WHY THIS IS A PORTAL AND NOT A <dialog>, WHICH IS WHAT THE REST OF THE APP
 * USES FOR AN OVERLAY.
 *
 * SymptomSheet and WhenToCallCard both use showModal(), which puts the element
 * in the browser's top layer. That is the right call for both of them and the
 * wrong call for this one: top layer content paginates inconsistently when
 * printed, and in some browsers only its first page comes out at all. This is a
 * DOCUMENT. It has to break across pages the way an ordinary document does, so
 * it is an ordinary element, portalled to document.body so that one print rule
 * can hide everything that is not it.
 *
 * Do not "fix" this into a dialog for consistency with the other two. The
 * inconsistency is the point.
 *
 * INVARIANT 1. This mounts from the Patterns tab, which is inside FlareGate, so
 * entering flare mode unmounts the whole subtree and the portal with it. That
 * is the correct behaviour and not a coincidence: this page names foods and
 * prints gram values, which is food guidance under CLAUDE.md's working
 * agreement. FlareGate.test.tsx asserts it, because a portal to document.body
 * is exactly the shape that could later be lifted above the gate without
 * anybody noticing.
 *
 * INVARIANT 2. The print rule hides the app shell, and the shell is where the
 * disclaimer footer lives, so this renders its own. A page that carries gram
 * values to a doctor without the line saying her care team's instructions win
 * would be the one screen in the app that dropped it.
 */
/**
 * Secondary lines that PRINT, at addendum section C's 16px floor rather than at
 * the 14px the rest of the app uses for secondary text.
 *
 * Found by measuring, the same way Phase 9 found a 14px line on the When To
 * Call card. Elsewhere `text-sm` is fine: it is UI chrome on a screen she can
 * pinch to zoom. Here it is not. These three lines are the plain sentence about
 * fat malabsorption, the sentence saying whether the fat target came from her
 * care team or from this app, and the line naming which days the correlations
 * were compared against. All three are read off paper, possibly by somebody
 * skimming, and the middle one is the addendum A distinction that must not be
 * the smallest thing on the page.
 *
 * Colour still carries the hierarchy. Size no longer does.
 */
const SECONDARY_PRINTED = 'mt-1 mb-0 text-[1rem] text-ridge-mid'

export function PrepSheet({ onClose }: { onClose: () => void }) {
  const { log: symptomLog } = useSymptomLog()
  const { log: foodLog, todayKey } = useFoodLog()
  const { settings } = useSettings()

  /* Defaults to everything: an appointment usually covers the whole interval. */
  const [choice, setChoice] = useState<WindowChoice | 'all'>('all')
  const [questions, setQuestions] = useState(readPrepQuestions)
  const [persisted, setPersisted] = useState(true)

  const heading = useRef<HTMLHeadingElement>(null)
  const titleId = useId()
  const nameId = useId()

  const commit = useCallback((next: PrepQuestionsState) => {
    setQuestions(next)
    setPersisted(writePrepQuestions(next))
  }, [])

  const document_ = useMemo(
    () => buildPrep(choice, symptomLog, foodLog, todayKey, settings, questions.printName),
    [choice, symptomLog, foodLog, todayKey, settings, questions.printName],
  )

  /*
   * The app behind an opaque full screen overlay is not something she can
   * reach, so it should not be in the tab order or read by a screen reader
   * either. `inert` is the one line that does both, and it is removed on
   * unmount, including the unmount that happens when flare mode closes the gate
   * underneath this.
   */
  useEffect(() => {
    const root = window.document.getElementById('root')
    root?.setAttribute('inert', '')
    return () => root?.removeAttribute('inert')
  }, [])

  /* Opens at the top of the document rather than wherever the tab was scrolled. */
  useEffect(() => {
    heading.current?.focus()
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const stats = [
    document_.daysLine,
    document_.entriesLine,
    document_.symptomaticLine,
    document_.painLine,
    document_.hardestLine,
    document_.fatLine,
  ].filter((line): line is string => line !== null)

  return createPortal(
    <div
      data-print-sheet
      data-testid="prep-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 overflow-y-auto bg-paper"
    >
      <div className="mx-auto max-w-2xl px-5 py-6">
        {/* Everything in this row is machinery, and machinery does not print. */}
        <div className="mb-6 flex flex-col gap-3 print:hidden">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border-2 border-ridge-deep bg-ridge-deep px-4 py-3 font-semibold text-paper hover:border-ridge-mid hover:bg-ridge-mid"
            >
              {PREP_COPY.printAction}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border-2 border-stone bg-paper px-4 py-3 text-ink hover:border-creek"
            >
              {PREP_COPY.closeAction}
            </button>
          </div>

          <p className="m-0 text-sm text-ridge-mid">{PREP_COPY.printHint}</p>

          <WindowPicker value={choice} onChange={setChoice} />

          <div>
            <label htmlFor={nameId} className="font-semibold text-ridge-deep">
              {PREP_COPY.nameLabel}
            </label>
            <input
              id={nameId}
              type="text"
              value={questions.printName}
              onChange={(event) => commit(setPrintName(questions, event.target.value))}
              className="mt-1 min-h-11 w-full rounded-lg border-2 border-stone bg-paper px-4 py-2 text-ink focus:border-creek"
            />
            <p className="mt-1 mb-0 text-sm text-ridge-mid">{PREP_COPY.nameHint}</p>
          </div>

          {!persisted && (
            <p role="status" className="m-0 text-sm text-gold-text">
              This device is not letting the app save right now, so your questions may not be
              here next time.
            </p>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* The document itself starts here.                                  */}
        {/* ---------------------------------------------------------------- */}

        <header data-print-keep>
          <h1
            id={titleId}
            ref={heading}
            tabIndex={-1}
            className="mt-0 mb-1 text-2xl focus:outline-none"
          >
            {PREP_COPY.title}
          </h1>
          <p className="numeral mt-0 mb-3 text-ink">{document_.coversLine}</p>

          {/*
            THE SENTENCE THIS PAGE TURNS ON, and it is above every number on
            purpose. A clinician reads top to bottom, and this has to reach them
            before any statistic does. Addendum section B.
          */}
          <p className="mt-0 mb-0 border-l-4 border-ridge-mid py-1 pl-4 text-ink">
            {PREP_COPY.loggedOnly}
          </p>
        </header>

        {document_.nothingLogged ? (
          <p className="mt-6 mb-0 text-ink">{PREP_COPY.nothingLogged}</p>
        ) : (
          <section aria-labelledby="prep-stats-heading" data-print-keep className="mt-6">
            <h2 id="prep-stats-heading" className="mt-0 mb-2 text-xl">
              {PREP_COPY.statsTitle}
            </h2>

            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {stats.map((line) => (
                <li key={line} className="numeral text-ink">
                  {line}
                </li>
              ))}
            </ul>

            <p className="numeral mt-3 mb-0 text-ink">{document_.malabsorptionLine}</p>
            {document_.malabsorptionDaysLine !== null && (
              <p className="numeral mt-0 mb-0 text-ink">{document_.malabsorptionDaysLine}</p>
            )}
            {/*
              The one plain sentence, reused from the sheet that collects the
              chip rather than rewritten. No alarm, no colour, just information.
            */}
            {document_.malabsorptionInfo !== null && (
              <p className={SECONDARY_PRINTED}>{document_.malabsorptionInfo}</p>
            )}

            {/*
              Phase 11. Where the fat numbers came from, when any of them were
              estimated. Absent entirely otherwise.

              SECONDARY_PRINTED rather than text-sm, for the reason above this
              file's constant: this prints, a clinician reads it off paper, and
              provenance is not the thing to set in the smallest type on the
              page.
            */}
            {document_.aiEstimatedLine !== null && (
              <p className="numeral mt-3 mb-0 text-ink">{document_.aiEstimatedLine}</p>
            )}
            {document_.aiEstimatedNote !== null && (
              <p className={SECONDARY_PRINTED}>{document_.aiEstimatedNote}</p>
            )}
          </section>
        )}

        {document_.target !== null && (
          <section aria-labelledby="prep-target-heading" data-print-keep className="mt-6">
            <h2 id="prep-target-heading" className="mt-0 mb-2 text-xl">
              {PREP_COPY.targetTitle}
            </h2>
            <p className="numeral mt-0 mb-1 text-ink">{document_.target.line}</p>
            {/*
              Addendum section A. A clinician has to be able to tell in one line
              whether this number is one they gave her or one the app estimated,
              so the provenance sentence is not optional and never abbreviated.
            */}
            <p className={SECONDARY_PRINTED}>{document_.target.origin}</p>
          </section>
        )}

        {!document_.nothingLogged && (
          <section aria-labelledby="prep-patterns-heading" className="mt-6">
            <h2 id="prep-patterns-heading" className="mt-0 mb-2 text-xl">
              {PATTERN_COPY.patternsTitle}
            </h2>

            {/* Read before any food is named, on this page as on the other one. */}
            <p className="mt-0 mb-3 text-ink">{PATTERN_COPY.patternsFraming}</p>

            {document_.findings.belowGate ? (
              <p className="m-0 text-ink">{PATTERN_COPY.belowGate}</p>
            ) : document_.findings.hardDays.dateKeys.length === 0 ? (
              <p className="m-0 text-ink">{PATTERN_COPY.noHardGroup}</p>
            ) : document_.findings.patterns.length === 0 ? (
              <p className="m-0 text-ink">
                Nothing in your food log shows up often enough around those days to be worth
                listing.
              </p>
            ) : (
              <>
                {document_.hardDaysLine !== null && (
                  <p className={`numeral ${SECONDARY_PRINTED}`}>{document_.hardDaysLine}</p>
                )}
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {document_.findings.patterns.map((pattern) => (
                    <li key={pattern.name} data-print-keep className="numeral text-ink">
                      {/*
                        One sentence carrying both the hits and the counter
                        evidence. patternItemText always renders both, and
                        beforeOtherDays is a required field, so the balancing
                        number cannot be dropped here either.
                      */}
                      {patternItemText(pattern)}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        <PrepQuestions state={questions} onChange={commit} />

        {/* Invariant 2. Its own copy, because print hides the shell's. */}
        <div className="mt-8">
          <DisclaimerFooter />
        </div>

        {/*
          The running footer. Fixed only in print, where a fixed element repeats
          on every page, so a sheet that comes apart still says who it is about
          and what it covers. Hidden on screen, where the whole document is one
          scroll and a repeated line would be noise.
        */}
        <p
          data-print-footer
          aria-hidden="true"
          className="numeral m-0 hidden text-[1rem] text-ridge-mid print:block"
        >
          {document_.footerLine}
        </p>
      </div>
    </div>,
    window.document.body,
  )
}

/** The same three choices the Patterns tab offers, defaulting to everything. */
function WindowPicker({
  value,
  onChange,
}: {
  value: WindowChoice | 'all'
  onChange: (value: WindowChoice | 'all') => void
}) {
  const options: { value: WindowChoice | 'all'; label: string }[] = [
    ...WINDOW_CHOICES.map((choice) => ({ value: choice.days as WindowChoice, label: choice.label })),
    { value: 'all', label: 'Everything' },
  ]

  return (
    <div role="group" aria-label={PREP_COPY.rangeLabel} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`min-h-11 rounded-lg border-2 px-4 py-2 text-sm font-semibold ${
              selected
                ? 'border-ridge-deep bg-ridge-deep text-paper'
                : 'border-stone bg-paper text-ink hover:border-creek'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
