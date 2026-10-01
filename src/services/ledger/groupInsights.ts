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
  // Whole-group spend this calendar month and last, and the change as a
  // ratio (0.12 = +12%); null when last month had no spend to compare to.
  thisMonth: number;
  lastMonth: number;
  monthChange: number | null;
}

export function computeGroupInsights(
  expenses: Pick<
    Expense,
    'amount' | 'paidBy' | 'shares' | 'category' | 'createdAt'
  >[],
  uid: string,
  netBalance: number,
  now: Date = new Date(),
): GroupInsights {
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  let thisMonth = 0;
  let lastMonth = 0;
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
    const t = new Date(e.createdAt);
    if (t >= thisMonthStart) {
      thisMonth += e.amount;
    } else if (t >= lastMonthStart) {
      lastMonth += e.amount;
    }
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
    thisMonth: round2(thisMonth),
    lastMonth: round2(lastMonth),
    monthChange: lastMonth > 0 ? (thisMonth - lastMonth) / lastMonth : null,
  };
}

export interface SettleUpSummary {
  owedToMe: number;
  owedToMeCount: number; // people who owe the user
  iOwe: number;
  iOweCount: number; // people the user owes
  settled: number; // all settlements recorded in the group
  outstanding: number; // all open who-owes-whom amounts in the group
  settledRatio: number; // settled / (settled + outstanding), 0-1
}

// Numbers for the Balances hero card, from the same transfer list and
// settlements the screen already shows.
export function computeSettleUpSummary(
  transfers: {fromUid: string; toUid: string; amount: number}[],
  settlements: {amount: number}[],
  uid: string,
): SettleUpSummary {
  let owedToMe = 0;
  let iOwe = 0;
  let outstanding = 0;
  const owers = new Set<string>();
  const owees = new Set<string>();
  transfers.forEach(t => {
    outstanding += t.amount;
    if (t.toUid === uid) {
      owedToMe += t.amount;
      owers.add(t.fromUid);
    } else if (t.fromUid === uid) {
      iOwe += t.amount;
      owees.add(t.toUid);
    }
  });
  const settled = settlements.reduce((sum, s) => sum + (s.amount || 0), 0);
  const denom = settled + outstanding;
  return {
    owedToMe: round2(owedToMe),
    owedToMeCount: owers.size,
    iOwe: round2(iOwe),
    iOweCount: owees.size,
    settled: round2(settled),
    outstanding: round2(outstanding),
    settledRatio: denom > 0 ? settled / denom : 1,
  };
}
