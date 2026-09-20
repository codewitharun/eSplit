// src/services/ledger/spendTotals.ts
// Pure currency-bucketed spend math, shared between the existing group
// ledger and the new Personal Expense feature (see PERSONAL_EXPENSE_PLAN.md
// section 4). Kept dependency-free (no Firestore) so it's unit-testable the
// same way splitEngine.ts and debtSimplifier.ts already are.
//
// Two different numbers exist and must never be confused:
//   - net balance (debtSimplifier.ts) - a debt number between people.
//   - "total spent" (this file) - money that actually left someone's
//     pocket, whether or not anyone owes them for it.
// Personal expenses have no counterparty, so they only ever exist on the
// "total spent" side of that line.

import {DEFAULT_CURRENCY} from './currency';

export interface MinimalShareExpense {
  currency?: string;
  shares: Record<string, number>;
}

export interface MinimalAmountExpense {
  currency?: string;
  amount: number;
}

// Sums each expense's *share* for `uid` - not the whole expense.amount -
// bucketed by currency. This is "how much of this expense was actually
// mine", which is deliberately different from useGroupLedger's
// `totalSpent` field (the whole group's combined spend, labeled "Total
// group spend" in the UI).
export function sumSharesByCurrency(
  expenses: MinimalShareExpense[],
  uid: string,
): Record<string, number> {
  const totals: Record<string, number> = {};
  expenses.forEach(e => {
    const share = e.shares?.[uid];
    if (!share) {
      return;
    }
    const code = e.currency || DEFAULT_CURRENCY;
    totals[code] = (totals[code] || 0) + share;
  });
  return totals;
}

// Sums plain amounts (no split to account for) bucketed by currency - used
// for the personal-expense side of the combined total, where every expense
// is entirely the owner's own spend.
export function sumAmountsByCurrency(
  items: MinimalAmountExpense[],
): Record<string, number> {
  const totals: Record<string, number> = {};
  items.forEach(item => {
    const code = item.currency || DEFAULT_CURRENCY;
    totals[code] = (totals[code] || 0) + item.amount;
  });
  return totals;
}

// Merges any number of currency-bucketed totals maps by summing matching
// currency codes - never adds two different currencies together, the same
// rule totalsByCurrency already follows for balances. Merging in an empty
// map (e.g. a user with zero personal expenses) is a no-op, which is what
// guarantees the combined "All" total equals today's existing group-only
// total for anyone who hasn't touched the new feature.
export function mergeCurrencyTotals(
  ...maps: Record<string, number>[]
): Record<string, number> {
  const totals: Record<string, number> = {};
  maps.forEach(map => {
    Object.entries(map).forEach(([code, amount]) => {
      totals[code] = (totals[code] || 0) + amount;
    });
  });
  return totals;
}
