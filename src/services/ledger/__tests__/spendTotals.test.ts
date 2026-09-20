import {
  mergeCurrencyTotals,
  sumAmountsByCurrency,
  sumSharesByCurrency,
} from '../spendTotals';

describe('sumSharesByCurrency', () => {
  it("sums only the given uid's share, not the whole expense amount", () => {
    const expenses = [
      {currency: 'INR', amount: 400, shares: {alice: 200, bob: 200}},
      {currency: 'INR', amount: 300, shares: {alice: 150, bob: 150}},
    ];
    expect(sumSharesByCurrency(expenses, 'alice')).toEqual({INR: 350});
  });

  it('buckets by currency instead of adding them together', () => {
    const expenses = [
      {currency: 'INR', shares: {alice: 100}},
      {currency: 'USD', shares: {alice: 20}},
    ];
    expect(sumSharesByCurrency(expenses, 'alice')).toEqual({
      INR: 100,
      USD: 20,
    });
  });

  it('defaults an expense with no currency field to INR', () => {
    const expenses = [{shares: {alice: 50}}];
    expect(sumSharesByCurrency(expenses, 'alice')).toEqual({INR: 50});
  });

  it("skips expenses the uid has no share in (they weren't a participant)", () => {
    const expenses = [{currency: 'INR', shares: {bob: 100}}];
    expect(sumSharesByCurrency(expenses, 'alice')).toEqual({});
  });

  it('returns an empty object for a user with no group expenses at all', () => {
    expect(sumSharesByCurrency([], 'alice')).toEqual({});
  });
});

describe('sumAmountsByCurrency', () => {
  it('sums plain amounts per currency, no split to account for', () => {
    const items = [
      {currency: 'INR', amount: 100},
      {currency: 'INR', amount: 250},
      {currency: 'USD', amount: 12},
    ];
    expect(sumAmountsByCurrency(items)).toEqual({INR: 350, USD: 12});
  });

  it('defaults to INR when currency is missing', () => {
    expect(sumAmountsByCurrency([{amount: 40}])).toEqual({INR: 40});
  });

  it('returns an empty object for a user with zero personal expenses', () => {
    expect(sumAmountsByCurrency([])).toEqual({});
  });
});

describe('mergeCurrencyTotals', () => {
  it('sums matching currency codes across maps', () => {
    expect(mergeCurrencyTotals({INR: 100}, {INR: 50, USD: 10})).toEqual({
      INR: 150,
      USD: 10,
    });
  });

  it('never adds two different currencies together', () => {
    const merged = mergeCurrencyTotals({INR: 500}, {USD: 20});
    expect(merged.INR).toBe(500);
    expect(merged.USD).toBe(20);
  });

  it('handles any number of maps, not just two', () => {
    expect(mergeCurrencyTotals({INR: 1}, {INR: 2}, {INR: 3}, {})).toEqual({
      INR: 6,
    });
  });

  // Explicit zero-risk regression check (PERSONAL_EXPENSE_PLAN.md section
  // 3): a user who has never touched the Personal Expense feature has an
  // empty personalExpenses collection, so personalSpendByCurrency is {}.
  // Merging that empty map into the existing group-share total must be a
  // complete no-op - the combined "All" total has to equal today's
  // existing group-only total exactly, for every currency, or this
  // feature would be silently changing a number every existing user
  // already relies on.
  it('merging in an empty personal total leaves the group total completely unchanged (zero-personal-expense regression)', () => {
    const existingGroupSpend = {INR: 12345.67, USD: 89.5};
    const noPersonalExpensesYet = {};
    expect(
      mergeCurrencyTotals(existingGroupSpend, noPersonalExpensesYet),
    ).toEqual(existingGroupSpend);
  });
});
