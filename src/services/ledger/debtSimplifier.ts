// src/services/ledger/debtSimplifier.ts
//
// Turns a pile of expenses + settlements into (a) each member's net balance
// and (b) the *fewest* payments needed to bring every balance to zero.
//
// This is the piece the current app has none of: today, three people who
// each fronted one shared cost end up with three separate mental IOUs.
// Netting + a greedy largest-creditor/largest-debtor match collapses that
// to the minimum number of transfers.

import {EPSILON, SimplifiedTransfer} from './types';

export interface LedgerExpenseInput {
  paidBy: string;
  amount: number;
  splits: Record<string, number>; // uid -> that uid's share of this expense
}

export interface LedgerSettlementInput {
  fromUid: string; // who paid
  toUid: string; // who received
  amount: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Positive net balance = this member is owed money overall.
 * Negative net balance = this member owes money overall.
 */
export function computeNetBalances(
  memberUids: string[],
  expenses: LedgerExpenseInput[],
  settlements: LedgerSettlementInput[] = [],
): Record<string, number> {
  const net: Record<string, number> = {};
  memberUids.forEach(uid => (net[uid] = 0));

  for (const expense of expenses) {
    if (!(expense.paidBy in net)) {
      net[expense.paidBy] = 0;
    }
    net[expense.paidBy] += expense.amount;

    for (const [uid, share] of Object.entries(expense.splits)) {
      if (!(uid in net)) {
        net[uid] = 0;
      }
      net[uid] -= share;
    }
  }

  for (const settlement of settlements) {
    if (!(settlement.fromUid in net)) {
      net[settlement.fromUid] = 0;
    }
    if (!(settlement.toUid in net)) {
      net[settlement.toUid] = 0;
    }
    // fromUid handed over money, closing part of their debt (or building
    // credit); toUid received it, reducing what they're owed.
    net[settlement.fromUid] += settlement.amount;
    net[settlement.toUid] -= settlement.amount;
  }

  Object.keys(net).forEach(uid => (net[uid] = round2(net[uid])));
  return net;
}

/**
 * Greedy min-cash-flow simplification: repeatedly settle the largest
 * creditor against the largest debtor. This does not always find the
 * theoretical minimum number of transactions (that's an NP-hard partition
 * problem for the general case), but it's the standard practical
 * approximation used by every mainstream splitting app, and it's optimal
 * whenever debts don't happen to partition into independent subgroups.
 */
export function simplifyDebts(
  netBalances: Record<string, number>,
): SimplifiedTransfer[] {
  type Entry = {uid: string; amount: number};

  const creditors: Entry[] = [];
  const debtors: Entry[] = [];

  for (const [uid, balance] of Object.entries(netBalances)) {
    if (balance > EPSILON) {
      creditors.push({uid, amount: balance});
    } else if (balance < -EPSILON) {
      debtors.push({uid, amount: -balance});
    }
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transfers: SimplifiedTransfer[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const amount = round2(Math.min(creditor.amount, debtor.amount));

    if (amount > EPSILON) {
      transfers.push({fromUid: debtor.uid, toUid: creditor.uid, amount});
    }

    creditor.amount = round2(creditor.amount - amount);
    debtor.amount = round2(debtor.amount - amount);

    if (creditor.amount <= EPSILON) {
      ci++;
    }
    if (debtor.amount <= EPSILON) {
      di++;
    }
  }

  return transfers;
}
