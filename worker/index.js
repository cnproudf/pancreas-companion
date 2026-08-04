/**
 * Pancreas-Friendly Eating Companion: API Worker
 *
 * Holds the Anthropic API key server side so the static GitHub Pages site
 * never exposes it. Deploy with wrangler; see README-WORKER.md.
 *
 * Security posture:
 *   - Origin allowlist, enforced on every request including preflight
 *   - Request body size cap
 *   - Per-IP rate limit via KV, degrades open if KV is not bound
 *   - No logging of request or response bodies
 */

const ALLOWED_ORIGINS = [
  "https://cnproudf.github.io",
  "http://localhost:5173",
];

const MAX_BODY_BYTES = 2048;
const RATE_LIMIT_PER_HOUR = 100;
const MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_VERSION = "2023-06-01";

const SYSTEM_PROMPT = `You help one person with pancreatitis evaluate foods and plan restaurant orders.

SCOPE. Respond only about food composition, fat content, and preparation methods. Never discuss symptoms, diagnosis, treatment, medication, enzyme dosing, or whether the person should seek medical care. If a request touches any of those, set reasoning to a single sentence directing them to their care team and set rating to "unknown".

ALCOHOL. Never suggest, endorse, or find a workaround for anything containing alcohol, including as a cooking ingredient. Anything containing alcohol is rated red with no modifications offered.

ESTIMATES. Fat values vary widely by brand, cut, portion, and kitchen. Always treat your numbers as estimates and set confidence honestly. If you are guessing at a specific restaurant's preparation, confidence is "low".

RATING. Rate against the person's remaining fat budget for the day, which is provided. Roughly: 10 percent or less of their daily target is green, up to 25 percent is yellow, above that is red. Deep fried items and items built on cream, butter, or cheese are red regardless.

MODIFICATIONS. Always give specific, orderable modifications, even for green items. Say what to ask the kitchen for in plain words the person can repeat to a server. Prefer concrete swaps ("ask for it grilled dry with no butter") over general advice ("choose healthier options").

TONE. Warm, practical, never scolding. Never imply the person did something wrong.

COPY. Never use em dashes or en dashes in any output. Use commas, colons, or separate sentences. Do not use the word "should" in a directive sense about what the person eats.

OUTPUT. Return raw JSON only. No markdown fences, no preamble, no trailing text. Schema:
{
  "rating": "green" | "yellow" | "red" | "unknown",
  "estimatedFatGrams": number | null,
  "servingAssumed": string,
  "reasoning": string,
  "modifications": string[],
  "confidence": "high" | "medium" | "low"
}
Keep reasoning under 60 words. Give 1 to 4 modifications.`;

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin || "null") },
  });
}

async function underRateLimit(env, ip) {
  if (!env.RATE_LIMIT_KV) return true; // degrade open if KV is not configured
  const hourBucket = Math.floor(Date.now() / 3600000);
  const key = `rl:${ip}:${hourBucket}`;
  const current = parseInt((await env.RATE_LIMIT_KV.get(key)) || "0", 10);
  if (current >= RATE_LIMIT_PER_HOUR) return false;
  await env.RATE_LIMIT_KV.put(key, String(current + 1), { expirationTtl: 3900 });
  return true;
}

function buildUserMessage(payload) {
  const { queryType, query, mode, dailyTarget, remainingBudget } = payload;

  const context = [
    `Mode: ${mode}`,
    `Daily fat target: ${dailyTarget} grams`,
    `Remaining budget today: ${remainingBudget} grams`,
  ].join("\n");

  if (queryType === "restaurant") {
    return `${context}

The person is planning to eat at: ${query}

Suggest what to order and how to order it. Put the estimated fat grams and rating on your single best recommendation. Use "modifications" for the specific things to ask the kitchen for. If you do not know this restaurant, say so in reasoning, set confidence to "low", and give strategy based on the likely cuisine type.`;
  }

  return `${context}

Evaluate this food or dish: ${query}`;
}

function extractJson(text) {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

// Invariant 9 applies to model output too. The system prompt asks for this, but
// an instruction is a request and not a guarantee, so the client is not asked to
// trust it. Both prose fields are normalized on the way in.
function normalizeCopy(s) {
  return s
    .replace(/[—–]/g, ", ")
    .replace(/ {2,}/g, " ")
    .replace(/ +,/g, ",")
    .trim();
}

function validateShape(obj) {
  if (!obj || typeof obj !== "object") return null;
  const ratings = ["green", "yellow", "red", "unknown"];
  const confidences = ["high", "medium", "low"];
  return {
    rating: ratings.includes(obj.rating) ? obj.rating : "unknown",
    estimatedFatGrams:
      typeof obj.estimatedFatGrams === "number" && isFinite(obj.estimatedFatGrams)
        ? obj.estimatedFatGrams
        : null,
    servingAssumed: typeof obj.servingAssumed === "string" ? obj.servingAssumed.slice(0, 120) : "",
    reasoning: typeof obj.reasoning === "string" ? normalizeCopy(obj.reasoning).slice(0, 600) : "",
    modifications: Array.isArray(obj.modifications)
      ? obj.modifications
          .filter((m) => typeof m === "string")
          .slice(0, 5)
          .map((m) => normalizeCopy(m).slice(0, 300))
      : [],
    confidence: confidences.includes(obj.confidence) ? obj.confidence : "low",
    source: "ai-estimate",
  };
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const allowed = ALLOWED_ORIGINS.includes(origin);

    if (request.method === "OPTIONS") {
      if (!allowed) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (!allowed) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405, origin);
    }

    const declaredLength = parseInt(request.headers.get("Content-Length") || "0", 10);
    if (declaredLength > MAX_BODY_BYTES) {
      return json({ error: "payload_too_large" }, 413, origin);
    }

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (!(await underRateLimit(env, ip))) {
      return json({ error: "rate_limited" }, 429, origin);
    }

    let raw;
    try {
      raw = await request.text();
    } catch {
      return json({ error: "unreadable_body" }, 400, origin);
    }
    if (raw.length > MAX_BODY_BYTES) {
      return json({ error: "payload_too_large" }, 413, origin);
    }

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return json({ error: "invalid_json" }, 400, origin);
    }

    const query = typeof payload.query === "string" ? payload.query.trim().slice(0, 300) : "";
    if (!query) return json({ error: "missing_query" }, 400, origin);

    const safe = {
      query,
      queryType: payload.queryType === "restaurant" ? "restaurant" : "food",
      mode: ["stable", "recovering", "flare"].includes(payload.mode) ? payload.mode : "stable",
      dailyTarget: Number.isFinite(payload.dailyTarget) ? Math.max(5, Math.min(80, payload.dailyTarget)) : 30,
      remainingBudget: Number.isFinite(payload.remainingBudget)
        ? Math.max(0, Math.min(80, payload.remainingBudget))
        : 30,
    };

    let upstream;
    try {
      upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 600,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildUserMessage(safe) }],
        }),
      });
    } catch {
      return json({ error: "upstream_unreachable" }, 502, origin);
    }

    if (!upstream.ok) {
      // Deliberately does not forward upstream error text, which can contain
      // account details. The client falls back to local data on any failure.
      return json({ error: "upstream_error", status: upstream.status }, 502, origin);
    }

    let data;
    try {
      data = await upstream.json();
    } catch {
      return json({ error: "upstream_unparseable" }, 502, origin);
    }

    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const result = validateShape(extractJson(text));
    if (!result) return json({ error: "model_output_invalid" }, 502, origin);

    return json(result, 200, origin);
  },
};
