import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { askAI, AI_TIMEOUT_MS } from './askAI.ts'

/**
 * INVARIANT 7, AS A SUITE. "If the Worker fails, times out, or is unreachable,
 * the app falls back silently to local data."
 *
 * Every test below is the same assertion in a different disguise: askAI returned
 * null and did not throw. A rejected promise or a thrown error would reach a
 * React render and become an error boundary, which is a visible error state, and
 * a result object carrying a message would eventually get rendered by somebody
 * who thought it was helpful.
 *
 * The second assertion in most of them is the dev warning, which is the only
 * signal that anything went wrong at all. A 403 that fails silently AND logs
 * nothing is an integration nobody can debug.
 *
 * First fetch mocking anywhere in this repo.
 */

const INPUT = {
  query: 'chicken shawarma',
  queryType: 'food' as const,
  mode: 'stable',
  dailyTarget: 30,
  remainingBudget: 18,
}

const GOOD_BODY = {
  rating: 'yellow',
  estimatedFatGrams: 14,
  servingAssumed: 'one wrap',
  reasoning: 'Wrapped sandwiches carry more oil than they look like they do.',
  modifications: ['Ask for it without the garlic sauce'],
  confidence: 'medium',
  source: 'ai-estimate',
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

let warn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('askAI', () => {
  it('returns the parsed advice on a clean call, and warns about nothing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(GOOD_BODY)))

    const advice = await askAI(INPUT)

    expect(advice).not.toBeNull()
    expect(advice?.rating).toBe('yellow')
    expect(advice?.estimatedFatGrams).toBe(14)
    expect(advice?.source).toBe('ai-estimate')
    expect(warn).not.toHaveBeenCalled()
  })

  it('sends the five fields the Worker reads, and no others', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => jsonResponse(GOOD_BODY))
    vi.stubGlobal('fetch', fetchMock)

    await askAI(INPUT)

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(init.body as string)).toEqual({
      query: 'chicken shawarma',
      queryType: 'food',
      mode: 'stable',
      dailyTarget: 30,
      remainingBudget: 18,
    })
  })

  /*
   * THE FAILURE MOST LIKELY TO HAPPEN FOR REAL. A domain change or a typo in
   * worker/index.js ALLOWED_ORIGINS produces exactly this, and invariant 7 makes
   * it look identical to success from the UI on purpose.
   */
  it('returns null and names the origin on a 403', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'forbidden' }, 403)))

    expect(await askAI(INPUT)).toBeNull()
    expect(warn).toHaveBeenCalledWith('[askAI] http-403', 'origin not in ALLOWED_ORIGINS')
  })

  it('returns null on any other non-ok status', async () => {
    for (const status of [429, 500, 502]) {
      vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'nope' }, status)))
      expect(await askAI(INPUT), `status ${status}`).toBeNull()
    }
  })

  /*
   * THIS IS WHAT A DISALLOWED ORIGIN ACTUALLY LOOKS LIKE, verified against the
   * live Worker on 2026-08-04.
   *
   * The Worker's forbidden branch returns no Access-Control-Allow-Origin header,
   * so the browser blocks the response at the CORS layer and fetch rejects with
   * a TypeError. JavaScript never sees the 403. The test above it covers the
   * branch anyway, because a non-browser client can read that status, but this
   * is the one that fires in real life and the hint has to name the cause.
   */
  it('returns null when the network throws, and names the origin as a likely cause', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )

    expect(await askAI(INPUT)).toBeNull()
    expect(warn.mock.calls[0]?.[0]).toBe('[askAI] network')
    expect(String(warn.mock.calls[0]?.[1])).toContain('ALLOWED_ORIGINS')
  })

  it('returns null when the body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected end of JSON input')
        },
      })),
    )

    expect(await askAI(INPUT)).toBeNull()
    expect(warn).toHaveBeenCalledWith('[askAI] unparseable', 'response body was not JSON')
  })

  it('aborts on the caller signal and reports it as an abort, not a network fault', async () => {
    const controller = new AbortController()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        return await new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const error = new Error('aborted')
            error.name = 'AbortError'
            reject(error)
          })
        })
      }),
    )

    const pending = askAI(INPUT, controller.signal)
    controller.abort()

    expect(await pending).toBeNull()
    expect(warn).toHaveBeenCalledWith('[askAI] aborted', '')
  })

  it('does not open a socket when the caller signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      // The controller is aborted before fetch is called, so a real fetch would
      // reject immediately. Reproduce that rather than resolving.
      if (init.signal?.aborted === true) {
        const error = new Error('aborted')
        error.name = 'AbortError'
        throw error
      }
      return jsonResponse(GOOD_BODY)
    })
    vi.stubGlobal('fetch', fetchMock)

    expect(await askAI(INPUT, controller.signal)).toBeNull()
  })

  it('aborts on its own timeout', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        return await new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const error = new Error('timed out')
            error.name = 'AbortError'
            reject(error)
          })
        })
      }),
    )

    const pending = askAI(INPUT)
    await vi.advanceTimersByTimeAsync(AI_TIMEOUT_MS)

    expect(await pending).toBeNull()
  })

  it('refuses a blank query without calling the Worker at all', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(GOOD_BODY))
    vi.stubGlobal('fetch', fetchMock)

    expect(await askAI({ ...INPUT, query: '   ' })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

/**
 * The client does not trust the Worker's own validateShape, because it cannot
 * see whether it ran. A stale deployment, a proxy that rewrites bodies, or a
 * captive portal returning a login page with a 200 all produce JSON that parses
 * and none of them produce this shape.
 */
describe('askAI shape validation', () => {
  it('coerces an unrecognized rating to unknown rather than to a colour', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ ...GOOD_BODY, rating: 'chartreuse' })),
    )

    const advice = await askAI(INPUT)
    expect(advice?.rating).toBe('unknown')
  })

  it('coerces an unrecognized confidence to low, the cautious direction', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ ...GOOD_BODY, confidence: 'absolute' })),
    )

    expect((await askAI(INPUT))?.confidence).toBe('low')
  })

  it('drops a gram value that is not a usable number', async () => {
    for (const grams of ['14', null, Number.NaN, Number.POSITIVE_INFINITY, -3, 900]) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => jsonResponse({ ...GOOD_BODY, estimatedFatGrams: grams })),
      )
      expect((await askAI(INPUT))?.estimatedFatGrams, String(grams)).toBeNull()
    }
  })

  it('keeps only the strings out of a mixed modifications array, capped at five', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          ...GOOD_BODY,
          modifications: ['a', 42, null, 'b', { c: 1 }, 'c', 'd', 'e', 'f', 'g'],
        }),
      ),
    )

    const advice = await askAI(INPUT)
    expect(advice?.modifications).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('returns null when the body is JSON but not an object', async () => {
    for (const body of [null, 42, 'green', ['green']]) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => jsonResponse(body)),
      )
      expect(await askAI(INPUT), JSON.stringify(body)).toBeNull()
    }
    expect(warn.mock.calls.some((call: unknown[]) => call[0] === '[askAI] bad-shape')).toBe(true)
  })

  it('survives an object with every field missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({})),
    )

    const advice = await askAI(INPUT)
    expect(advice).toEqual({
      rating: 'unknown',
      estimatedFatGrams: null,
      servingAssumed: '',
      reasoning: '',
      modifications: [],
      confidence: 'low',
      source: 'ai-estimate',
    })
  })
})
