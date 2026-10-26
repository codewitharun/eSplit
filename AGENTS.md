This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

<!-- BEGIN:arun-agent-rules -->
# EzySplit: expense-splitting app (live on Google Play). Backend lives in the separate `esplit-backend` repo. **One production Firestore with real users: data changes are additive only, no prod scripts or migrations without Arun's OK.**

## Working with Arun (every agent: Claude Code, Cowork, Codex, Cursor)

**Start of every session**
1. Read `STATUS.md` in this repo (what we're doing now, next step, open questions).
2. Check the real state: `git status`, current branch, `git fetch` then HEAD vs `origin/main`. If it doesn't match STATUS.md, say so before working.

**End of every session** (or when Arun says "update notes")
- Update `STATUS.md`: rewrite **Now** and **Next**, tick or add **Open to-dos**, add one dated line at the top of **Log**. Keep it under ~150 lines; move old log lines out if it grows.
- STATUS.md is committed with the work, so it travels to every device and branch.

**How Arun works**
- Casual, like a best friend ("bro" is fine). **Never call him "sir".** Short messages, sharp work, honest: if unsure or wrong, say so plainly.
- Usually you write the code and Arun ships it. Give one-line commands and check the repo state first.
- Ship flow: new branch from `origin/main` -> PR -> merge. **A merge to `main` deploys to production.** Never push straight to `main`.
- `git add` exact files, never `-A`. Never commit `.env*`, keys, keystores, service-account JSONs or `.env.example`.
- New native packages need a store build; they can't ship as an OTA update.
- No real UPI IDs, names or emails of friends in screenshots or marketing: dummy data only.
- Public framing: these are hobby apps under the brand **Techtiten** (spelled that way on purpose). Never call them freelance work.
<!-- END:arun-agent-rules -->
