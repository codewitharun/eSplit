// src/services/ledger/groupInsights.ts
// Numbers for the Activity screen's header card (GroupInsightsCard):
// the group's total spend, the signed-in user's share of it, what they
// paid out of pocket, their net position, and the top category.
// Read-only and pure - derived from the same expenses/netBalances the
// rest of the screen already has, no extra Firestore reads.

import {round2} from './splitEngine';
import {EPSILON, Expense, ExpenseCategory} from './types';

export interface GroupInsights {
  totalSpent: number;
  myShare: number;
  myPaid: number;
  // Share of the group's total spend that was the user's (0-1).
  myShareRatio: number;
  // From computeNetBalances: > 0 owed to the user, < 0 the user owes.
  net: number;
  position: 'owed' | 'owes' | 'settled';
  topCategory: {key: ExpenseCategory; ratio: number} | null;
  expenseCount: number;
}

export function computeGroupInsights(
  expenses: Pick<Expense, 'amount' | 'paidBy' | 'shares' | 'category'>[],
  uid: string,
  netBalance: number,
): GroupInsights {
  let totalSpent = 0;
  let myShare = 0;
  let myPaid = 0;
  const byCategory: Partial<Record<ExpenseCategory, number>> = {};
  expenses.forEach(e => {
    totalSpent += e.amount;
    myShare += e.shares?.[uid] || 0;
    if (e.paidBy === uid) {
      myPaid += e.amount;
    }
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  });
  let topCategory: GroupInsights['topCategory'] = null;
  (Object.keys(byCategory) as ExpenseCategory[]).forEach(key => {
    const amount = byCategory[key] || 0;
    if (
      totalSpent > 0 &&
      (!topCategory || amount / totalSpent > topCategory.ratio)
    ) {
      topCategory = {key, ratio: amount / totalSpent};
    }
  });
  const net = round2(netBalance || 0);
  return {
    totalSpent: round2(totalSpent),
    myShare: round2(myShare),
    myPaid: round2(myPaid),
    myShareRatio: totalSpent > 0 ? Math.min(myShare / totalSpent, 1) : 0,
    net,
    position: net > EPSILON ? 'owed' : net < -EPSILON ? 'owes' : 'settled',
    topCategory,
    expenseCount: expenses.length,
  };
}
