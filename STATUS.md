# EzySplit app: status

_Last updated: 26 Oct 2026 (Cowork). Full plan: `ROADMAP.md`. Backend: separate repo `esplit-backend`._

## Now
- **Live: 2.5.0** (25 Oct, new domain `ezysplit.techtiten.com`).
- Working tree on `release/2.5.0` (1 behind origin/main) has **uncommitted 2.5.1 work**:
  - `expo-store-review` + `src/services/reviewPrompt.ts` (`noteHappyMoment()` after adding an expense and after settle-up; ask after the 3rd, max 2 asks, 120 days apart). **Native package -> store build.**
  - spend totals tweak (`spendTotals.ts` + test, `useGroupsOverview.ts`)
  - `src/data/adminNotifications.ts`: hide personal notifications older than 7 days
  - `scripts/native.js` message; old plan docs deleted, `ROADMAP.md`, `distribution/translations/`, `distribution/developer-page/` added
- CI change in this commit: `build-android.yml` now ignores `**/*.md` and `.github/**` pushes, so docs-only merges don't publish a Play build (FitPrep does the same).

## Next
1. **Before 1 Nov:** admin min version = **2.5.0** (Arun is away 2–13 Nov).
2. Ship **2.5.1**: fresh branch from origin/main, bump version, `distribution/whatsnew/whatsnew-en-US`, test on dev (`ezysplit-dev`), review file by file with Arun.

## Open to-dos
- [ ] Before 1 Nov: admin min = 2.5.0
- [ ] Before 5 Nov: Play Console reply to Sachin's review -> `https://ezysplit.techtiten.com/support`
- [ ] Play Console privacy / delete-account URLs -> new domain
- [ ] After 5 Nov: remove `LEGACY_WEB_BASE_URL` (`src/config/urls.ts`) and the arun.codes host in `app.config.ts`
- [ ] Upload `distribution/translations/...csv` to Play (en-US, en-GB, en-IN, hi-IN)

## Roadmap (short; details in ROADMAP.md)
- **P0 security:** Firestore rules still `allow read, write: if true` -> members-only per group, creator-only edits, dev first. App must send the ID token to `/send-notification`. Backups + PITR.
- **2.6.0:** payment reminder nudge (best growth lever) · spending breakdown screen · invite link previews · finish recurring expenses, reopen last group · grouped hero amount (₹15,000)
- **Later:** Ask EzySplit AI rollout, scan a bill (on-device OCR), Insights page, iOS, group features

## Key facts
- **One prod Firestore (`esplit-d362c`) with real users: additive only.** Dev project `ezysplit-dev`.
- Only `src/data/*` imports `@react-native-firebase/*`. `android/` + `ios/` are generated.
- CI: push to main -> Play **Production 100%**, versionCode = run number + 11. Retry: `gh workflow run build-android.yml --ref main`.
- Force update only after Play shows the build live.

## Log
- 26 Oct 2026: STATUS.md/AGENTS.md added; CI skips docs-only pushes.
- 25 Oct 2026: 2.5.0 released (domain move).
