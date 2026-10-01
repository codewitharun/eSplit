import {
  itemsChanged,
  itemsSummaryTitle,
  newItemRow,
  rowsFromExpense,
  rowsToExpenseFields,
  visibleItems,
} from '../expenseItems';

describe('itemsSummaryTitle', () => {
  it('uses the first item name plus a count', () => {
    expect(itemsSummaryTitle([{name: 'Bread'}])).toBe('Bread');
    expect(itemsSummaryTitle([{name: 'Bread'}, {name: 'Milk'}])).toBe(
      'Bread + 1 item',
    );
    expect(
      itemsSummaryTitle([{name: 'Bread'}, {name: 'Milk'}, {name: 'Eggs'}]),
    ).toBe('Bread + 2 items');
  });
});

describe('visibleItems - old data safety', () => {
  it('returns null for an expense saved before this feature (no items)', () => {
    expect(visibleItems({amount: 12})).toBeNull();
  });
  it('returns null for a single item', () => {
    expect(
      visibleItems({amount: 12, items: [{name: 'Bread', price: 12}]}),
    ).toBeNull();
  });
  it('returns the items when they add up to amount', () => {
    const items = [
      {name: 'Bread', price: 12},
      {name: 'Milk', price: 30.5},
    ];
    expect(visibleItems({amount: 42.5, items})).toEqual(items);
  });
  it('ignores items an older app version left out of sync with amount', () => {
    const items = [
      {name: 'Bread', price: 12},
      {name: 'Milk', price: 30},
    ];
    expect(visibleItems({amount: 50, items})).toBeNull();
  });
});

describe('rowsToExpenseFields', () => {
  it('saves a single row in the exact pre-feature shape (no items)', () => {
    const r = rowsToExpenseFields([newItemRow('Bread', '12'), newItemRow()]);
    expect(r).toEqual({ok: true, items: [], description: 'Bread', amount: 12});
  });
  it('sums multiple rows and builds the summary title', () => {
    const r = rowsToExpenseFields([
      newItemRow('Bread', '12'),
      newItemRow('Milk', '30.25'),
      newItemRow('Eggs', '44'),
    ]);
    expect(r).toEqual({
      ok: true,
      items: [
        {name: 'Bread', price: 12},
        {name: 'Milk', price: 30.25},
        {name: 'Eggs', price: 44},
      ],
      description: 'Bread + 2 items',
      amount: 86.25,
    });
  });
  it('rejects a half-filled row instead of silently dropping it', () => {
    expect(
      rowsToExpenseFields([newItemRow('Bread', '12'), newItemRow('Milk', '')])
        .ok,
    ).toBe(false);
    expect(
      rowsToExpenseFields([newItemRow('Bread', '12'), newItemRow('', '5')]).ok,
    ).toBe(false);
  });
  it('rejects an empty form', () => {
    expect(rowsToExpenseFields([newItemRow()]).ok).toBe(false);
  });
});

describe('rowsFromExpense', () => {
  it('pre-fills one row for an old expense', () => {
    const rows = rowsFromExpense({description: 'Dinner', amount: 900});
    expect(rows.map(r => [r.name, r.price])).toEqual([['Dinner', '900']]);
  });
  it('pre-fills one row per item for a multi-item expense', () => {
    const rows = rowsFromExpense({
      description: 'Bread + 1 item',
      amount: 42,
      items: [
        {name: 'Bread', price: 12},
        {name: 'Milk', price: 30},
      ],
    });
    expect(rows.map(r => [r.name, r.price])).toEqual([
      ['Bread', '12'],
      ['Milk', '30'],
    ]);
  });
});

describe('itemsChanged', () => {
  it('detects changes', () => {
    const a = [{name: 'Bread', price: 12}];
    expect(itemsChanged(a, [{name: 'Bread', price: 12}])).toBe(false);
    expect(itemsChanged(a, [{name: 'Bread', price: 13}])).toBe(true);
    expect(itemsChanged(null, [])).toBe(false);
  });
});
