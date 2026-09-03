# EzySplit — Phase 2 Feasibility Review

This re-checks every item in `ENHANCEMENTS_AND_IMPROVEMENTS.md` against the app as it exists **today**, after the ledger/split-engine rebuild and the UI redesign. That original document was written against the old codebase (`ExpenseTracker.js`, `Esplitusers` collection, the unused tab navigator), so a lot of it is now either done or no longer applicable. This doc separates what's already resolved from what's genuinely still open, rates the open items on effort and dependencies, and ends with my own suggestions and a proposed shortlist for the next phase. Use it as the input to the "final md" — nothing here has been built yet except where explicitly marked done.

---

## 1. From the original doc — what's already resolved

Everything in sections 1 and 2 of the original doc targeted files that no longer exist or a schema that's been replaced. Re-checked one by one:

| # | Original item | Status now |
|---|---|---|
| 1.1 | Division by zero in ExpenseTracker | **Obsolete.** `ExpenseTracker.js` is deleted. The new split engine (`splitEngine.ts`) and every screen that divides by member count already guards it (`members.length ? total / members.length : 0`). |
| 1.2 | Logout calls `handleLogout()` on every render | **Already fine.** Checked the current `Logout.js` — it's only called from the button's `onPress`, not the render body. This may have been fixed before this rebuild started. |
| 1.3 | `joinDate > now` never-true condition | **Obsolete.** That whole code path is gone — expenses now store an explicit `shares` map per expense at creation time, so there's no join-date comparison anywhere anymore. |
| 1.4 | Group key collision risk (3-digit suffix) | **Fixed, better than suggested.** Groups now use a real Firestore doc ID plus a 6-character join code that's checked for uniqueness against existing codes before use. |
| 1.5 | Notification token array shape | **Obsolete.** The old `Esplitusers`/multi-token model is gone; the new schema stores one `fcmToken` string per user. |
| 1.6 | ExpenseTracker crashes when `groupKey` is null | **Obsolete**, but the underlying concern is still handled well — Balances, Activity, etc. all show a "No group selected yet" empty state instead of crashing. |
| 2.1 | Bottom tab navigator unused | **Done.** It's the primary navigation now (and was just redesigned this session). |
| 2.2 | NetworkLostModal/NetworkStatusListener import Redux (doesn't exist) | **Still broken, not touched.** These two files are still there, still reference a Redux store that was never part of the app, and are excluded from the TypeScript check for that reason. Nobody currently imports them, so they're dead weight rather than an active crash risk — but worth deleting or rebuilding on Zustand. Low effort either way. |
| 2.3 | `services/firestore.js` writes to a different, unused collection (`mobileUser`) | **Confirmed dead code.** Nothing imports this file anymore. Safe to delete outright — zero effort, zero risk. |
| 3.1 | Restore last group on app open | **Not done.** `lastJoinedGroup` is written to `AsyncStorage` on join and cleared on logout, but nothing reads it back to auto-select a group when the app opens. Low effort to add. |
| 3.2 | No way to switch group from the main screen | **Done** — `GroupSwitcherPill`, Activity's header, and Profile's "Switch or create a group" all cover this. |
| 3.3 | Empty state for expenses | **Done** — Activity shows "No expenses yet — tap + to add the first one." |
| 3.4 | First-transaction lock confirmation copy | **Superseded** — the auto-lock-on-first-expense behavior this referred to is gone as of this session (see the admin lock toggle below), so there's no such confirmation to word anymore. |
| 3.5 | Auto-open share sheet after creating a group | **Partially done.** Inviting via share sheet exists (Activity's invite button calls `Share.share`), but it's not triggered automatically right after group creation. Very low effort to add. |
| 3.6 | Currency hardcoded as ₹ | **Still true.** `Group.currency` and `AppUser.defaultCurrency` exist in the schema but nothing reads them — every screen and both exports hardcode ₹. Real gap, moderate effort to wire through (no new dependency for same-currency-different-symbol display; live FX conversion would need a rates API). |
| 4.1–4.5 | Theming, Group-Check redesign, layout, branding, loading/errors | **Done** — this is what the last several sessions of work covered. |
| 4.6 | Accessibility labels / touch targets | **Not done.** No `accessibilityLabel`/`accessibilityHint` props anywhere yet. Low effort, high value, easy to fold into any future screen touch-up. |
| 5.1 | TS migration | **Mostly done** for the rebuilt ledger/UI code; a handful of older screens (`Notifications.js`, `Splash.js`, `Logout.js`, `DatePicker.js`) are still plain JS. Not urgent. |
| 5.2 | Remove debug `console.log`s | **Not done** — 15 remain across the codebase. Trivial cleanup. |
| 5.3 | Single source of truth for the current user | **Still mixed.** `useAuthStore` exists and is used in a few places, but most of the new ledger screens read `auth().currentUser` directly instead. Works fine today (Firebase Auth's own state is already the source of truth), but worth unifying eventually for consistency. |
| 5.4 | Error handling / user feedback | **Good coverage** — Toast is used consistently across the new ledger code. |

Net effect: almost everything actionable in sections 1–5 is either done, obsolete, or a small cleanup item. The two I'd actually prioritize from this list are deleting the two pieces of confirmed dead code (`firestore.js`, and either fixing or removing `NetworkLostModal`/`NetworkStatusListener`) and wiring `lastJoinedGroup` back in, since all three are near-zero effort.

---

## 2. Feature catalog (section 8 of the original doc) — feasibility

This is the actual "what's good to build next" question. Rated on:
- **Status** — already built, partially built, or not started.
- **Effort** — rough size, assuming it's just me building it in this environment.
- **New dependency** — anything beyond what's already in `package.json`. This matters a lot right now because the Android build has been fragile all session (the Gradle/Kotlin issues), so anything requiring a **new native module** carries real risk of breaking the build again, versus a pure-JS addition which carries none.
- **Verdict** — my honest read on whether it's worth doing soon.

### 2.1 Core splitting & expenses

| Feature | Status | Effort | New dependency | Verdict |
|---|---|---|---|---|
| Custom splits (equal/exact/%/shares) | **Done** | — | — | — |
| Split by item (assign line items to people) | Not started | Moderate–high | None (pure JS, extends `SplitParams`) | Good to have, but a real UI undertaking (itemized entry + assignment screen). Worth doing after the smaller wins below. |
| Expense categories | **Done** | — | — | — |
| Edit expense | **Done** — UI shipped, `editHistory` audit trail now populates on every edit | — | — | — |
| Delete expense | **Done** (swipe to delete) | — | — | — |
| Date range / filters | Not started | Low–moderate | None | Good to have, especially once groups accumulate months of history. |
| Multi-currency | Schema exists, UI doesn't use it | Moderate | None for display; an FX-rates API only if you want live conversion | Worth doing the display part (respect `Group.currency` instead of hardcoding ₹) even without conversion. |

### 2.2 Settlements

| Feature | Status | Effort | New dependency | Verdict |
|---|---|---|---|---|
| Settle up | **Done** | — | — | — |
| Debt simplification | **Done** | — | — | — |
| Push notifications (new expense / group join) | **Done** — wired to the existing `esplit-backend` `/send-notification` endpoint, confirmed delivering on-device | — | — | — |
| Payment reminder nudge ("you still owe ₹X") | Not started | Low, now that the push pipeline is proven working | None — reuses `sendPushNotification` | Genuine quick win now: no new infrastructure needed, just a trigger (e.g. a scheduled check, or a nudge on app open) that calls the already-working notification path. |
| Payment links / UPI request | **Done** (settle-up already opens `upi://pay` with the amount prefilled) | — | — | A "share a payment request" variant is a small, low-effort extension if you want it separately from settle-up. |
| Settlement history | Data exists (in Firestore, in the PDF/Excel exports) | Low | None | There's no dedicated in-app screen listing settlements chronologically — small addition to Balances. |

### 2.3 Convenience

| Feature | Status | Effort | New dependency | Verdict |
|---|---|---|---|---|
| Scan QR to join | Not started | Moderate–high | **A camera/QR-scan native library** (e.g. `react-native-vision-camera`) | **Caution.** This is the riskiest item on the list given how fragile the Gradle build has been this session — a new native module is exactly the kind of change that broke the build twice already. I'd hold off until the build is rock-solid, or do it from your own machine where you can debug native issues directly. |
| Generate/show a QR for your own join code | Not started | Low | None strictly required — can hand-roll with `react-native-svg` (already installed), or add a pure-JS QR-generator package | Much lower risk than scanning — this half of the feature is genuinely easy and safe to add now. |
| Receipt OCR | Not started | High | ML Kit (native) or a cloud OCR API | Nice-to-have, not a near-term priority — real effort and either a native dependency or ongoing API cost. |
| Quick add (type "500 lunch") | Not started | Moderate | None (pure JS parsing) | Reasonable quick-add power-feature; voice input specifically would need speech-to-text (native/cloud), which I'd skip for now. |
| Recurring expenses | **Half-built** | Low | None | The due-detection banner and "Add again" flow already work in Activity — but there's no way to actually mark an expense recurring when creating it, so the feature is currently unreachable. **Quick win** to close the loop. |
| Offline support | Mostly free already | Low–moderate to harden | None | `@react-native-firebase/firestore` caches reads/writes offline by default. Formalizing this (an explicit "offline" banner, confirming the write queue behaves as expected) is a verification task more than new-feature work. |
| Home-screen widget | Not started | High | Native, per-platform (Android App Widget / iOS WidgetKit) | Not recommended right now — significant native surface area on top of an already-fragile build. |

### 2.4 Analytics & export

| Feature | Status | Effort | New dependency | Verdict |
|---|---|---|---|---|
| Spending-by-category chart | Text/chip breakdown exists in PDF/Excel; no visual chart | Low–moderate | None — same SVG technique as `BalanceDonut` | Good, safe, on-brand addition. |
| CSV/Excel export | **Done**, and just upgraded to a genuine multi-sheet `.xlsx` | — | — | — |
| Custom date-range report | Depends on date filtering above | Low, once filters exist | None | — |
| Per-person summary | **Done** (Balances screen + both exports) | — | — | — |

### 2.5 Social & engagement

| Feature | Status | Effort | New dependency | Verdict |
|---|---|---|---|---|
| Comments on an expense | Not started | Low–moderate | None (Firestore subcollection + small UI) | Reasonable, low-risk addition. |
| Reactions | Not started | Low | None | Nice-to-have, cosmetic. |
| Group avatar / custom photo | Not started | Moderate | **Image picker** (native) + **Firebase Storage** (new package, and needs enabling in the Firebase console) | Two new dependencies for something purely cosmetic — I'd deprioritize this relative to functional gaps. |
| Activity feed | Substantially covered by the Activity tab already | Low, for a distinct cross-group version | None | Not a priority — the existing per-group Activity list already does most of this job. |
| Invite from contacts | Not started | Moderate | `react-native-contacts` (native) + permissions | Convenience feature, not essential — the join-code/share-link flow already covers invites. |

### 2.6 Profile & settings

| Feature | Status | Effort | New dependency | Verdict |
|---|---|---|---|---|
| Profile screen | **Done** | — | — | — |
| Notification preferences | Not started | Moderate | None | No longer blocked — push notifications now work end-to-end, so this can be picked up whenever it's a priority. |
| Default split preference | Not started | Low | None | Easy, minor convenience. |
| Privacy controls (who sees email/phone) | Not started — **and worth flagging now**: the current Firestore rules let *any signed-in user*, not just group members, read *any* user's profile doc | Moderate (rules change + UI) | None | I'd treat the rules gap itself as a small security fix worth doing regardless of whether you build a settings UI around it. |
| "Download my data" export | Not started | Low–moderate | None (reuses the export code already built) | Straightforward if you want it — low effort given the export pipeline already exists. |

### 2.7 Trust & safety

| Feature | Status | Effort | New dependency | Verdict |
|---|---|---|---|---|
| Group admin / roles | Field existed but was **completely unenforced** until today's lock toggle — the first real use of `role` | Low, now that the pattern exists | None | Natural next step: admin-only "remove a member" would follow the same pattern (UI gate + a rules check) as the lock toggle. |
| Leave group | **Done** (with the open-balance guard) | — | — | — |
| Dispute / flag an expense | Not started | Low–moderate | None | Reasonable if disagreements come up in practice; not urgent otherwise. |
| Audit trail | **Done** — `editHistory` now populates automatically on every edit, now that edit-expense has shipped | — | — | — |

### 2.8 Platform & distribution

| Feature | Status | Effort | New dependency | Verdict |
|---|---|---|---|---|
| Force update / minimum version gate | Not started | Low–moderate | None — reuses Firebase, already in the project | **Worth doing before the next few releases stack up.** Read a small `appConfig/global` Firestore doc (`minSupportedVersion`, `latestVersion`) once at launch, compare against the app's own version, and show a blocking "please update" screen (linking to the Play Store listing) if the installed build is below the minimum. No new package — this is the same Firestore client you already use everywhere else, just one more read at startup. |
| iOS | `ios/` project already scaffolded (untouched since initial setup), Firebase iOS config (`GoogleService-Info.plist`) already in place | Moderate to actually verify; High to ship | Needs a Mac + Xcode | **Out of scope for me to build remotely** — I have no macOS environment, so this has to happen on your Mac. See the new callout in section 3 on testing it without paying for a developer account yet. |
| Web / PWA | Not started | High | A separate build target/app | Real effort, a distinct project really — treat as its own initiative, not a quick add-on. |
| App shortcuts / Siri | Not started | Moderate | Native, per-platform | Low priority given current build stability concerns. |
| Deep links | Partially done (join-by-link already works) | Low, to extend (e.g. "open this expense") | None | Cheap incremental extension whenever it's useful. |
| Share extension (share *into* the app) | Not started | Moderate | Native manifest/intent-filter changes (not a package, but real native config) | Same caution as QR scanning — hold until the build is stable. |

### 2.9 The "why not just use GPay" positioning (section 9 of the original doc)

This section is product/marketing narrative, not a technical feature — it doesn't need a feasibility rating. It's a solid articulation ("EzySplit is the ledger, GPay is the pipe") and worth carrying into onboarding copy and the app-store listing as-is.

---

## 3. Things I'd flag that weren't explicitly in the original list

A few things came up while re-checking the codebase that are worth your attention regardless of which features you pick next:

**Push notifications — fixed this cycle.** This used to say notifications were installed but completely disconnected; that's no longer true. The client now calls the existing `esplit-backend` `/send-notification` endpoint whenever someone adds an expense or joins a group, and you've confirmed on-device that it delivers. The one thing that specific gap doesn't cover yet is a proactive "you still owe money" reminder nudge — that's a distinct, now-low-effort feature since the delivery pipeline is proven (see the Settlements table above).

**The `users` collection is more open than it should be.** Right now any signed-in user (not just people who share a group with you) can read any other user's profile document, which includes their email and UPI ID. Tightening this to "readable by people who share at least one group with you" is a small, worthwhile fix independent of any new feature.

**Two pieces of confirmed dead code** (`src/services/firestore.js`, and the Redux-dependent `NetworkLostModal`/`NetworkStatusListener`) can be deleted with zero risk since nothing imports them — free cleanup whenever you want it.

**Testing iOS without an Apple Developer account.** The `ios/` project already exists in the repo (scaffolded when the app was first created, Firebase's `GoogleService-Info.plist` is already sitting in there) — it's just never been run since. None of this session's work added a new native module, so there's a reasonable chance it still builds. What you can do at each spend level, assuming you have (or can borrow) a Mac with Xcode:
- **Free, no Apple ID needed at all:** open `ios/EzySplit.xcworkspace` in Xcode and run on the iOS Simulator. This is the real test of whether the RN/JS code actually works on iOS — layout, navigation, Firestore, the new Toast/Alert system, deep links, everything except push notifications (the simulator can't receive real APNs pushes). Zero cost, no account of any kind required.
- **Free, on your own iPhone:** sign into Xcode with a personal (free) Apple ID and run the build directly onto your own phone over USB. Still $0, but the signing certificate expires every 7 days (just re-run from Xcode to renew), and it only runs on devices you physically plug in — there's no way to send it to anyone else this way.
- **Paid, to share with anyone else:** this is the part that genuinely requires the $99/year Apple Developer Program membership — TestFlight (for beta testers) and the App Store both require it, and there's no workaround on Apple's side. If the goal is just "does it work," the free Simulator route above answers that without spending anything; the developer account only becomes necessary once you want other people to install it.

---

## 4. My recommendation for what goes into "phase 2"

Roughly in priority order, balancing impact against how much of it is pure-JS (safe) versus needs a new native dependency (risk, given the Gradle history this session). Updated Aug 2026 — edit-expense and push notifications shipped this cycle, so both have dropped off this list; the force-update gate is new.

**Do first — small, safe, closes real gaps:**
1. Force update / minimum version gate (protects every future release from broken old-client bugs, and it's cheap — see section 2.8)
2. Payment reminder nudge — "you still owe ₹X" (the push pipeline is proven now, this is just a trigger away)
3. Finish recurring expenses (add the toggle to the "new expense" form)
4. Restore last-opened group on app launch
5. Delete the two dead files; fix or remove the network modal
6. Tighten the `users` read rule for privacy
7. Wire real currency display through from `Group.currency` (skip live FX conversion for now)

**Do next — genuine features, still no new native dependency:**
8. Test the existing iOS project on Simulator (free, no Apple account needed — see section 3) to know where it actually stands
9. Spending-by-category chart (reuse the `BalanceDonut` SVG approach)
10. Admin can remove a member (extends today's admin-role pattern)
11. Comments on an expense
12. Date-range filtering, then a custom-range report
13. Notification preferences screen

**Consider later — genuinely good ideas, but each pulls in a new native module or real infrastructure, so I'd sequence these only once the build is stable and/or you're testing from your own machine where native issues are easier to debug:**
14. QR-code join (scanning half specifically — showing your own QR to be scanned is safe now)
15. Group/profile photo upload (image picker + Firebase Storage)
16. Contacts-based invites
17. Receipt OCR
18. iOS App Store / TestFlight distribution (needs the paid Apple Developer account, on top of your Mac)

Let me know which of these you want to take on next and I'll start on them the same way as this session's work.

---

## 5. Post-v2.0.0 UI/design backlog (not scoped yet)

Flagged during v2.0.0 launch-prep feedback (Aug 2026), deliberately held back rather than rushed into this release:

- **Dashboard/header feel too basic for 2026.** Feedback was that both the Groups overview and the per-screen headers (currently just avatar, name, and a logout button) read as "old-fashioned" — wants real visual creativity: modern motion (something like a "drop"-in entrance for cards/content instead of a static appear), a more designed header treatment across every screen, and generally more personality than the current flat glass-card look.
- Needs its own scoping pass with mockups before building, rather than guessing at "modern feel" - this is a real design project (touches every screen's header plus new animation work), not a quick fix, and isn't worth the risk of introducing right before/right after a launch without a proper look first.
- Revisit once v2.0.0 has shipped and settled.

---

## 6. Google Play Console pre-launch findings, v2.0.0 (Aug 2026)

Five items came back on the pre-launch report for the v2.0.0 release. None of them blocked the release from going out, but they're worth working through deliberately rather than rushing native/Gradle changes right before a launch (same reasoning as section 5). Ordered by actual urgency, not the order Play Console listed them:

**1. 16 KB memory page size support — likely already satisfied, needs confirming, not urgent.**
This is the one flagged as "critical," so it got the deepest check. Two sources disagree sharply: a third-party guide says it's already a hard release blocker as of late 2025 with "no extension." Google's own official documentation (developer.android.com/guide/practices/page-sizes) says the real deadline is **February 1, 2027**, that it applies to apps targeting Android 15 (API 35)+, and that Play Console is currently just in a notification/warning phase, not yet rejecting releases over it. Google's own page is the source to trust here.
The good news: the project is already on **AGP 8.6.0** (`android/build.gradle`), and Google's docs say AGP 8.5.1+ auto-aligns native libraries to 16 KB pages at packaging time regardless of what NDK built them — so this build is very likely already compliant without any code change. The project's NDK (26.1.10909125, i.e. r26) is below the r28 that auto-aligns at compile time, but that shouldn't matter once AGP is re-aligning everything at the packaging step. Recommended action: no code change needed now; next time a release AAB is built, run it through Android Studio's APK Analyzer or `zipalign -c -P 16` to confirm alignment before the Feb 2027 deadline gets closer, rather than making speculative changes today.

**2 & 3. Edge-to-edge deprecated APIs.**
This is a direct callback to `MainActivity.kt`'s edge-to-edge setup from earlier this project: it sets `window.statusBarColor` / `window.navigationBarColor` directly, which Android now deprecates in favor of `androidx.activity`'s `enableEdgeToEdge()` helper. The app already does the *important* part correctly (`WindowCompat.setDecorFitsSystemWindows(window, false)`), so this is a deprecation warning, not a functional break — screens aren't failing to display edge-to-edge today. The "edge-to-edge may not display for all users" finding is the same root cause: on Android 15+ these manual color-setting calls are the deprecated path Google wants replaced. Fix path when picked up: swap the manual color/inset calls for `enableEdgeToEdge()` (from `androidx.activity:activity-ktx`, already pulled in transitively via React Native 0.74.3's AndroidX dependencies). Small, low-risk, native-only change — good candidate to bundle with the next native-code touch rather than shipping alone.

**4. Bitmap image optimization.** Play Console's generic suggestion to compress bundled bitmap assets (usually launcher icons / splash assets) for smaller download size. No functional risk — pure optimization. Low priority, do whenever touching app icons/splash next.

**5. R8 / AGP optimization (AGP 9.0+).** Play Console suggesting a future AGP upgrade for better code shrinking. This is a bigger native-build change than the others (AGP major version bumps have broken this build before), so per the section 5 rule of thumb — hold native/Gradle upgrades until they can be tested outside of a launch window. Lowest priority of the five; revisit alongside a deliberate Gradle/AGP upgrade pass, not in isolation.

**Suggested order if/when this gets picked up:** confirm #1 needs nothing (just verify, no code); bundle #2/#3 into the next native-code change; leave #4 and #5 for a dedicated cleanup/upgrade pass.

---

## 7. React Native / Firebase upgrade — bigger than it looks (Aug 2026)

You asked to add the Firebase SDK migration to the plan (possibly high priority) since upgrading it will likely mean upgrading React Native too, and asked whether to build this by starting a fresh RN project and moving `src/` over, or by hand-editing the existing native `android`/`ios` folders. Checked both the current RN/Firebase ecosystem state and this project's own native footprint before answering — the honest picture changes the scope of what's being asked for:

**This is no longer a routine version bump — it's a New Architecture migration, whether you want one or not.** As of React Native 0.82 (Oct 2025), the "New Architecture" (Fabric/TurboModules) is mandatory — the flag to keep the old architecture (`newArchEnabled=false`, which this project currently has) is simply ignored from that version on. Separately, and just as decisive: react-native-firebase's latest major (v26, Aug 2026) now requires New Architecture for every package with a native bridge — auth, firestore, messaging, all of it — and Invertase's own guidance is "if you can't enable New Arch yet, stay on v25." So the Firebase upgrade you asked for and an RN upgrade to anything recent are now the same project, not two separate ones, and that project is fundamentally a New Architecture migration for the whole app, not a dependency bump.

**Recommendation: hand-edit the existing project through the official incremental path — do not start a fresh project and move `src/` over.** It sounds simpler to start clean, but this app has accumulated a lot of native-side customization this session and before it that a fresh template won't have: the `MainActivity.kt` edge-to-edge setup, the `Podfile`'s `post_install` hooks (React Native's own plus the gRPC-Core patch just added), the deep-link intent filters, Notifee's notification channels, the Google Sign-In URL schemes, the CI pipeline's `versionCode`/`BUILD_NUMBER` logic, and the signing/keystore config. Recreating fresh means manually re-discovering and re-adding every one of those by hand with no diff to check against — a much easier way to silently lose something than the reverse. React Native's own recommended tool for this, still current in 2026, is the **Upgrade Helper** (react-native-community.github.io/upgrade-helper): it diffs the stock template between your current version and a target version so you only touch the lines that actually changed, leaving your customizations alone.

**Recommended staging, given the New Arch gate:**
1. Do this as its own dedicated branch and project — not squeezed in alongside regular feature work — once v2.0.0 has shipped and settled.
2. Upgrade to RN **0.81** first via Upgrade Helper (the last version where New Architecture is still optional), with New Arch still off. This isolates "did the version bump break something" from "did New Architecture break something."
3. Before flipping New Architecture on, check each native-bridge dependency this app actually uses for New Arch support: `@notifee/react-native`, `react-native-google-mobile-ads`, `@react-native-google-signin/google-signin`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-screens`, `react-native-svg`, `react-native-vector-icons`, `react-native-fs`, `react-native-html-to-pdf`, `@r4dic4l/react-native-open-doc`, `react-native-calendars`, `react-native-keyboard-aware-scroll-view`. The smaller/less-actively-maintained ones on this list (`react-native-html-to-pdf`, `@r4dic4l/react-native-open-doc`, `react-native-keyboard-aware-scroll-view`) are the most likely to lag behind or need replacing — worth confirming before committing further.
4. Enable New Architecture on 0.81, rebuild, and re-test the app end-to-end — not just "does it launch." New Architecture changes bridge/threading behavior, and this session alone fixed two timing-sensitive bugs (the leave-group race condition, the create-group modal loader) that are exactly the class of bug a threading change could quietly reintroduce.
5. Only once that's stable, continue forward to the current latest RN release via Upgrade Helper again.
6. Upgrade `@react-native-firebase/*` from 20.3.0 to v26 last. This isn't just a version bump either — v26 removes the namespaced API you use throughout `firestoreLedger.ts` today (`firebase.auth()`, `firestore().collection(...)` style) in favor of the modular API (`getAuth(app)`, `getFirestore(app)`, `collection(db, ...)`), so every Firebase call site needs updating, not just the `package.json` line. The upside: v26 also fixes the gRPC-Core/Xcode issue from this session at the source, so the Podfile patch becomes unnecessary once you're on it.

**Effort:** realistically 3–6 weeks of focused, dedicated work including proper regression testing — not a "next quick win" alongside other features, given it touches Android build tooling (AGP/Gradle/Kotlin all need bumping together with this), iOS (Xcode/CocoaPods versions), every native dependency's compatibility, and a real rewrite of the Firebase call sites. Worth doing for the "fast and latest" benefits you're after and to get ahead of Firebase's CocoaPods shutdown (registry read-only Dec 2026), but it deserves its own isolated window rather than a priority slot next to smaller fixes — I'd sequence it after the post-v2.0.0 UI backlog (section 5), not before it.
