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
| Edit expense | Backend ready, **no UI** | Low | None | **Quick win.** `editExpense()` already exists and works; there's just no screen/button calling it. Delete is already wired via swipe — edit should be the same pattern. |
| Delete expense | **Done** (swipe to delete) | — | — | — |
| Date range / filters | Not started | Low–moderate | None | Good to have, especially once groups accumulate months of history. |
| Multi-currency | Schema exists, UI doesn't use it | Moderate | None for display; an FX-rates API only if you want live conversion | Worth doing the display part (respect `Group.currency` instead of hardcoding ₹) even without conversion. |

### 2.2 Settlements

| Feature | Status | Effort | New dependency | Verdict |
|---|---|---|---|---|
| Settle up | **Done** | — | — | — |
| Debt simplification | **Done** | — | — | — |
| Payment reminders (push notifications) | **Not wired at all** — see note below | Moderate | A Cloud Functions deployment (backend, not an npm package) for true push when the app is closed; a lighter local-only reminder needs nothing new | See the notifications note in section 3 — this is a bigger gap than it looks. |
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
| Notification preferences | Not started (and depends on notifications actually working — see below) | Moderate | None | Sequence this after the notifications gap is closed, not before. |
| Default split preference | Not started | Low | None | Easy, minor convenience. |
| Privacy controls (who sees email/phone) | Not started — **and worth flagging now**: the current Firestore rules let *any signed-in user*, not just group members, read *any* user's profile doc | Moderate (rules change + UI) | None | I'd treat the rules gap itself as a small security fix worth doing regardless of whether you build a settings UI around it. |
| "Download my data" export | Not started | Low–moderate | None (reuses the export code already built) | Straightforward if you want it — low effort given the export pipeline already exists. |

### 2.7 Trust & safety

| Feature | Status | Effort | New dependency | Verdict |
|---|---|---|---|---|
| Group admin / roles | Field existed but was **completely unenforced** until today's lock toggle — the first real use of `role` | Low, now that the pattern exists | None | Natural next step: admin-only "remove a member" would follow the same pattern (UI gate + a rules check) as the lock toggle. |
| Leave group | **Done** (with the open-balance guard) | — | — | — |
| Dispute / flag an expense | Not started | Low–moderate | None | Reasonable if disagreements come up in practice; not urgent otherwise. |
| Audit trail | Schema ready (`editHistory` on `Expense`), **dormant** until expense-editing gets a UI | — | None | Will "activate" for free once edit-expense ships. |

### 2.8 Platform & distribution

| Feature | Status | Effort | New dependency | Verdict |
|---|---|---|---|---|
| iOS | Not started | High | Needs a Mac + Xcode | **Out of scope for me to build remotely** — this has to happen on your own Mac, I can't touch native iOS project files from here. |
| Web / PWA | Not started | High | A separate build target/app | Real effort, a distinct project really — treat as its own initiative, not a quick add-on. |
| App shortcuts / Siri | Not started | Moderate | Native, per-platform | Low priority given current build stability concerns. |
| Deep links | Partially done (join-by-link already works) | Low, to extend (e.g. "open this expense") | None | Cheap incremental extension whenever it's useful. |
| Share extension (share *into* the app) | Not started | Moderate | Native manifest/intent-filter changes (not a package, but real native config) | Same caution as QR scanning — hold until the build is stable. |

### 2.9 The "why not just use GPay" positioning (section 9 of the original doc)

This section is product/marketing narrative, not a technical feature — it doesn't need a feasibility rating. It's a solid articulation ("EzySplit is the ledger, GPay is the pipe") and worth carrying into onboarding copy and the app-store listing as-is.

---

## 3. Things I'd flag that weren't explicitly in the original list

A few things came up while re-checking the codebase that are worth your attention regardless of which features you pick next:

**Push notifications are installed but completely disconnected.** Notifee is configured (channels for transactions and exports exist), and the app registers an FCM token on login — but nothing in the app ever actually calls `displayNotification`. There's no Cloud Function or any other backend piece sending a push when someone else adds an expense or settles up. So "payment reminders" and "new expense" notifications aren't a small toggle away — they need either a Cloud Functions deployment (real backend work, needs your Firebase project's Blaze plan) for cross-device push, or a lighter local-only version (e.g., check open balances and show a local reminder when the app is opened) that needs no new infrastructure. Worth deciding which of those two shapes you actually want before scoping it.

**The `users` collection is more open than it should be.** Right now any signed-in user (not just people who share a group with you) can read any other user's profile document, which includes their email and UPI ID. Tightening this to "readable by people who share at least one group with you" is a small, worthwhile fix independent of any new feature.

**Two pieces of confirmed dead code** (`src/services/firestore.js`, and the Redux-dependent `NetworkLostModal`/`NetworkStatusListener`) can be deleted with zero risk since nothing imports them — free cleanup whenever you want it.

---

## 4. My recommendation for what goes into "phase 2"

Roughly in priority order, balancing impact against how much of it is pure-JS (safe) versus needs a new native dependency (risk, given the Gradle history this session):

**Do first — small, safe, closes real gaps:**
1. Edit-expense UI (backend's ready, just needs the screen)
2. Finish recurring expenses (add the toggle to the "new expense" form)
3. Restore last-opened group on app launch
4. Delete the two dead files; fix or remove the network modal
5. Tighten the `users` read rule for privacy
6. Wire real currency display through from `Group.currency` (skip live FX conversion for now)

**Do next — genuine features, still no new native dependency:**
7. Decide on and build a notifications shape (local reminders, or scope a Cloud Function for real push)
8. Spending-by-category chart (reuse the `BalanceDonut` SVG approach)
9. Admin can remove a member (extends today's admin-role pattern)
10. Comments on an expense
11. Date-range filtering, then a custom-range report

**Consider later — genuinely good ideas, but each pulls in a new native module or real infrastructure, so I'd sequence these only once the build is stable and/or you're testing from your own machine where native issues are easier to debug:**
12. QR-code join (scanning half specifically — showing your own QR to be scanned is safe now)
13. Group/profile photo upload (image picker + Firebase Storage)
14. Contacts-based invites
15. Receipt OCR
16. iOS (needs your Mac regardless of anything else)

Let me know which of these you want to take on next and I'll start on them the same way as this session's work.
