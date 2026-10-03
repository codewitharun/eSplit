// src/services/ledger/expenseAudit.ts
// "What changed after we settled up?" - pure helpers behind:
//   - the "Edited" / "Edited after settle-up" chips in Activity,
//   - the change log in the expense details sheet,
//   - the "Changes since settle-up" card on Balances,
//   - the confirm prompt before editing/deleting an old expense.
//
// Works on data already stored: Expense.editHistory (written on every edit
// since editing shipped), the group's settlements, and the additive
// groups/{id}/deletedExpenses log (see deleteExpense in data/ledger.ts).
// No migration - expenses without editHistory just show no history.
import {currencySymbol} from './currency';
import {
  DeletedExpense,
  EditHistoryEntry,
  Expense,
  Settlement,
} from './types';

// Parts of a change summary (AddExpenseModal's buildChangeSummary) that
// move money around. A bare "Edited expense" (nothing visible changed -
// e.g. an older app version re-saving per-person exact amounts) is treated
// as a money change too, to be safe.
const MONEY_PART = /^(amount:|items:|payer changed|split:|participants changed|shares changed)/;

export function isMoneyEdit(change: string | undefined): boolean {
  if (!change || change.trim() === '' || change === 'Edited expense') {
    return true;
  }
  return change.split('; ').some(part => MONEY_PART.test(part.trim()));
}

/** Edits, oldest first. Legacy docs with only `editedAt` get one entry. */
export function editEntries(expense: Expense): EditHistoryEntry[] {
  const list = expense.editHistory?.length
    ? [...expense.editHistory]
    : expense.editedAt
    ? [{editedAt: expense.editedAt, editedBy: expense.createdBy, change: ''}]
    : [];
  return list.sort((a, b) => (a.editedAt < b.editedAt ? -1 : 1));
}

/** Latest settle-up payment in the group (ISO), or null. */
export function lastSettlementAt(settlements: Settlement[]): string | null {
  return settlements.reduce<string | null>(
    (max, s) => (!max || s.createdAt > max ? s.createdAt : max),
    null,
  );
}

/** True when some settle-up happened strictly between `from` and `to`. */
function settledBetween(settlements: Settlement[], from: string, to: string) {
  return settlements.some(s => s.createdAt > from && s.createdAt < to);
}

/** Was this expense created before the group's most recent settle-up? */
export function predatesLastSettlement(
  expense: Pick<Expense, 'createdAt'>,
  settlements: Settlement[],
): boolean {
  const last = lastSettlementAt(settlements);
  return !!last && expense.createdAt < last;
}

export type EditBadge = 'none' | 'edited' | 'afterSettle';

/**
 * Row badge: 'afterSettle' when a money-changing edit landed after a
 * settle-up that already covered this expense (the case that silently
 * reopens balances), 'edited' for any other edit.
 */
export function editBadge(expense: Expense, settlements: Settlement[]): EditBadge {
  const edits = editEntries(expense);
  if (!edits.length) {
    return 'none';
  }
  const reopened = edits.some(
    e =>
      isMoneyEdit(e.change) &&
      settledBetween(settlements, expense.createdAt, e.editedAt),
  );
  return reopened ? 'afterSettle' : 'edited';
}

/** "amount: Rs.500.00 -> Rs.800.00; payer changed" -> readable lines. */
export function describeChange(change: string, currency?: string): string[] {
  if (!change || change === 'Edited expense') {
    return ['Updated how it’s split'];
  }
  const symbol = currencySymbol(currency);
  return change.split('; ').map(raw => {
    let part = raw
      .trim()
      .replace(/Rs\./g, symbol)
      .replace(/ -> /g, ' → ');
    part = part
      .replace(/^description:/, 'Name:')
      .replace(/^amount:/, 'Amount:')
      .replace(/^category:/, 'Category:')
      .replace(/^split:/, 'Split:')
      .replace(/^items:/, 'Items:');
    return part.charAt(0).toUpperCase() + part.slice(1);
  });
}

/** Change in the expense amount from a summary, if the amount changed. */
export function amountDelta(change: string): number | null {
  const m = /amount: Rs\.([\d.]+) -> Rs\.([\d.]+)/.exec(change || '');
  return m ? Number(m[2]) - Number(m[1]) : null;
}

/** How a deleted expense moves `uid`'s net balance (+ = owed more / owe less). */
export function deletionImpact(d: DeletedExpense, uid: string): number {
  const share = d.shares?.[uid] || 0;
  const paid = d.paidBy === uid ? d.amount : 0;
  // Before deletion this expense put (paid - share) in your favour;
  // removing it takes that away.
  return -(paid - share);
}

export interface BalanceChange {
  kind: 'edited' | 'deleted';
  at: string;
  by: string; // uid
  expenseId: string;
  description: string;
  lines: string[]; // human-readable change lines
  amountDelta: number | null; // edited: amount change; deleted: -amount
  yourImpact: number | null; // deleted only (edits don't store old shares)
}

/**
 * Money-changing edits and deletions that touched expenses an earlier
 * settle-up already covered, newest first, within `days`.
 */
export function changesSinceSettlement(
  expenses: Expense[],
  deleted: DeletedExpense[],
  settlements: Settlement[],
  opts: {uid: string; currency?: string; now?: Date; days?: number},
): BalanceChange[] {
  if (!settlements.length) {
    return [];
  }
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - (opts.days ?? 30) * 86400000).toISOString();
  const out: BalanceChange[] = [];

  expenses.forEach(exp => {
    editEntries(exp).forEach(e => {
      if (
        e.editedAt >= since &&
        isMoneyEdit(e.change) &&
        settledBetween(settlements, exp.createdAt, e.editedAt)
      ) {
        out.push({
          kind: 'edited',
          at: e.editedAt,
          by: e.editedBy,
          expenseId: exp.id || '',
          description: exp.description,
          lines: describeChange(e.change, opts.currency),
          amountDelta: amountDelta(e.change),
          yourImpact: null,
        });
      }
    });
  });

  deleted.forEach(d => {
    if (
      d.deletedAt >= since &&
      settledBetween(settlements, d.createdAt, d.deletedAt)
    ) {
      out.push({
        kind: 'deleted',
        at: d.deletedAt,
        by: d.deletedBy,
        expenseId: d.id || '',
        description: d.description,
        lines: [],
        amountDelta: -d.amount,
        yourImpact: deletionImpact(d, opts.uid),
      });
    }
  });

  return out.sort((a, b) => (a.at < b.at ? 1 : -1));
}
