# Personal Expense Tracking — Feature Plan

Target: ship after 2.1.0 (multi-currency), tentatively as 2.2.0. This document is the spec —
nothing described here is built yet except where explicitly marked done.

## 1. What this is

Today EzySplit only tracks money split between people inside a group. Users have been asking for
a way to log their own spending — rent, coffee, a solo purchase — with no group, no split, no other
person involved. This adds that as a parallel feature, not a replacement for anything: groups keep
working exactly as they do today.

## 2. Data model (new collection, fully additive)

```
users/{uid}/personalExpenses/{expenseId}
  description: string
  amount: number
  currency: string          // ISO 4217, defaults to the user's AppUser.defaultCurrency
  category: ExpenseCategory // reuses the existing enum from ledger/types.ts — no new taxonomy
  createdAt: string         // ISO timestamp
  updatedAt?: string
```

No split, no `shares` map, no `paidBy` (it's always the owner) — this is deliberately a much
simpler document than a group `Expense`, because there's no distribution logic to store.

Scoped as a subcollection under `users/{uid}` rather than a top-level collection so that whenever
`firestore.rules` gets locked down, "only the owner can read/write their own personal expenses"
falls out naturally without restructuring anything.

## 3. Zero-risk guarantee

This is the constraint the whole plan is built around, per direct instruction: no existing user's
data may be touched, altered, or put at risk.

- No existing collection (`groups/**`, `users/{uid}`'s existing fields) is written to by this
  feature, ever. `personalExpenses` is a brand new subcollection — there is nothing to migrate or
  backfill on old data, because old data doesn't need to know this feature exists.
- No existing exported function's signature changes (`addExpense`, `editExpense`, `createGroup`,
  etc. in `firestoreLedger.ts` stay exactly as they are). Every existing group screen keeps calling
  them unchanged.
- The one existing hook this touches, `useGroupsOverview.ts`, only gains _new_ returned fields
  (see §4) — every field it returns today keeps the same meaning and the same value it has today.
- A user with zero personal expenses gets identical dashboard numbers to what they see today. This
  is asserted by an actual test (§6), not just claimed.
- If a bug surfaces after release, the fix is hiding the new UI — never a data rollback, since no
  existing document is ever reshaped by this feature.

## 4. Combined "how much have I spent" computation

Two different numbers exist today and must not be confused:

- **Net balance** (today's owed/owe donut on Group-Check) — a debt number between people. Personal
  expenses have no counterparty, so they can never be part of this number. Stays exactly as-is.
- **Total spent** — genuinely "money that left my pocket." This is new; it doesn't exist as a
  combined figure anywhere today (the closest thing, `useGroupLedger`'s `totalSpent`, is a whole
  _group's_ combined spend, not the signed-in user's own share of it).

For the new combined total:

- **Group side**: sum `expense.shares[uid]` (the split engine's own per-person cost, already stored
  on every expense) across every expense in every group the user belongs to — not
  `expense.amount`, which would count the full bill even when it was split four ways.
- **Personal side**: sum `personalExpense.amount` across the new collection — no split to account
  for.
- **Combine**: bucket both by currency and merge, exactly like `totalsByCurrency` already does for
  balances — a ₹ expense and a $ expense are never added together. Reuses the same
  primary-currency tie-break logic already in `useGroupsOverview.ts`.
- `useGroupsOverview.ts`'s `load()` already fetches every group's expenses to compute net balance
  — the `shares[uid]` sum is accumulated in that same pass, so this doesn't cost a second fetch of
  group data. It does add one new fetch (personal expenses), which is unavoidable since it's a
  different collection.
- Known scaling note, not a v1 concern: this sums every historical expense on every load, same as
  the existing balance calculation does today. Fine at current usage; a future optimization (a
  maintained running-total field, updated via a Cloud Function) would only be worth it once
  expense history is large enough to notice — not before.

## 5. Navigation placement

Not a new bottom tab. Two reasons: `BottomTabNavigator.tsx`'s own comments explain the team
deliberately moved from 4 tabs to 3 (+ a floating add button) recently, specifically because a
4th column read as lopsided — adding a plain 4th tab walks that back. More importantly, the bottom
tabs (`Home`) only exist _inside_ a specific group's context; personal expenses aren't tied to any
group, so they don't conceptually belong inside a per-group tab bar at all.

Instead: `Group-Check` (the group list + Overview dashboard, reached before entering any specific
group — already group-independent) gets the new toggle and a "Personal expenses" entry point. That
pushes a new sibling stack screen (`Group-Check` / `Home` / `Logout` / **`Personal`**), with its own
simple list + a lightweight "add expense" modal (no participant picker, no split type — just
description, amount, category).

## 6. Dashboard toggle (Group-Check / Overview screen)

A small segmented control — **All / Groups / Personal** — placed above a new "Total spent" card
that sits alongside the existing owed/owe donut, not inside it. The donut and its two numbers are
untouched, always group-only, no toggle. The toggle only drives the new stat:

- **Groups** — today's group-share total (new, per §4)
- **Personal** — sum of the new collection
- **All** (default) — both combined, per-currency

Selected mode persists locally (AsyncStorage), same pattern as `groupKey` already does.

## 7. v1 scope

- Add / edit / delete a personal expense (description, amount, currency — defaults to
  `AppUser.defaultCurrency`, editable per-entry for the rare traveling-abroad case — category)
- Personal expenses list screen with a running total
- Group-Check dashboard: toggle + combined "Total spent" card
- need to give last month 3 month 6 month 9 month and 12 month along with calender filter with date range to properly spends
- Tests: currency-combination math (mirroring the `currency.test.ts` style), and the explicit
  zero-personal-expenses regression check against today's existing numbers

## 8. Explicitly out of v1 (candidates for a later round, not forgotten)

- Category breakdown chart for personal spend
- Recurring personal expenses — worth doing together with closing the same gap on the group side
  (per `PHASE_2_FEASIBILITY.md`, group recurring is "half-built": the banner exists, nothing lets
  you mark an expense recurring at creation)
- Monthly personal budget + nudge notification (push pipeline is already proven working)
- "Convert to group expense" quick action on a personal expense
- PDF/Excel export of personal expenses (near-direct reuse of `exportReport.ts`)

## 9. Firestore rules

Out of scope for this feature — current rules (`allow read, write: if true` for everything) are a
known, separate issue the project owner is handling on their own timeline. The new collection's
`users/{uid}/personalExpenses` shape is chosen specifically so locking rules down later needs no
restructuring here.
