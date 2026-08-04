# Pancreas Companion

A personal web app for one user, Sam, who has pancreatitis. Static site on GitHub
Pages, plus a Cloudflare Worker for optional AI lookups.

Full spec: docs/pancreatitis-companion-build-spec.md
Amendments (these override the spec): docs/spec-addendum.md

## Stack
React + Vite + Tailwind. No component library. No backend except the Worker.

## Invariants. Never violate these, never optimize them away.

1. Flare mode opens the triage screen BEFORE any food content. Always.
2. The app never presents itself as medical advice. The disclaimer footer is
   persistent and not dismissable on any screen giving food guidance.
3. All user data lives in localStorage. No accounts, no analytics, no server
   storage of anything she enters.
4. Alcohol is always red. No modifications are ever offered for it.
5. Unlogged days render as GAPS in the pattern chart. Never as zeros, never as
   green days, never as symptom-free days.
6. The Worker URL is public and fine in client code. The API key is not, and
   never appears anywhere outside Cloudflare secrets.
7. If the Worker fails, times out, or is unreachable, the app falls back
   silently to local data. The user never sees an error state.
8. Ratings always carry color AND icon AND text. Never color alone.
9. No em dashes anywhere in user-facing copy.
10. Never scold the user for a food choice. Neutral and forward-looking only.

## Working agreement
- Symptom log, Daily Lift, and the When To Call header control render above
  FlareGate because none of them carries food GUIDANCE. AttachFoodSection
  carries its own flare guard for the same reason FatBudgetBar does. Anything
  added above the gate that gives food guidance must move inside it or carry its
  own guard.
- Food guidance means a rating, a gram value, a portion, a meal, or anything
  answering "should I eat this". It is narrower than "names a food", and the
  narrowing was deliberate: 24 of the 365 Daily Lift entries name a food
  incidentally ("Bananas are berries", "Corn was bred from a grass called
  teosinte"), and the broader reading would push the Lift inside the gate and
  take away the one thing she should still see on her worst day.
- All three guards ask `foodGuidanceAllowed` in lib/triage.ts. One definition,
  three call sites. Do not write `currentMode === 'flare'` by hand.
- Ask before adding any dependency.
- Ask before changing anything in data/. Those files are hand-authored.
- Do not build features from later phases before I ask for them.
- At the end of each phase, commit, merge to main, and push.

## The appointment export does no arithmetic, and that is deliberate

`lib/appointmentPrep.ts` composes `summarize` and `findPatterns` and calls the
`*Text` helpers from `patterns.ts`. It contains no division, no rounding, and no
counting. The printed page and the pattern view therefore state the same
denominators from the same strings by construction rather than by anyone
remembering to keep them in step.

If that page ever needs a number `patterns.ts` does not have, it goes in
`summarize`, next to the comment saying daysLogged is the only denominator. That
is where `daysWithSymptomsLogged` and `malabsorptionEntries` went in Phase 10,
and it is why they are not in the new module.

`PrepSheet` is a portal to `document.body`, NOT a native `<dialog>` like the
app's other two overlays. Top layer content paginates badly when printed. It is
mounted from the Patterns tab, so it is inside FlareGate and the gate closing
takes it down; `FlareGate.test.tsx` covers that, and the trap was confirmed to
fire by leaking `children` past the gate on purpose.

## Invariant 1, verified end to end at Phase 9

Structural via FlareGate, and no longer untested. Three layers, in order of how
much they would catch:

1. `src/components/FlareGate.test.tsx` renders the real App in jsdom and sweeps
   the page for all 211 food names and for any gram value, at every triage
   stage and entering flare from every tab. It fails with an explanation of the
   invariant rather than a diff. Its trap was confirmed to fire by mounting a
   food name above the gate on purpose and reading the message it produced.
2. `src/lib/triage.test.ts` covers the policy itself, plus copy guards for rule
   6 (`DIAGNOSIS_PATTERN`: no branch names a condition or grades her likelihood
   of having one).
3. By hand at 375x812. Logged a food in stable, entered flare, and confirmed the
   main region was triage and nothing else: no tab strip, no budget bar, no
   "Cod", no gram value anywhere outside the Daily Lift. Confirmed the gate
   re-arms on reload with no triage key in localStorage. Measured the
   below-the-fold continue link at 1019px against an 812px viewport. Confirmed
   the symptom sheet opens during a flare without AttachFoodSection.

The by-hand pass found two things the tests could not: the triage screens opened
below a 700px header band, fixed by `useRevealOnMount`, and a 14px line on the
When To Call card, under addendum C's 16px floor.