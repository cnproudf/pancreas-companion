# Worker: Deploy and Connect

The Worker is the only piece of this project that is not static. It exists for one reason: the Anthropic API key cannot live in code that ships to a browser.

## Deploy

```bash
cd worker
npm install -g wrangler          # if you do not have it
npx wrangler login               # opens a browser, one time

# Optional but recommended: rate limiting store
npx wrangler kv namespace create RATE_LIMIT_KV
# paste the returned id into wrangler.toml and uncomment that block

# The key itself, stored encrypted, never in a file
npx wrangler secret put ANTHROPIC_API_KEY
# paste the key when prompted

npx wrangler deploy
```

Deployment prints a URL like `https://pancreas-helper-api.YOUR-SUBDOMAIN.workers.dev`. That is what the client calls.

## Before it will work

Edit `ALLOWED_ORIGINS` at the top of `index.js` to list the real domain of the site plus your local dev URL. Requests from anywhere else get a 403. This is the single most important line in the file, because without it you have published a free Anthropic API endpoint to the internet.

Redeploy after editing.

## Client side

Store the Worker URL in the app as a build-time constant. It is not a secret; it is just an address. The key is what is secret, and it never leaves Cloudflare.

```js
const WORKER_URL = "https://pancreas-helper-api.YOUR-SUBDOMAIN.workers.dev";

export async function askAI({ query, queryType, mode, dailyTarget, remainingBudget }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, queryType, mode, dailyTarget, remainingBudget }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;                    // caller falls back to local data
  } finally {
    clearTimeout(timeout);
  }
}
```

`askAI` returns `null` on every failure path. The calling code must treat `null` as "no AI available right now" and show local results plus the universal restaurant playbook. She should never see an error state, a spinner that never resolves, or a stack trace.

## Cost

These are short, structured calls on a small model. Realistic personal use runs to a few cents a month. Set a spend limit on the Anthropic account anyway, because that is what spend limits are for.

## What to verify after deploying

1. Call the Worker from a browser tab on an unlisted domain. You should get a 403.
2. Call it from the real site. You should get valid JSON.
3. Send it a medical question ("should I go to the ER"). It should return `rating: "unknown"` and redirect to her care team, not answer.
4. Send it something with alcohol ("beer battered fish"). It should return red with no workaround that includes alcohol.
5. Turn off the Worker (or point the client at a bad URL) and confirm the app still fully works on local data.

Item 5 is the one to actually test, because it is the state the app will be in during any Cloudflare hiccup, and it is the state it must handle gracefully.
