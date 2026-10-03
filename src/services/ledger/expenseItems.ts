// src/services/ledger/expenseItems.ts
// Multi-item expenses ("Bread 12, Milk 30, Eggs 44" as ONE expense).
//
// Data-safety design - read this before changing anything here:
// - `items` is a new OPTIONAL field on an expense doc. Every expense that
//   existed before this feature simply has no `items` and is rendered and
//   edited exactly as before. Nothing is migrated or backfilled.
// - `amount` stays the source of truth for ALL money math (split engine,
//   balances, debt simplifier, exports, backend ledgerMath.js). For a
//   multi-item expense it's just the sum of the item prices, so none of
//   that code needs to know items exist.
// - `description` is still written, as a summary ("Bread + 2 items"), so
//   an app version from before this feature still shows a sensible title.
// - An older app version can still edit a multi-item expense: it updates
//   `amount`/`description` but leaves `items` untouched, so the two can go
//   out of sync. visibleItems() guards against that by only trusting
//   `items` when they still add up to `amount` - otherwise the expense is
//   shown as a plain single-line expense, exactly like before.

import {EPSILON, Expense, ExpenseItem} from './types';
import {round2} from './splitEngine';

// One editable row in the add/edit form (strings, as typed).
export interface ItemRow {
  key: string;
  name: string;
  price: string;
}

let rowCounter = 0;
export function newItemRow(name = '', price = ''): ItemRow {
  rowCounter += 1;
  return {key: `item_${Date.now()}_${rowCounter}`, name, price};
}

export function parsePrice(price: string): number {
  const n = parseFloat(price);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function itemsTotal(items: {price: number}[]): number {
  return round2(items.reduce((sum, i) => sum + (i.price || 0), 0));
}

export function rowsTotal(rows: ItemRow[]): number {
  return round2(rows.reduce((sum, r) => sum + parsePrice(r.price), 0));
}

// "Bread" for one item, "Bread + 2 items" for three.
export function itemsSummaryTitle(items: {name: string}[]): string {
  if (items.length === 0) {
    return '';
  }
  const first = items[0].name.trim();
  if (items.length === 1) {
    return first;
  }
  const more = items.length - 1;
  return `${first} + ${more} item${more === 1 ? '' : 's'}`;
}

// The items to actually show for an expense, or null when it should be
// treated as a plain single-line expense: no items (every pre-existing
// expense), fewer than 2, or items that no longer add up to `amount`
// (edited by an older app version - see the header comment).
export function visibleItems(
  expense: Pick<Expense, 'items' | 'amount'>,
): ExpenseItem[] | null {
  const items = expense.items;
  if (!Array.isArray(items) || items.length < 2) {
    return null;
  }
  if (Math.abs(itemsTotal(items) - expense.amount) > EPSILON) {
    return null;
  }
  return items;
}

export type RowsResult =
  | {ok: true; items: ExpenseItem[]; description: string; amount: number}
  | {ok: false; error: string};

// Turns the form rows into what gets saved. Fully blank rows are ignored
// (someone tapped + and changed their mind); a half-filled row is an
// error rather than being silently dropped. With exactly one item, no
// `items` array is produced at all, so a single-item expense is saved in
// exactly the same shape as before this feature existed.
export function rowsToExpenseFields(rows: ItemRow[]): RowsResult {
  const filled = rows.filter(r => r.name.trim() || r.price.trim());
  if (filled.length === 0) {
    return {ok: false, error: 'Add what it was for and the amount.'};
  }
  const multi = filled.length > 1;
  for (const r of filled) {
    if (!r.name.trim()) {
      return {
        ok: false,
        error: multi
          ? 'Every item needs a name.'
          : 'What was this expense for?',
      };
    }
    if (multi && parsePrice(r.price) <= 0) {
      return {ok: false, error: `Add a price for “${r.name.trim()}”.`};
    }
  }
  if (!multi) {
    return {
      ok: true,
      items: [],
      description: filled[0].name.trim(),
      amount: parsePrice(filled[0].price),
    };
  }
  const items: ExpenseItem[] = filled.map(r => ({
    name: r.name.trim(),
    price: round2(parsePrice(r.price)),
  }));
  return {
    ok: true,
    items,
    description: itemsSummaryTitle(items),
    amount: itemsTotal(items),
  };
}

// Form rows to pre-fill when opening an existing expense for editing.
export function rowsFromExpense(
  expense: Pick<Expense, 'items' | 'amount' | 'description'>,
): ItemRow[] {
  const items = visibleItems(expense);
  if (items) {
    return items.map(i => newItemRow(i.name, String(i.price)));
  }
  return [newItemRow(expense.description, String(expense.amount))];
}

// True when two item lists differ (for the editHistory change summary).
export function itemsChanged(
  before: ExpenseItem[] | null,
  after: ExpenseItem[],
): boolean {
  const a = before || [];
  if (a.length !== after.length) {
    return true;
  }
  return a.some(
    (item, i) => item.name !== after[i].name || item.price !== after[i].price,
  );
}
