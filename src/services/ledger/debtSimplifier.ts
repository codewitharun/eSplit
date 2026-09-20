// src/services/ledger/debtSimplifier.ts
//
// Turns a pile of expenses + settlements into (a) each member's net balance
// and (b) settle-up transfers.
//
// Two different transfer views live here:
//   - simplifyDebts(): the *fewest* payments needed to bring every net
//     balance to zero (netting + greedy largest-creditor/largest-debtor
//     match). No longer used by Balances.tsx - users found it confusing
//     ("why do I pay X when I only ever shared a bill with Y?") when a
//     minimum-transaction payment doesn't trace back to any specific
//     expense between that pair. Kept (with its existing test) as a
//     still-correct algorithm, same as this file keeps computeNetBalances
//     below regardless.
//   - computePairwiseLedger(): direct, pair-by-pair "who owes who for
//     what" - see its own comment below. This is what Balances.tsx's
//     "Who owes whom" section actually shows now. Ported from (and MUST
//     be kept in lockstep with) the backend's independent verification
//     copy at esplit-backend/lib/ledgerMath.js, which mirrors this file
//     for the admin panel's Group Inspector - if this algorithm ever
//     changes, mirror the change there too.

import {EPSILON, Expense, Settlement, SimplifiedTransfer} from './types';

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

// Direct, pair-by-pair ledger - what users asked for instead of
// simplifyDebts()'s minimum-transaction shortcut. For every expense,
// whoever didn't pay owes their own share straight to whoever did, full
// stop - no netting against the rest of the group. A settlement is
// folded in the same way, netted only against the exact pair it was
// recorded against (a payment made under the old simplified view won't
// necessarily zero out a specific pair here - that's expected, not a
// bug: it was never a payment against that pair's own shared expenses in
// the first place).
//
// Returns every pair with a non-zero net amount owed, as
// {fromUid, toUid, amount}, largest first. Unlike simplifyDebts(), this
// can and often will list MORE transfers than the minimum required -
// that's the whole point of it: it's the "who owes who for what,
// exactly" view, not the "fewest payments to zero everyone out" view.
// The two will always reconcile to the same net balance per person
// (computeNetBalances above) even though the transfer lists differ.
export function computePairwiseLedger(
  expenses: Pick<Expense, 'paidBy' | 'shares'>[],
  settlements: Pick<Settlement, 'fromUid' | 'toUid' | 'amount'>[] = [],
): SimplifiedTransfer[] {
  const raw: Record<string, Record<string, number>> = {}; // raw[a][b] = total 'a' owes 'b', before pair-netting
  function bump(from: string, to: string, amount: number) {
    if (!from || !to || from === to || !amount) {
      return;
    }
    if (!raw[from]) {
      raw[from] = {};
    }
    raw[from][to] = round2((raw[from][to] || 0) + amount);
  }

  for (const expense of expenses) {
    const payer = expense.paidBy;
    for (const [uid, share] of Object.entries(expense.shares || {})) {
      if (uid === payer) {
        continue; // payer's own share isn't a debt to themselves
      }
      bump(uid, payer, Number(share) || 0);
    }
  }

  for (const settlement of settlements) {
    // A direct payment reduces exactly this pair's debt, the same as if
    // it were negative shared spending between the two of them.
    bump(
      settlement.fromUid,
      settlement.toUid,
      -(Number(settlement.amount) || 0),
    );
  }

  const uids = new Set<string>([
    ...Object.keys(raw),
    ...Object.values(raw).flatMap(row => Object.keys(row)),
  ]);

  const seen = new Set<string>();
  const pairs: SimplifiedTransfer[] = [];
  for (const a of uids) {
    for (const b of uids) {
      if (a === b) {
        continue;
      }
      const key = [a, b].sort().join('::');
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      const net = round2((raw[a]?.[b] || 0) - (raw[b]?.[a] || 0));
      if (net > EPSILON) {
        pairs.push({fromUid: a, toUid: b, amount: net});
      } else if (net < -EPSILON) {
        pairs.push({fromUid: b, toUid: a, amount: -net});
      }
    }
  }

  pairs.sort((x, y) => y.amount - x.amount);
  return pairs;
}
