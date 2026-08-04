# Spec Addendum: Fat Target Calculator, Symptom Log, Design System, Worker

This supplements the main build spec. Where the two conflict, this file wins.

---

## A. Fat target calculator

### What NPF actually publishes

The National Pancreas Foundation states that the right amount of fat varies by weight and height, and that daily fat should be spread across 4 to 6 small meals rather than concentrated in one. Their pocket guide sets the band: many people with chronic pancreatitis should stay under 50 grams per day, and others need to stay between 30 and 50, depending on height, weight, and personal tolerance.

**NPF does not publish a formula or a lookup table.** The app must not imply that it does. What follows is standard clinical arithmetic used to personalize a number, with the result constrained inside NPF's published band. The interface says exactly that.

### Inputs (Settings, editable at any time)

- Age in years
- Height (feet and inches, or centimeters)
- Weight (pounds or kilograms)
- Activity level: mostly resting / light activity / moderately active
- Optional: biological sex, used only for the energy equation, with a clear note explaining why it is asked and a "prefer not to say" option that defaults to the female equation

Store the timestamp of the last update. If it has been more than 90 days, show a soft prompt asking whether anything has changed. Never nag.

### Calculation

```
Step 1. Basal energy, Mifflin-St Jeor
  female:  BMR = (10 * kg) + (6.25 * cm) - (5 * age) - 161
  male:    BMR = (10 * kg) + (6.25 * cm) - (5 * age) + 5

Step 2. Daily energy
  activityFactor: resting 1.2, light 1.375, moderate 1.55
  TDEE = BMR * activityFactor

Step 3. Fat calories, by mode
  STABLE:      fatPercent = 0.25
  RECOVERING:  fatPercent = 0.20
  fatGrams = (TDEE * fatPercent) / 9

Step 4. Clamp to the published band
  STABLE:      clamp(fatGrams, 30, 50)
  RECOVERING:  clamp(fatGrams, 20, 30)
  FLARE:       not calculated. See below.

Step 5. Round to the nearest whole gram.
```

**Flare mode does not get a calculated target.** NPF describes flares as a time when a doctor may recommend no food for a day or two, with clear liquids when pain is severe. So flare mode displays a fixed working ceiling of 15 grams, framed as an upper bound rather than a goal, and leads with the clear liquid guidance and the instruction that the schedule for advancing the diet comes from her doctor, not from this app.

### Presentation

Show the number large, then a collapsible "how we got this" panel with the arithmetic laid out step by step. People trust numbers they can audit.

Directly beneath, permanently:

> This is a starting estimate based on your height, weight, age, and activity, kept inside the 30 to 50 gram range the National Pancreas Foundation publishes for chronic pancreatitis. It is not a number from your care team. Ask your doctor or a registered dietitian what your target should be, and enter it below.

Provide a **manual override field** that always takes precedence over the calculation and is visually marked as the authoritative value once set. If she enters a number from her dietitian, the calculator becomes decorative and the app says so.

Also display, always: "Spread this across 4 to 6 small meals rather than 2 or 3 large ones." That is the part of NPF's guidance most people skip, and it matters as much as the total.

---

## B. Symptom log, revised

Replace the daily journal from the main spec. No daily prompt, no streak counter, no "you missed a day." Those mechanics turn a health tool into an obligation, and an obligation is the last thing she needs.

### Behavior

One persistent button, reachable in a single tap from anywhere: **"Log how I am feeling."**

Opens a short sheet. Timestamp is captured automatically and is the only required field. Everything else is optional. She can log nothing but the time and close it, and that is a valid entry meaning "something was happening here."

Fields:
- **Timestamp** (auto, editable in case she is logging something from yesterday)
- **Pain**, 0 to 10 slider, skippable
- **Symptom chips**, multi-select: nausea, vomiting, bloating, back pain, no appetite, fatigue, fever or chills, greasy or floating or pale stool, diarrhea, other
- **Free text**, one field, no character minimum
- **Attach what I ate**, optional, pulls the last 24 hours from the food log with checkboxes

The greasy, floating, or pale stool chip should have a small info tap that explains, in one plain sentence, that this can indicate fat malabsorption and is worth telling her doctor about. No alarm, no color, just information.

### Pattern view

Plot logged symptom events as discrete points on a timeline, with daily logged fat intake as a light background series. Not a continuous daily line, because the data is not continuous.

**Critical framing requirement:** gaps in the log are not good days. The app must never render an unlogged day as a zero, a green day, or a symptom-free day. Show gaps as gaps. Any summary statistic must be phrased as "across the days you logged," never as a rate over calendar time.

Present all correlations as *possible patterns worth mentioning to your doctor*. Never causal. A sample of one produces spurious associations constantly, and the harm of her wrongly eliminating a food she loves is real.

### Appointment prep

Unchanged from the main spec, with one adjustment: the summary reports the number of entries and the date range covered, and states plainly that this reflects logged events only.

---

## C. Design system: Blue Ridge

The visual language is the Blue Ridge in late afternoon. Layered ridgelines fading into haze, laurel green, creek water, warm paper. Dignified, not costume. Nothing that reads as rustic-themed restaurant decor, no faux woodcut, no wagon-wheel typography, no distressed textures.

### Palette

```css
:root {
  /* Ridges, near to far */
  --ridge-deep:   #1C3A4B;  /* nearest ridge, primary text, headers */
  --ridge-mid:    #3D6382;  /* middle distance */
  --ridge-haze:   #8FA9BC;  /* farthest ridge, DECORATIVE ONLY, never text on light */

  /* Greens */
  --laurel:       #3A6B4E;  /* mountain laurel, GREEN rating */
  --moss:         #6B8F6B;  /* soft accent, secondary buttons */

  /* Water */
  --creek:        #3E7C7A;  /* links and interactive elements */

  /* Ground */
  --paper:        #F5F2EA;  /* page background, warm off-white */
  --stone:        #DED7C9;  /* card borders, dividers */
  --ink:          #22282B;  /* body text */

  /* Ratings and alerts */
  --gold:         #B5762C;  /* YELLOW rating fill, Daily Lift accent */
  --gold-text:    #8A5A20;  /* darker variant, use for text on paper */
  --clay:         #9E3B2F;  /* RED rating, and the When To Call card */
}
```

**Contrast rules, non-negotiable:**
- `--gold` at #B5762C does not meet WCAG AA against `--paper` for small text. Use it for fills, bars, and icons only. Use `--gold-text` for any yellow-rating wording.
- `--ridge-haze` is decoration. Never body text, never labels, never anything a person needs to read.
- Every traffic light rating carries a color, an icon, and a word. Never color alone.

### Ridgeline motif

Build one reusable SVG component: four stacked ridge silhouettes, each lighter and lower contrast than the one in front, mimicking the actual atmospheric haze that gives the Blue Ridge its name. Layer order from back to front: `--ridge-haze`, a blend of haze and mid, `--ridge-mid`, `--ridge-deep`.

Use it in exactly three places:
1. **Home screen header band**, with the Daily Lift card sitting above it like sunrise over the ridge, using `--gold` as the light source. This is the app's signature image and the first thing she sees.
2. **Empty states** (no entries yet, no saved restaurants), at low opacity.
3. **A thin ridgeline rule** as a section divider, roughly 8 pixels tall.

Do not use it on the food checker results, the fat budget bar, or the When To Call card. Those screens stay clean and functional. Decoration on a screen someone reads while unwell is a cost, not a feature.

### Typography

- **Headings:** a warm, slightly old-fashioned serif. Sorts Mill Goudy, Crimson Pro, or Bitter. Something that feels like a well-set church bulletin or a good regional cookbook.
- **Body and UI:** a clean humanist sans. Source Sans 3, Public Sans, or Inter.
- **Numbers** (fat grams, budget, pain scale): tabular figures, generous size. These are read at a glance in bad lighting.
- Minimum 16px body, 18px preferred. Large touch targets, 44px minimum.

### Tone in the interface

Warm and plain. "You have 12 grams left today" rather than "Remaining daily fat allowance: 12g." "That one is a rough fit, here is how to get close" rather than "Item exceeds threshold."

Never scold. If she logs a red food, the app is neutral and forward-looking. She is an adult managing a hard condition, and guilt in a food app does active harm.

---

## D. Cloudflare Worker

### Setup

1. `npm create cloudflare@latest pancreas-helper-api`
2. Store the key as a secret, never in code: `npx wrangler secret put ANTHROPIC_API_KEY`
3. Deploy with `npx wrangler deploy`. The free tier covers this many times over.

### Requirements

- **CORS lock.** Only accept requests with an `Origin` header matching her site's domain. Reject everything else with a 403. This is the difference between a private tool and a free API for the entire internet.
- **Rate limit.** Cap requests per IP per hour using Cloudflare's rate limiting or a KV counter. Set it generously, around 100 per hour, which is far above real use and far below abuse.
- **Input cap.** Reject request bodies over about 2KB. There is no legitimate reason for a longer food query.
- **Model.** Use a fast, inexpensive model. These are short, structured lookups, not reasoning tasks.
- **Response format.** JSON only, per the system prompt in the main spec. Validate the shape server side before returning it, and return a clean error if the model returns something unparseable.
- **No logging of request contents.** Cloudflare logs metadata by default; do not add body logging. What she eats is her business.

### Client behavior on failure

If the Worker is unreachable, slow, or returns an error, the app falls back silently to local results plus the universal restaurant playbook. She sees "I do not have this one in my list yet, here is the closest match and the general guidance," never a stack trace or a red error state.

---

## E. Revised build order

1. Shell, mode selector, settings with the fat calculator, localStorage, PWA
2. `foods.json` and the rating engine
3. Food checker
4. Daily fat budget bar
5. **Daily Lift with `daily-lift.json` and `friends-notes.json`** (do this early, it is the reason she opens the app)
6. Restaurant helper and playbook
7. Symptom log, then pattern view
8. Favorites and workarounds
9. When To Call, hydration, safe staples, enzyme log
10. Appointment prep export
11. Cloudflare Worker and AI fallback
12. Expand `daily-lift.json` toward 365
