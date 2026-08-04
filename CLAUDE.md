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
- Ask before adding any dependency.
- Ask before changing anything in data/. Those files are hand-authored.
- Do not build features from later phases before I ask for them.
- At the end of each phase, commit, merge to main, and push.