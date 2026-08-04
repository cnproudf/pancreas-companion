# Build Spec: Pancreas-Friendly Eating Companion

A personal web app to help one friend eat well and feel cared for while managing pancreatitis. Static site, hosted on GitHub Pages, with an optional serverless AI layer.

This document is written to be handed directly to Claude Code as a build brief.

---

## 0. Non-negotiables (read first)

These constraints govern every feature. Do not relax them for convenience.

1. **This app is not medical advice and must never present itself as such.** It is a translator between what her care team told her and the real world of menus and grocery stores. Every screen that gives food guidance carries a persistent, non-dismissable footer: *"General information only. Your care team's instructions always win."*

2. **The daily fat target is a user setting, not an app decision.** On first run, ask her to enter the number her doctor or dietitian gave her. Offer 30g as a conservative default with clear text saying it is a placeholder until she confirms with her care team. All traffic-light math scales off this value.

3. **Alcohol is a hard stop.** No yellow light, no "in moderation," no substitution suggestions that include it. Any input containing alcohol returns red with a brief note that alcohol avoidance is standard guidance for pancreatitis. Do not lecture; state it once, plainly, and move on.

4. **Flare mode opens with a triage gate, not a food list.** See section 4.

5. **All personal data stays on her device.** Use `localStorage` only. No accounts, no analytics, no server-side storage of journal entries, symptoms, or foods. Provide an export-to-file and import-from-file so she controls her own backup.

6. **The AI layer, if enabled, is scoped to food composition and preparation only.** It does not answer medical questions, does not interpret symptoms, and does not tell her whether to seek care. If a user message drifts medical, it returns a short redirect to her care team.

7. **No em dashes in any user-facing copy.** Use commas, colons, parentheses, or short sentences.

---

## 1. Architecture

### Phase 1: fully local (build this first, ship it working)

- Vanilla React + Vite, or plain HTML/CSS/JS if you prefer zero build step. Either is fine; pick one and be consistent.
- Tailwind or plain CSS. No component library required.
- A bundled `foods.json` dataset (see section 3) drives the food checker.
- A bundled `restaurant-playbook.json` drives the restaurant helper.
- A bundled `daily-lift.json` drives the encouragement feature.
- Everything works offline. Register a service worker so the app is installable as a PWA and functions in a restaurant with no signal. This matters more than it sounds: the moment she most needs it is standing at a hostess stand in a basement dining room.

### Phase 2: optional AI layer (add after Phase 1 works)

- Deploy a Cloudflare Worker (free tier) or Vercel Edge Function that holds the Anthropic API key as an environment variable.
- The Worker exposes a single POST endpoint. The client sends `{ mode, dailyTarget, remainingBudget, query, queryType }`. The Worker prepends a fixed system prompt and calls the Messages API.
- Client calls the Worker only when the local dataset returns no match, or for restaurant queries. This keeps cost near zero and keeps the app fast.
- The client must handle Worker failure silently and fall back to the local dataset plus a "no match found, here is what to ask the server about" message. Never show her a raw error.
- Lock the Worker to her domain via CORS origin check.

**Worker system prompt (use approximately this):**

> You help one person with pancreatitis evaluate foods. Respond only about food composition, fat content, and preparation methods. Estimate grams of fat per typical serving and be explicit that it is an estimate. Suggest specific preparation changes or substitutions that lower fat. Never discuss symptoms, diagnosis, treatment, medication, or whether the person should seek care; if asked, reply only that this is a question for their care team. Never suggest anything containing alcohol. Keep answers under 120 words. Return JSON only, with keys: rating (green/yellow/red), estimatedFatGrams, reasoning, modifications (array of strings), confidence (high/medium/low).

---

## 2. The rating engine

The traffic light is computed as a percentage of her daily fat target, so it scales automatically to whatever number her dietitian gave her.

```
Let T = daily fat target in grams (user setting)
Let F = estimated fat grams in the serving being evaluated

STABLE mode:
  F <= 0.10 * T          -> GREEN
  0.10 * T < F <= 0.25*T -> YELLOW
  F > 0.25 * T           -> RED

RECOVERING mode: multiply all thresholds by 0.6
FLARE mode:      multiply all thresholds by 0.35
```

**Hard overrides that force RED regardless of the math:**

- Contains alcohol in any amount, including as a cooking ingredient
- Deep fried by default preparation
- In flare mode only: high fiber, high sugar, very spicy, large portion size, or anything raw and hard to digest

**Hard overrides that force YELLOW at best:**

- Full-fat dairy, cream sauces, cheese as a primary component
- Fatty cuts of red meat, sausage, bacon, processed deli meats
- Nut butters, avocado, coconut (nutritionally decent fats, but still fats, and portion creep is real)

**Second layer, always shown:** even on a RED item, show what would move it. "Fried chicken sandwich is red. Ask for it grilled with no mayo and it becomes yellow. Grilled, no mayo, no cheese, on a plain bun makes it green." The point of the app is not to say no. It is to say *here is the version of this you can have.*

**Budget awareness:** if she has already logged 26g against a 30g target, a normally-green item should surface a gentle note: "This is a green food, but you have 4g left today. Consider saving it for tomorrow or having a smaller portion."

---

## 3. Data model

### `foods.json`

Seed with 400 to 800 common foods and restaurant dishes. Structure:

```json
{
  "id": "grilled-chicken-breast-skinless-4oz",
  "name": "Grilled chicken breast, skinless",
  "aliases": ["chicken breast", "grilled chicken"],
  "servingDescription": "4 oz cooked",
  "fatGrams": 3.5,
  "category": "protein",
  "tags": ["lean-protein", "flare-friendly"],
  "flags": [],
  "modifications": [
    "Ask for it grilled dry or with broth instead of oil or butter",
    "Skip any finishing butter or compound butter"
  ],
  "notes": "One of the most reliable orders at almost any restaurant."
}
```

Flags vocabulary: `alcohol`, `deep-fried`, `full-fat-dairy`, `high-fiber`, `high-sugar`, `spicy`, `raw`, `processed-meat`, `hidden-fat`.

**Seed examples to establish the pattern** (expand from here using standard nutrition references, and mark every entry as an estimate):

| Food | Serving | Fat (g) | Notes |
|---|---|---|---|
| Skinless chicken breast, baked | 4 oz | 3.5 | Green anchor food |
| Same, deep fried | 4 oz | 15+ | Preparation is the whole story |
| White fish, baked (cod, tilapia) | 4 oz | 1.5 | Excellent |
| Shrimp, steamed or grilled | 4 oz | 1.5 | Watch for butter |
| 99% fat free ground turkey | 4 oz | 1.5 | Good burger base |
| Egg whites | 3 | 0 | Green |
| Whole egg | 1 large | 5 | Yolk carries the fat |
| Nonfat Greek yogurt | 6 oz | 0 | Versatile substitute for sour cream and mayo |
| Skim milk | 1 cup | 0.2 | |
| Whole milk | 1 cup | 8 | |
| Plain baked potato | medium | 0.2 | Green until it meets butter |
| French fries | medium order | 17 | Red |
| Steamed broccoli, no butter | 1 cup | 0.3 | |
| Brown rice | 1 cup | 1.8 | |
| Oatmeal made with water or skim | 1 cup | 3 | |
| Black beans | 1/2 cup | 0.5 | Flag high-fiber for flare mode |
| Avocado | 1/2 | 15 | Yellow to red on portion |
| Peanut butter | 2 tbsp | 16 | Red by default, measure carefully |
| Cheddar cheese | 1 oz | 9 | |
| Fat free cheese | 1 oz | 0 | Direct substitution |
| Bacon | 2 slices | 7 | Red, processed meat flag |
| Ranch dressing | 2 tbsp | 16 | Ask for it on the side, always |
| Balsamic vinegar | 2 tbsp | 0 | Green dressing alternative |
| Broth-based vegetable soup | 1 cup | 1 | Reliable restaurant order |
| Cream-based soup | 1 cup | 12 | |
| Angel food cake | 1 slice | 0.2 | The dessert that works |
| Ice cream | 1/2 cup | 7 | |
| Sorbet | 1/2 cup | 0 | Substitution |

### `restaurant-playbook.json`

This is the most durable asset in the whole app. Menus change and vary; these scripts work everywhere.

Organize by cuisine type (American, Italian, Mexican, Chinese, Japanese, Indian, Thai, Mediterranean, Diner, Fast food, Steakhouse, Seafood, Breakfast) plus a universal section. Each entry:

```json
{
  "cuisine": "italian",
  "safeBets": [
    "Pasta with marinara, no meat, no cheese, ask them to skip the finishing oil",
    "Grilled chicken or fish with a side of plain vegetables",
    "Minestrone or pasta e fagioli (confirm broth base, not cream)"
  ],
  "avoid": [
    "Alfredo, carbonara, vodka sauce, anything described as creamy",
    "Fried calamari, arancini, mozzarella sticks",
    "Anything parmigiana (breaded, fried, cheese)"
  ],
  "askFor": [
    "Sauce on the side so I can control the amount",
    "Cooked without butter or oil, broth or a light spray is fine",
    "Half portion, or a lunch portion, or box half before it comes out"
  ],
  "scriptLine": "I have a medical condition that requires a very low fat diet. Could you ask the kitchen to prepare the chicken with no oil or butter, and bring the sauce on the side?"
}
```

**Universal section (always shown, regardless of cuisine):**

- Grilled, baked, broiled, steamed, poached, or roasted. Not fried, crispy, breaded, buttered, creamy, smothered, or au gratin.
- Sauces and dressings on the side, every time, without exception.
- Ask what the kitchen cooks with, and ask for broth, wine-free stock, or a light spray instead.
- Order the kid's or senior portion when available. Portion control is fat control.
- Look up the nutrition PDF before you go. Chains publish them and they are usually accurate.
- Eat half and box half. Two smaller meals beats one large one anyway.
- Call ahead during a slow hour. Kitchens are dramatically more accommodating at 3pm than at 7pm.

**Optional AI enhancement:** when she types a restaurant name, first check whether it matches a known chain in a small bundled list of chains with published nutrition data (link her straight to the PDF). If not, hand the name to the Worker with a prompt asking for likely menu categories and specific ordering strategy, clearly labeled as an educated guess to verify with the server.

### `daily-lift.json`

Minimum 365 entries so it never repeats within a year. Rotate deterministically by date so refreshing does not reshuffle, but include a "show me another" button because sometimes one lands wrong.

```json
{
  "id": "lift-041",
  "type": "fun-fact",
  "content": "Otters hold hands while they sleep so they do not drift apart from each other.",
  "attribution": null
}
```

Types: `encouragement`, `fun-fact`, `funny-story`, `quote`, `tiny-win` (a small suggestion like "text someone you have been meaning to text"), and `from-a-friend`.

**The `from-a-friend` type is the heart of this.** It holds short personal notes written by the people who love her. Keep them in a separate `friends-notes.json` so new ones can be added by a simple pull request or a direct file edit on GitHub, without touching code. Weight the rotation so a friend note appears roughly twice a week rather than randomly. Display them differently: warmer styling, the friend's first name, no clinical chrome around them.

Tone guidance for the curated entries: light, specific, and never toxic-positive. No "everything happens for a reason." No "just stay strong." Weird animal facts, small absurd bits of history, genuinely funny short anecdotes, and the occasional plain statement that this is hard and she is handling it.

---

## 4. Mode selector

Three states, persisted, prominently displayed, changeable in two taps from anywhere.

**STABLE** ("feeling good"). Full thresholds. Normal feature set.

**RECOVERING** ("coming out of something, being careful"). Thresholds at 0.6. Emphasize small frequent meals, gentle reintroduction, and simple preparations. Surface a note that tolerance is often lower for several weeks after an episode and that scaling back when pain returns is the right instinct.

**FLARE** ("having a bad time right now"). **Selecting this opens a triage screen before any food content.**

Triage screen contents:

> Before we talk about food, a quick check. Are you having any of these right now?
>
> - Severe pain in your upper abdomen, especially pain that goes through to your back
> - Vomiting you cannot stop, or you cannot keep fluids down
> - Fever or chills
> - Racing heartbeat, dizziness, or feeling faint
> - Pain that is getting worse rather than better
>
> [ Yes, one or more ] [ No, but I feel off ]

If **yes**: full-screen, unmissable panel. Contact your care team now, or go to urgent care or the emergency department. Include a button that dials her doctor's number (a setting she configures during onboarding) and a line noting that acute pancreatitis is a condition where prompt care genuinely matters. Do not show food recommendations on this screen. Provide a small "I have already contacted them, continue to food guidance" link below the fold, because sometimes she has already called and is waiting.

If **no**: proceed to flare-mode food guidance. Thresholds at 0.35. Emphasize clear liquids, broth, plain rice, applesauce, bananas, dry toast, plain baked potato, gelatin, and very small portions. Flag high-fiber and high-sugar items. Add a persistent note that if she is unable to eat at all, that is information her care team needs.

---

## 5. Feature specifications

### 5.1 Food Checker (core)

Text input with fuzzy matching against `foods.json`. Show results as a large, immediately legible traffic light card:

- Rating with color and icon (do not rely on color alone; use icon and text for accessibility)
- Estimated fat grams for the stated serving, explicitly labeled as an estimate
- What this does to her remaining daily budget
- **Modifications section**, always present, even on green items ("this is already good; ask for it without butter and it is even better")
- A "log this" button that adds it to today's fat total and journal

If no local match and the Worker is configured, query the Worker with a visible loading state. If the Worker is unavailable, say so plainly and offer the closest local matches.

### 5.2 Restaurant Helper (core)

Input: restaurant name, optionally cuisine type.

Output, in this order:
1. Universal ordering strategy (always, from the playbook)
2. Cuisine-specific safe bets, avoid list, and ask-fors
3. A copy-able script line she can read to a server or paste into an online order's special instructions field
4. Link to the chain's nutrition PDF if it is a known chain
5. AI-generated specific suggestions if the Worker is configured, clearly labeled as an estimate to confirm with the restaurant

Include a "save this restaurant" function so her regular spots build up a personal, growing list of what worked, along with her own notes ("the Tuesday manager here is great about this").

### 5.3 Favorites and Workarounds (core)

She enters a food she loves and misses. The app returns:

- The likely fat content of the standard version and why it lands where it does
- Specific structural substitutions, mapped from a `substitutions.json` lookup (sour cream to nonfat Greek yogurt, mayo to mustard or nonfat Greek yogurt, oil sauté to broth sauté, butter to cooking spray or fat free butter spray, ground beef to 99% lean ground turkey, cream sauce to a broth-and-cornstarch base, cheese to fat free cheese or a smaller quantity of a very sharp cheese, ice cream to sorbet, fried to air fried)
- Links to real community resources where people have solved this before

Seed the resource list with:
- National Pancreas Foundation nutrition page and their free cookbook PDF
- The NPF-affiliated Inspire pancreatitis community
- HealthUnlocked's Chronic Pancreatitis Support group
- Mission:Cure nutrition guidance

Add a "save my version" field so when she works out a version that succeeds, it becomes hers permanently, in her own words. Over months, this becomes the most valuable screen in the app, because it is authored by her.

### 5.4 Daily Fat Budget (added, high priority)

A persistent bar at the top of the app: `18g of 30g used today`. Color shifts as it fills. Tapping opens today's log with the ability to edit or remove entries. Resets at midnight local time.

This is what turns the traffic light from a trivia game into a decision tool.

Also show a small "meals so far today" count, with a gentle nudge toward the 4 to 6 small meals pattern rather than three large ones, since large meals are harder on the pancreas than the same food spread out.

### 5.5 Journal and Pattern Finder (added, high priority)

She suspects she has had episodes on and off for years. The single most useful thing this app can do for her long-term care is generate the data her gastroenterologist wishes he had.

Daily entry, kept short enough that she will actually do it:
- Pain level, 0 to 10
- Nausea, yes/no/some
- Bowel changes, including a discreet checkbox for stools that float or are pale or greasy (this is fat malabsorption and it is clinically meaningful)
- Energy level
- Free text note
- Foods eaten (auto-populated from anything she logged via the checker)

Pattern view: a simple chart of pain over time with logged fat intake overlaid, plus a "foods logged within 24 hours of your worst days" list. Be careful with the framing. Present it as *possible patterns worth mentioning to your doctor*, never as a causal finding. Correlation in a sample of one is a conversation starter, not a conclusion.

### 5.6 Appointment Prep (added)

One button: "I have a doctor visit coming up." Generates a clean, printable one-page summary:

- Date range covered
- Average and worst pain scores
- Number of symptomatic days
- Average daily fat intake
- Any flagged malabsorption entries
- Foods that recurred before bad days
- A questions section she can fill in beforehand, pre-seeded with useful ones (What is my target fat intake? Do I need pancreatic enzymes? Should I be checked for fat-soluble vitamin deficiencies? Should I see a registered dietitian?)

Print to PDF via the browser. No server involvement.

### 5.7 Enzyme Log (added, conditional)

Only appears if she toggles "I take pancreatic enzymes" in settings. If she is on PERT, timing with meals matters and it is easy to forget mid-meal. Simple log: which meal, taken or not. Optional reminder via a scheduled notification if the PWA has permission.

### 5.8 Hydration Tracker (added, simple)

A row of eight glass icons she taps. Dehydration is a commonly cited symptom aggravator and this takes four hours of build time. Skip anything fancier.

### 5.9 Safe Staples (added)

A pre-built, editable grocery list of reliable items, organized by store section, that she can check off. Seed it and let her edit freely. Include an "add from my saved favorites" path.

### 5.10 When To Call (added, always accessible)

A red-outlined card reachable from a persistent icon in the header. Lists the red-flag symptoms from section 4, holds her care team's phone numbers (entered in settings), and states plainly that severe or worsening pain warrants immediate care. No cleverness on this screen. Big text, clear numbers, tap to dial.

### 5.11 Daily Lift (core, and do not treat it as decoration)

Appears at the top of the home screen every day. One item, well-typographed, given real space. A small "another one" button. A small heart button that saves it to a "favorites" collection she can revisit on hard days.

Design this screen as if it were the whole app. On the worst days she will open the app, see this, and close it, and that will have been worth the entire build.

---

## 6. Onboarding

Four screens, skippable, re-runnable from settings:

1. What this is and what it is not. Plain language: this helps you make decisions in restaurants and grocery stores. It does not replace your doctor or dietitian, and when they say something different from this app, they are right.
2. Your fat target. Enter the number your care team gave you, or start with 30g as a placeholder and confirm at your next visit.
3. Your care team. Doctor name and phone, dietitian if she has one, preferred hospital. Stored locally, used by the "When To Call" screen.
4. Do you take pancreatic enzymes? Toggles section 5.7.

---

## 7. Visual and tone direction

Warm, not clinical. This is a companion, not a chart. Soft neutrals with a single warm accent color; avoid hospital blue and avoid anything that reads as a fitness tracker.

Large touch targets and generous type. She may be using this one-handed at a restaurant table or while genuinely not feeling well. Nothing should require precision.

Copy voice: a knowledgeable friend, not a nutrition label. "Fried chicken is a rough one, but here is how to get most of the way there" beats "This item exceeds recommended fat thresholds."

Never scold. If she logs a red food, the response is neutral and forward-looking, not disapproving. She is an adult managing a difficult condition and the app's job is information, not judgment. Guilt in a food app is actively harmful.

Accessibility: color plus icon plus text for all ratings, WCAG AA contrast minimum, semantic HTML, full keyboard navigation.

---

## 8. Build order

1. Shell, mode selector, settings, localStorage layer, PWA manifest and service worker
2. `foods.json` seed dataset and the rating engine (the core value)
3. Food checker screen
4. Daily fat budget bar
5. Daily Lift, with an initial 60 entries and the friend-notes mechanism (get this in early; it is the reason she will open the app)
6. Restaurant helper with the playbook
7. Journal, then pattern view
8. Favorites and workarounds with the resource links
9. When To Call, hydration, safe staples, enzyme log
10. Appointment prep export
11. Cloudflare Worker and the AI fallback layer
12. Expand `daily-lift.json` toward 365 entries

---

## 9. Repository notes

- Public repo is fine. Nothing in the code is personal, since all her data lives in her browser.
- Deploy from `main` via GitHub Pages, or the `gh-pages` branch if you prefer a build step.
- Put the friend-notes file at an obvious top-level path with a short README section explaining how to add one, so other people in her life can contribute without understanding the codebase.
- Add a `CONTENT-SOURCES.md` listing where the fat values came from, so future edits stay grounded.
- Consider a custom domain. A real address rather than a github.io URL makes it feel like a gift rather than a project.

---

## 10. A note on scope

The temptation with an app like this is to build the comprehensive one. Resist it. The version that gets used is the version that answers "can I eat this" in under five seconds, tracks a running total, and says something kind once a day. Everything else is a bonus that can arrive in month two.

Ship small. Ship soon. She needs it now, not when it is finished.
