/**
 * The Worker client. Phase 11, spec section 1 phase 2 and addendum section D.
 *
 * TRANSPORT ONLY. This module gets bytes back from Cloudflare and proves they
 * are the shape they claim to be. It does not normalize copy, run copy guards,
 * or decide a rating: that is aiAdvice.ts, and the split exists because those
 * are policy and this is plumbing.
 *
 * INVARIANT 6. The Worker URL is public and belongs in client code. The API key
 * is not and never appears outside Cloudflare secrets, which is the entire
 * reason this Worker exists rather than a direct call to the Anthropic API.
 *
 * INVARIANT 7. THIS FUNCTION RETURNS NULL ON EVERY FAILURE PATH, WITHOUT
 * EXCEPTION. Not a thrown error, not a rejected promise, not a result object
 * carrying a message. A caller cannot render an error state it was never handed,
 * and "the Worker is down" and "the Worker said no" have to look identical from
 * the outside because to her they are the same thing: the app works on local
 * data, which is what it did for the first ten phases.
 */

/**
 * Not a secret, and deliberately not import.meta.env. It is an address.
 *
 * .github/workflows/deploy.yml injects no environment at build time, so a VITE_
 * variable would mean editing CI to hide a string that is visible in the network
 * tab of anything that loads the site. The README says the same: "Store the
 * Worker URL in the app as a build-time constant. It is not a secret; it is just
 * an address."
 *
 * If this ever changes, worker/index.js ALLOWED_ORIGINS is the other half of the
 * pair, and a mismatch between them is a 403 that looks exactly like success.
 * See the note on devWarn below.
 */
const WORKER_URL = 'https://pancreas-helper-api.chadnproudfoot.workers.dev'

/**
 * FIVE SECONDS, NOT THE README'S EIGHT.
 *
 * The Worker calls Haiku with max_tokens 600 on a short structured prompt, which
 * comes back in one to three seconds on a working connection. Eight seconds only
 * buys the tail of that distribution, and it pays for it in the case that
 * actually matters: a Worker that is down, or a phone with one bar, where the
 * bound is not how long the answer takes but how long she looks at a screen that
 * is not going to produce one.
 *
 * The caller pairs this with a 400ms delay before anything appears at all, so a
 * fast lookup never flashes a placeholder and a dead one costs five seconds of a
 * quiet line rather than eight of a spinner. See useAiLookup.ts.
 */
export const AI_TIMEOUT_MS = 5000

/** Longest query the Worker accepts before truncating. Matches its own cap. */
const MAX_QUERY_LENGTH = 300

/**
 * A gram value the client will believe. The Worker clamps what it SENDS the
 * model, not what the model returns, so this is the first cap on the way back.
 * Nothing edible is 200 grams of fat in one serving, and a number past that is a
 * hallucinated decimal place rather than a big meal.
 */
const MAX_PLAUSIBLE_FAT_GRAMS = 200

/**
 * Note "unknown", which the app's own Rating in types.ts does not have. It is
 * the Worker's medical redirect: the system prompt tells the model to return it
 * rather than answer anything about symptoms, diagnosis, or seeking care. It
 * must never be mapped onto green, yellow, or red.
 */
export type AiRating = 'green' | 'yellow' | 'red' | 'unknown'

export type AiConfidence = 'high' | 'medium' | 'low'

export type AiQueryType = 'food' | 'restaurant'

/** Exactly what worker/index.js validateShape returns on a 200. */
export interface RawAiAdvice {
  rating: AiRating
  estimatedFatGrams: number | null
  servingAssumed: string
  reasoning: string
  modifications: string[]
  confidence: AiConfidence
  source: 'ai-estimate'
}

export interface AskAiInput {
  query: string
  queryType: AiQueryType
  mode: string
  dailyTarget: number
  remainingBudget: number
}

const RATINGS: readonly string[] = ['green', 'yellow', 'red', 'unknown']
const CONFIDENCES: readonly string[] = ['high', 'medium', 'low']

/**
 * WHY THIS EXISTS AT ALL, WHEN THE WORKER ALREADY VALIDATES.
 *
 * Because the Worker's validateShape runs on the far side of a network, and this
 * module cannot see whether it ran. A stale deployment, a proxy that rewrites
 * bodies, a captive portal returning a login page with a 200: all of them
 * produce JSON that parses and none of them produce this shape. Trusting a
 * remote validator is trusting that the thing you are talking to is the thing
 * you think you are talking to, which is the assumption a client does not get to
 * make.
 *
 * Same reasoning as the Worker's own comment about the system prompt: an
 * instruction is a request and not a guarantee.
 */
function parseAdvice(value: unknown): RawAiAdvice | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>

  const grams = raw.estimatedFatGrams
  const gramsOk =
    typeof grams === 'number' &&
    Number.isFinite(grams) &&
    grams >= 0 &&
    grams <= MAX_PLAUSIBLE_FAT_GRAMS

  return {
    // An unrecognized rating becomes "unknown", never a colour. Coercing a
    // surprise to green would be the single worst failure available here.
    rating: typeof raw.rating === 'string' && RATINGS.includes(raw.rating)
      ? (raw.rating as AiRating)
      : 'unknown',

    estimatedFatGrams: gramsOk ? grams : null,

    servingAssumed: typeof raw.servingAssumed === 'string' ? raw.servingAssumed.slice(0, 120) : '',
    reasoning: typeof raw.reasoning === 'string' ? raw.reasoning.slice(0, 600) : '',

    modifications: Array.isArray(raw.modifications)
      ? raw.modifications
          .filter((item): item is string => typeof item === 'string')
          .slice(0, 5)
          .map((item) => item.slice(0, 300))
      : [],

    // Unrecognized confidence reads as "low", the cautious direction.
    confidence: typeof raw.confidence === 'string' && CONFIDENCES.includes(raw.confidence)
      ? (raw.confidence as AiConfidence)
      : 'low',

    source: 'ai-estimate',
  }
}

/**
 * DEVELOPMENT ONLY. NEVER RENDERED, NEVER SHIPPED.
 *
 * Invariant 7 makes a broken Worker and a working one identical from the UI, on
 * purpose. That is right for her and unworkable for whoever is maintaining this,
 * because the most likely real failure is a 403 from an origin that fell out of
 * ALLOWED_ORIGINS after a domain change or a typo, and a 403 looks exactly like
 * "no AI available right now" from the outside. Without this line there is no
 * signal anywhere that the integration is broken.
 *
 * import.meta.env.DEV is statically replaced by Vite, so in a production build
 * this whole function body is unreachable and the bundler drops it along with
 * every string passed to it. Verified by grepping dist for "[askAI]".
 */
function devWarn(stage: string, detail?: unknown): void {
  if (!import.meta.env.DEV) return
  // eslint-disable-next-line no-console
  console.warn(`[askAI] ${stage}`, detail ?? '')
}

/**
 * Asks the Worker. Returns null on every failure, per invariant 7.
 *
 * `signal` is the caller's own abort, composed with the timeout below. The hook
 * uses it for three things the timeout cannot express: unmount, a changed query,
 * and flare mode closing the gate mid-flight. That last one is invariant 1, and
 * it is the reason this parameter exists rather than the timeout being the only
 * way out.
 */
export async function askAI(
  input: AskAiInput,
  signal?: AbortSignal,
): Promise<RawAiAdvice | null> {
  const query = input.query.trim().slice(0, MAX_QUERY_LENGTH)
  if (query === '') return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)

  // The caller's abort has to reach the fetch as well as the timeout's. If the
  // caller has already aborted, fire immediately rather than opening a socket.
  const forwardAbort = () => controller.abort()
  if (signal !== undefined) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', forwardAbort, { once: true })
  }

  try {
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        queryType: input.queryType,
        mode: input.mode,
        dailyTarget: input.dailyTarget,
        remainingBudget: input.remainingBudget,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      /*
       * Note that 403 does NOT arrive here from a browser, which is worth
       * knowing before spending an afternoon on it. The Worker's forbidden
       * branch returns no Access-Control-Allow-Origin header, so a disallowed
       * origin is blocked by CORS before JavaScript can read the status, and
       * fetch rejects into the catch below instead. Verified against the live
       * Worker. This branch covers the statuses that DO come back readable
       * (429 rate limited, 400 bad request, 502 upstream) and a 403 seen by a
       * non-browser client.
       */
      devWarn(`http-${response.status}`, response.status === 403 ? 'origin not in ALLOWED_ORIGINS' : '')
      return null
    }

    let body: unknown
    try {
      body = await response.json()
    } catch {
      devWarn('unparseable', 'response body was not JSON')
      return null
    }

    const advice = parseAdvice(body)
    if (advice === null) devWarn('bad-shape', body)
    return advice
  } catch (error) {
    /*
     * An abort is a normal outcome here, not a fault, but it is worth telling
     * apart from a genuine network failure while developing.
     *
     * AND THIS IS WHERE A DISALLOWED ORIGIN LANDS, as "TypeError: Failed to
     * fetch", indistinguishable from the wifi being off. It is the most likely
     * real failure of this integration, because it is what a domain change or a
     * typo in ALLOWED_ORIGINS produces, so the hint names it rather than making
     * the next person rediscover why a 403 never shows up as a 403.
     */
    const aborted = error instanceof Error && error.name === 'AbortError'
    devWarn(
      aborted ? 'aborted' : 'network',
      aborted ? '' : 'unreachable, or origin not in the Worker ALLOWED_ORIGINS (CORS hides the 403)',
    )
    return null
  } finally {
    clearTimeout(timeout)
    if (signal !== undefined) signal.removeEventListener('abort', forwardAbort)
  }
}
