/**
 * What the client is willing to show her from a model. Phase 11.
 *
 * askAI.ts proves the response is the right SHAPE. This module decides whether
 * its CONTENT may reach the DOM, and what rating it carries if it does. Pure
 * module, no React, no fetch.
 *
 * THE PROBLEM THIS SOLVES. Every user-facing string in the first ten phases was
 * written by hand and checked by a suite before it shipped: eighteen test files
 * run DASH_PATTERN, SCOLDING_PATTERN and the rest over every copy constant in
 * the app. AI output is generated at runtime and reaches the DOM without ever
 * passing a test. So the same guards have to run here, in production, on every
 * string, every time.
 *
 * The Worker does normalize dashes server side. This module does not trust that,
 * for three reasons that were all true when it was written:
 *
 *   1. It normalizes reasoning and modifications, and NOT servingAssumed, which
 *      is sliced and returned as-is (worker/index.js:133). An em dash reaches
 *      the client through that field today.
 *   2. It covers dashes and nothing else. Scolding, diagnosis, the directive
 *      "should", and alcohol in an offered modification are all prompt-only
 *      constraints with nothing enforcing them.
 *   3. A client cannot see whether the validator on the far side of a network
 *      actually ran. Same reasoning as parseAdvice in askAI.ts.
 */

import {
  DASH_PATTERN,
  DIAGNOSIS_PATTERN,
  DIRECTIVE_PATTERN,
  namesAlcohol,
  SCOLDING_PATTERN,
} from './copyGuards.ts'
import type { AiConfidence, AiRating, RawAiAdvice } from './askAI.ts'
import { rateForSettings, type RateForSettingsResult } from './rateForSettings.ts'
import { RATING_COPY, worst } from './rating.ts'
import type { Rating, Settings } from '../types.ts'

/** All AI-facing copy in one place, the way RATING_COPY and BUDGET_COPY do it. */
export const AI_COPY = {
  /**
   * The label on the block. Says what it is before she reads a word of it, and
   * the word "estimate" carries the whole disclosure.
   */
  heading: 'An estimate to check',

  /**
   * Spec 5.2: "clearly labeled as an estimate to confirm with the restaurant".
   * Spec 5.1 requires the same of any gram value. This is that sentence, and it
   * sits directly under the number rather than at the bottom of the card.
   */
  gramsNote: 'This number is a guess from a description, not a measurement. Check it with the kitchen.',

  /** Under the heading. Names the source without dressing it up. */
  provenance: 'Not from my list. Worked out from the name you typed, so it can be wrong.',

  confidenceLabel: 'Confidence',

  /** The one-line panel between 400ms and the answer. Promises nothing. */
  pending: 'Checking for an estimate. Everything above is what I already know.',

  lookupAction: 'Look this up',
  lookupAgainAction: 'Look this up again',

  /**
   * The medical redirect, for rating "unknown". The Worker's system prompt sends
   * the model here rather than letting it answer, and DIAGNOSIS_PATTERN below is
   * what happens when it answers anyway.
   */
  redirect: 'That one is a question for your care team, not for me.',

  modificationsTitle: 'How to ask for it',
} as const

/**
 * Mirrors normalizeCopy in worker/index.js, deliberately rather than by import,
 * because that file is a Cloudflare Worker and this one is a browser bundle and
 * neither can import the other.
 *
 * Invariant 9. If these two ever disagree, this one is the one that decides what
 * she sees, because it runs last.
 */
export function normalizeAiText(text: string): string {
  return text
    .replace(/[—–]/g, ', ')
    .replace(/ {2,}/g, ' ')
    .replace(/ +,/g, ',')
    .trim()
}

/**
 * The guards every AI string faces. Order does not matter; any one is fatal to
 * the string.
 *
 * DASH_PATTERN is in here even though normalizeAiText just removed every dash it
 * knows about, and that is not redundancy. It is the assertion that normalization
 * did what it claims, so a future edit that breaks the replace fails loudly here
 * instead of quietly shipping an em dash.
 */
const TEXT_GUARDS: readonly { name: string; pattern: RegExp }[] = [
  { name: 'dash', pattern: DASH_PATTERN },
  { name: 'scolding', pattern: SCOLDING_PATTERN },
  { name: 'diagnosis', pattern: DIAGNOSIS_PATTERN },
  { name: 'directive', pattern: DIRECTIVE_PATTERN },
]

/** Which guard a string tripped, or null when it is clean. */
export function guardFailure(text: string, checkAlcohol: boolean): string | null {
  for (const guard of TEXT_GUARDS) {
    if (guard.pattern.test(text)) return guard.name
  }
  // Invariant 4, for the fields that OFFER her something. Not for reasoning:
  // naming alcohol is how a red gets explained, exactly as copyGuards.ts already
  // says about avoid lists.
  if (checkAlcohol && namesAlcohol(text)) return 'alcohol'
  return null
}

export interface AiAdvice {
  /**
   * The final verdict, after reconciliation. Null means no traffic light at all,
   * which happens for the medical redirect and when there is no gram value or no
   * daily target to rate against.
   */
  rating: Rating | null
  /** True for the Worker's "unknown", so the UI can show the redirect line. */
  isRedirect: boolean
  fatGrams: number | null
  servingAssumed: string
  reasoning: string
  modifications: string[]
  confidence: AiConfidence
  /** Populated when a gram value was rated, so the card can show the budget line. */
  rated: Extract<RateForSettingsResult, { status: 'rated' }> | null
}

export interface ToDisplayableContext {
  settings: Settings
  gramsUsedToday: number
  /** What she typed. Checked for alcohol in its own right. */
  query: string
  /** Test seam. Defaults to the real dev logger. */
  onDrop?: ((field: string, reason: string) => void) | undefined
}

/** The AI's own rating, as one of the app's three, or null for "unknown". */
function asAppRating(rating: AiRating): Rating | null {
  return rating === 'unknown' ? null : rating
}

/**
 * Normalizes, guards, rates. Returns null when the result may not be shown at
 * all, which the caller treats exactly like the Worker being down.
 */
export function toDisplayable(
  raw: RawAiAdvice,
  context: ToDisplayableContext,
): AiAdvice | null {
  const drop = context.onDrop ?? defaultOnDrop

  const reasoning = normalizeAiText(raw.reasoning)

  /*
   * A TRIPPED REASONING TAKES THE WHOLE RESULT DOWN, rather than rendering the
   * card without it. This is a deliberate departure from the drop-the-string
   * rule that governs the other two fields.
   *
   * A traffic light with no explanation is worse than no traffic light, because
   * she cannot audit it. The rating is a verdict, and a verdict whose working
   * she cannot check is the one thing this app should never hand her: every
   * local card carries its reasons for exactly that purpose, and an AI card
   * showing a bare red with nothing under it would be the app asserting
   * authority it has not earned.
   *
   * An empty reasoning fails the same way. There is nothing to show.
   */
  if (reasoning === '') {
    drop('reasoning', 'empty')
    return null
  }
  const reasoningFailure = guardFailure(reasoning, false)
  if (reasoningFailure !== null) {
    drop('reasoning', reasoningFailure)
    return null
  }

  /*
   * Invariant 4, at the top level. If what she typed names a drink, or the model
   * named one anywhere it was offering her something, the answer is red with
   * nothing offered. No modifications, no workaround, no "try a smaller glass".
   */
  const queryIsAlcohol = namesAlcohol(context.query)

  const servingCandidate = normalizeAiText(raw.servingAssumed)
  const servingFailure =
    servingCandidate === '' ? null : guardFailure(servingCandidate, true)
  if (servingFailure !== null) drop('servingAssumed', servingFailure)
  const servingAssumed = servingFailure === null ? servingCandidate : ''

  const modifications: string[] = []
  if (!queryIsAlcohol) {
    for (const candidate of raw.modifications) {
      const text = normalizeAiText(candidate)
      if (text === '') continue
      const failure = guardFailure(text, true)
      if (failure !== null) {
        drop('modification', failure)
        continue
      }
      modifications.push(text)
    }
  } else if (raw.modifications.length > 0) {
    drop('modification', 'alcohol-query')
  }

  const aiRating = asAppRating(raw.rating)
  const isRedirect = raw.rating === 'unknown'

  /*
   * The redirect. The Worker's system prompt routes anything medical here, and
   * the shape of that answer is a sentence and nothing else: no rating, no
   * grams, no modifications. Rule 6 and invariant 2.
   */
  if (isRedirect) {
    return {
      rating: null,
      isRedirect: true,
      fatGrams: null,
      servingAssumed: '',
      reasoning,
      modifications: [],
      confidence: raw.confidence,
      rated: null,
    }
  }

  const grams = raw.estimatedFatGrams
  const result =
    grams === null
      ? null
      : rateForSettings(context.settings, {
          fatGrams: grams,
          gramsUsedToday: context.gramsUsedToday,
        })

  const rated = result !== null && result.status === 'rated' ? result : null

  /*
   * No gram value, or no daily target, means no traffic light. Same policy the
   * food checker already applies to a local food in the 'no-target' branch: the
   * facts about the food still show, and only the verdict is withheld. Never
   * faked.
   *
   * THE RECONCILIATION. `worst` is rating.ts's own, the same function the engine
   * uses to let a flag override arithmetic, and it resolves in one direction
   * only. That direction is the point:
   *
   * The AI may only ever make a result MORE cautious, never less. It does not
   * know her remaining budget or her thresholds, and the local engine does, so
   * it has no standing to upgrade a rating the arithmetic produced. What it does
   * have is sight of things a gram count alone cannot show: deep fried, built on
   * cream or butter, alcohol as an ingredient. Those can only push toward red.
   * A green from the model over a red from rateForSettings would be the model
   * overruling her budget with a guess, which is the one direction this must
   * never resolve.
   *
   * aiRating is non-null here, since the "unknown" case returned above. The
   * fallback is green because green is the identity for `worst`.
   */
  let rating: Rating | null =
    rated === null ? null : worst(rated.rating.rating, aiRating ?? 'green')

  /*
   * Invariant 4, and the one place this module overwrites model prose rather
   * than dropping it.
   *
   * Alcohol is red at zero grams and red with no target, because invariant 4
   * does not depend on arithmetic. But a red light over a model's explanation of
   * why something is fine would be a contradiction on the single item that must
   * never be encouraged, and the reasoning is what she reads to audit the light.
   * So the sentence is replaced with the app's own, which is hand written and
   * already pinned by rating.test.ts, rather than trusted from a model that just
   * disagreed with us about alcohol.
   */
  let finalReasoning = reasoning
  if (queryIsAlcohol) {
    rating = 'red'
    finalReasoning = RATING_COPY.alcohol
  }

  return {
    rating,
    isRedirect: false,
    fatGrams: grams === null ? null : Math.round(grams * 10) / 10,
    servingAssumed,
    reasoning: finalReasoning,
    modifications: queryIsAlcohol ? [] : modifications,
    confidence: raw.confidence,
    rated,
  }
}

function defaultOnDrop(field: string, reason: string): void {
  if (!import.meta.env.DEV) return
  // eslint-disable-next-line no-console
  console.warn(`[askAI] guard-tripped ${field}:${reason}`)
}
