# EzySplit → Expo (SDK 57) migration

The old app is in `../ESplit_App` (RN 0.74, old arch) and is **untouched**. This folder is the
replacement. It is Android only, and it uses the same package `com.techtitens.ezysplit` and the same upload keystore.

## Stack
Expo SDK 57 · RN 0.86 (New Architecture) · React 19.2 · TypeScript 6 · React Navigation 7 ·
Reanimated 4 + worklets · RNFirebase 26 · dev client (Expo Go can't run Firebase).

`android/` is **generated** by `npm run prebuild`. Never edit it by hand, and keep it out of git.
Native changes go in `app.config.ts` or `plugins/withEzySplitAndroid.js`.

## Done
- `app.config.ts`:
  - package, `versionCode` (`VERSION_CODE` env, or `BUILD_NUMBER + 11`), and version read from package.json (2.3.0)
  - App Links for `ezysplit.arun.codes/app`, plus the `ezysplit://` scheme
  - minSdk 26 / targetSdk 36, minify + shrink, fonts, a dark splash, and adaptive icons
- `plugins/withEzySplitAndroid.js`: `<queries>` for WhatsApp, PDF/XLSX viewers and text share.
- `index.ts`: registers the FCM background handler (modular API) and then `registerRootComponent`.
- Library swaps:
  - haptics: `Vibration` → `expo-haptics` (same `haptics.tap/tick/success/warning/error` API)
  - clipboard: `@react-native-clipboard/clipboard` → `expo-clipboard`
  - PDF: `react-native-html-to-pdf` → `expo-print`
  - files: `react-native-fs` → `expo-file-system` (`File`/`Paths`, private cache)
  - open/share exports: `react-native-file-viewer` → `expo-sharing` (`services/ledger/openExport.ts`)
  - relative time: `moment` → `utils/timeAgo.ts`
  - `react-native-responsive-screen` → a tiny Dimensions helper in `utils/constants.tsx`
- Global body font: React 19 ignores `Text.defaultProps`, so the app now uses `component/ui/AppText.tsx` (41 files repointed).
- lucide 1.x renamed `Home` to `House` (aliased on import).
- RN 0.86: `StyleSheet.absoluteFillObject` → `absoluteFill`.
- React Navigation 7: `sceneContainerStyle` → `screenOptions.sceneStyle`.
- JS → TS: everything (no .js/.jsx left in src or root).
- Removed:
  - unused dependencies: functions, drawer, axios, url-polyfill, expo-status-bar, expo-linking, google-mobile-ads (never used in code), moment
  - dead files: NetworkLostModal, NetworkStatusListener, services/firestore.js, DatePicker.js
- Jest (`jest-expo`): 74/74 tests pass.

## Firebase data layer — DONE (modular API, RNFirebase 26)
**Rule: only `src/data/*` may import `@react-native-firebase/{auth,firestore,messaging}`.**
(`services/crashReporting.ts` is the one exception, for analytics and crashlytics.)
Screens, hooks and stores call data-layer functions. If you leave Firebase, or move a write to the backend, only `src/data/` changes.

| file | what |
|---|---|
| `data/firebase.ts` | `db()`, `currentUser()`, `subscribeAuth()`, `getIdToken()` |
| `data/auth.ts` | Google Sign-In v16 (cancel now returns null) + sign out + delete account |
| `data/users.ts` | `users/{uid}`: UPI ID, login profile upsert (merge + serverTimestamp), delete |
| `data/ledger.ts` | groups / members / expenses / settlements / joinRequests (was `services/ledger/firestoreLedger.ts`) |
| `data/appConfig.ts`, `announcements.ts`, `adminNotifications.ts` | read-only admin collections |
| `data/push.ts` | FCM: permission, token, foreground/opened/launch listeners, background handler |

**PROD RULE checked:** every collection name, field name, merge flag and write order is unchanged from the CLI app.
- Old and new app versions can share the prod DB.
- Behaviour change: `snapshot.exists` is now the method `exists()`. Every call site was converted, and a grep shows no property uses left.

`App.jsx` → `App.tsx`, and **no JS files remain**.
`tsc` passes with 0 errors and jest passes 74/74.

## Still to do
1. On your Mac: `npm install`, then `npm run prebuild`, then `npx expo run:android` (dev build on a device or emulator).
   Test login, groups, add/edit expense, settle up, invites/deep links, push and export.
   Check notifee on the New Architecture.
2. Signing is DONE via `plugins/withEzySplitSigning.js`:
   - keys live in `credentials/` (git-ignored; see `credentials/README.md`)
   - CI uses the same env vars as before
   - debug builds use the CLI app's debug.keystore (SHA-1 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25)
3. Port the CI workflow (`expo prebuild` + gradle `bundleRelease`).
4. Internal testing track first, never straight to production. Set `VERSION_CODE` above the current Play code.

## Commands (device shell: yarn and api.expo.dev are blocked)
```
EXPO_OFFLINE=1 npx expo install <pkg>
npx tsc --noEmit
npx jest
npm run prebuild && npx expo run:android
```

## Dev vs prod builds
One `android/` (and `ios/`) folder serves both variants. `scripts/native.js` remembers which
variant it was generated for, and re-runs `prebuild --clean` only when you switch.

| command | builds |
|---|---|
| `npm run android` / `npm run ios:device` | **prod** — EzySplit, live Firebase |
| `npm run android:dev` / `npm run ios:dev` | **dev** — EzySplit Dev (orange DEV icon), dev Firebase |
| `npm start` / `npm run start:dev` | Metro only. Use `start:dev` with a dev build, because the Google client ID is baked in at Metro start. |

### Setting up the dev Firebase project (one time)
1. Firebase console → Add project, e.g. `ezysplit-dev`. The free Spark plan is fine.
2. Add an **Android app**:
   - package `com.techtitens.ezysplit.dev`
   - debug SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
3. Add an **iOS app** with bundle ID `com.techtitens.ezysplit.dev` (optional, only for iPhone dev builds).
4. Authentication → Sign-in method → enable **Google**.
5. Firestore Database → Create (production mode, same region as prod).
6. Rules:
   - `npm i -g firebase-tools` and `firebase login`
   - `firebase use --add`, pick the dev project, alias it `dev`
   - `firebase deploy --only firestore:rules --project dev`
7. Download the files *after* steps 2–4, so they include the Google client IDs:
   - `google-services.json` → `firebase/dev/google-services.json`
   - `GoogleService-Info.plist` → `firebase/dev/GoogleService-Info.plist`
8. `npm run android:dev`

Known gap: the AI assistant and push *sending* go through esplit-backend, which trusts only prod tokens. Both fail in the dev app until the backend gets a dev mode.
