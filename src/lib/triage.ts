/**
 * The flare mode triage gate. Main spec section 4.
 *
 * INVARIANT 1: FLARE MODE OPENS THE TRIAGE SCREEN BEFORE ANY FOOD CONTENT.
 * ALWAYS.
 *
 * This module is the policy half of that invariant. The structural half is
 * FlareGate.tsx, and the two guards that live outside it, FatBudgetBar and
 * AttachFoodSection. All three ask foodGuidanceAllowed() rather than checking
 * the mode themselves, so there is exactly one definition of when food guidance
 * may render.
 *
 * HOW THIS SQUARES WITH SPEC RULE 6, WHICH SAYS THE APP NEVER INTERPRETS
 * SYMPTOMS.
 *
 * Rule 6 is scoped by its own first clause to the AI layer: the model never
 * answers medical questions, never interprets symptoms, and never tells her
 * whether to seek care. Section 4 meanwhile instructs the APP to ask five
 * symptom questions and route her to care. Both are in the same document, and
 * the distinction is not a loophole, it is the design:
 *
 *   The app asks a fixed list, routes every yes to a person, and never forms a
 *   view.
 *
 * Concretely, and each of these is a constraint on future changes to this file:
 *
 *   1. RED_FLAGS is authored, fixed, and identical every time. Nothing
 *      generates, ranks, reorders, or personalizes it.
 *   2. Nothing here reads her symptom log, her pain slider, her chips, or her
 *      food log. The only input is the button she taps. This is the line
 *      easiest to cross with good intentions ("she logged pain 9 yesterday,
 *      pre-check the first box"), and crossing it would be the app forming a
 *      view about her.
 *   3. A yes produces a routing action, not an assessment. No branch of
 *      TRIAGE_COPY names a condition, offers a likelihood, or grades urgency.
 *   4. A no is not a clearance. No branch tells her she is fine.
 *   5. Errors go one direction. Any yes routes to a human.
 *   6. Continuing is her assertion, never the app's conclusion.
 *   7. Nothing here writes to her log. Triage records no finding, because it
 *      reaches no finding.
 *
 * THIS MODULE DELIBERATELY DOES NOT IMPORT storage.ts, AND MUST NOT.
 *
 * That absence is the enforcement of a decision: triage clearance lives in
 * memory only. A reload, a relaunch, or leaving flare mode and coming back all
 * re-arm the gate. Persisting it would mean that on a multi-day flare the gate
 * stays open across days, and red flags can appear on day three. The cost is
 * that she re-taps "No, but I feel off" when she reopens the app, and that is
 * the right trade for the one screen in this app that exists to catch something
 * dangerous.
 */

import type { Mode } from '../types.ts'

/**
 * The stage of the gate, for the current flare.
 *
 * Only meaningful in flare mode. In stable and recovering the stage still
 * exists (the provider always has a value) but foodGuidanceAllowed ignores it.
 */
export type TriageStage =
  /** What flare mode opens to. The five questions, and nothing else. */
  | 'redflag-check'
  /** She answered yes. Contact panel, no food content. */
  | 'urgent'
  /** She answered no, or said she has already contacted them. */
  | 'cleared'

/**
 * The five red flags, main spec section 4, in its order and close to its words.
 *
 * ONE CONSTANT, TWO CONSUMERS. The triage check and the When To Call card
 * (spec 5.10: "Lists the red-flag symptoms from section 4") both read this.
 * Two copies of a list like this drift, and the drift would be silent: the card
 * she reaches from the header would stop matching the screen that gates her
 * flare, and nobody would notice until it mattered.
 */
export const RED_FLAGS: readonly string[] = [
  'Severe pain in your upper abdomen, especially pain that goes through to your back',
  'Vomiting you cannot stop, or you cannot keep fluids down',
  'Fever or chills',
  'Racing heartbeat, dizziness, or feeling faint',
  'Pain that is getting worse rather than better',
] as const

/**
 * All triage and When To Call copy in one place so the tone can be reviewed at
 * a glance, the way RATING_COPY, BAR_COPY, and SYMPTOM_COPY do it.
 *
 * This is the highest stakes writing in the app. She reads it when she may
 * genuinely need care. Invariant 9: no em dashes. Invariant 10: never scold.
 * Rule 6: no branch below names a condition or grades her likelihood of having
 * one.
 *
 * TWO DELIBERATE DEPARTURES FROM THE SPEC, BOTH SIGNED OFF, BOTH RECORDED HERE
 * SO NOBODY READS THE SPEC LATER AND HELPFULLY "FIXES" THEM.
 *
 * First, what is NOT here. Spec section 4 asks the urgent panel for "a line
 * noting that acute pancreatitis is a condition where prompt care genuinely
 * matters." That line is cut. It is a clinical claim about her condition
 * wearing an encouraging coat, and it is the one sentence in the drafted panel
 * that edged toward what rule 6 forbids. The urgency is carried by the screen
 * existing. DO NOT ADD IT BACK.
 *
 * Second, what is here that the spec does not authorize: urgentEmergency, the
 * 911 line. Section 4 lists "racing heartbeat, dizziness, or feeling faint" as
 * a red flag but never mentions emergency services, and that symptom cluster is
 * exactly where "call your doctor" is the wrong speed. It is placed AFTER the
 * call buttons, not before, so it reads as escalation rather than as the
 * default. The ordering is load bearing.
 *
 * And one line that survived review on purpose: urgentPermission, "Nobody is
 * going to think you overreacted." It is not medical advice and not a claim
 * about her condition. The failure this panel exists to prevent is hesitation,
 * and hesitation is social rather than informational.
 */
export const TRIAGE_COPY = {
  /* The red flag check. */
  checkTitle: 'Before we talk about food',
  checkIntro: 'A quick check first. Are you having any of these right now?',
  /*
   * Same size, same weight, same prominence in the component. Making "No" the
   * big friendly one would be the app nudging her toward the answer that keeps
   * her here.
   */
  answerYes: 'Yes, one or more',
  answerNo: 'No, but I feel off',

  /* The yes branch. */
  urgentTitle: 'Please contact your care team now',
  urgentAction: 'Call your doctor, or go to urgent care or the emergency department.',
  urgentPermission: 'Nobody is going to think you overreacted.',
  urgentEmergency: 'If you feel like you might pass out, call 911 or have someone drive you.',
  urgentUnreachable:
    'If you cannot reach anyone, urgent care or the emergency department is the right next step.',
  urgentNoContacts:
    'You have not added your care team numbers yet. You can add one here, or go to urgent care or the emergency department.',
  /*
   * Below the fold, per section 4: "sometimes she has already called and is
   * waiting." A link rather than a button, at body size, positioned so it takes
   * a scroll to reach on a phone. It is her assertion, so it is worded as one.
   */
  urgentContinue: 'I have already contacted them. Continue to food guidance.',

  /* The no branch: flare food guidance. */
  guidanceTitle: 'Clear liquids first',
  guidanceLiquids:
    'Broth, water, gelatin, apple juice, white grape juice. Small amounts, often.',
  guidanceSchedule:
    'The schedule for moving back to solid food comes from your doctor, not from this app.',
  /*
   * Behind a disclosure, closed by default. Six blocks is too much to read when
   * she feels terrible, so only the three lines above and the two below are
   * visible without a tap.
   */
  guidanceMoreLabel: 'More on eating during a flare',
  guidanceReadyTitle: 'When you are ready for food',
  guidanceReady:
    'Plain rice, applesauce, bananas, dry toast, plain baked potato, gelatin. Very small portions.',
  guidanceFlags:
    'While you are here, the app also flags high fiber and high sugar, which are harder to handle right now.',
  /* Addendum section A: an upper bound, framed as one, never as a goal. */
  guidanceCeiling:
    'A working ceiling of 15 grams of fat for the day. That is an upper bound, not a goal.',
  /* Stays visible. It is the one line here that routes to a person. */
  guidanceCannotEat: 'If you cannot eat at all, that is worth telling your care team.',
  /* Also stays visible. A no is not a clearance, so the way back is never hidden. */
  guidanceStillWrong: 'Still feel like something is wrong?',

  /* The When To Call card, spec 5.10. */
  whenToCallTitle: 'When to call',
  whenToCallIntro: 'Call your care team if you have any of these:',
  whenToCallUrgency: 'Severe or worsening pain needs care now, not tomorrow.',
  whenToCallOpen: 'When to call',
  whenToCallClose: 'Close',
  whenToCallNoContacts:
    'You have not added your care team numbers yet. Add one below and it will be here when you need it.',

  /* Care team editing. Lives with the numbers rather than in a settings screen. */
  contactsTitle: 'Your care team',
  contactsAdd: 'Add a number',
  contactsName: 'Name',
  contactsPhone: 'Phone',
  contactsRole: 'Who this is',
  contactsNotes: 'Notes',
  contactsSave: 'Save',
  contactsCancel: 'Cancel',
  contactsEdit: 'Edit',
  contactsRemove: 'Remove',
  contactsRemoveConfirm: 'Remove this number?',
  /** {name} is filled in by the component. */
  contactsDial: 'Call {name}',
} as const

/**
 * THE ONE DEFINITION OF WHEN FOOD GUIDANCE MAY RENDER. Invariant 1.
 *
 * Read by FlareGate, and by the two components that render outside it and carry
 * their own guard: FatBudgetBar and AttachFoodSection. Before this existed all
 * three wrote `settings.currentMode === 'flare'` by hand, which was correct
 * while the gate had two states and became wrong the moment it had three.
 *
 * "Food guidance" is the narrowed rule from CLAUDE.md's working agreement: a
 * rating, a gram value, a portion, a meal, or anything answering "should I eat
 * this". Trivia that happens to name a banana is not guidance, which is why the
 * Daily Lift may sit above the gate.
 */
export function foodGuidanceAllowed(mode: Mode, stage: TriageStage): boolean {
  return mode !== 'flare' || stage === 'cleared'
}

/**
 * A phone number as a tel: target. Spec 5.10 wants tap to dial.
 *
 * Keeps digits, a leading plus, and the characters a dialer actually
 * understands: commas and semicolons are pause and wait, and both matter for a
 * number with an extension. Everything else, including the spaces, parentheses,
 * and dashes she typed for readability, is dropped.
 *
 * Returns null rather than an empty "tel:" when there is nothing dialable, so
 * the component renders plain text instead of a link that would do nothing.
 */
export function telHref(phone: string): string | null {
  const trimmed = phone.trim()
  const plus = trimmed.startsWith('+') ? '+' : ''
  const rest = trimmed.replace(/[^0-9,;]/g, '')

  if (rest.replace(/[,;]/g, '') === '') return null
  return `tel:${plus}${rest}`
}
