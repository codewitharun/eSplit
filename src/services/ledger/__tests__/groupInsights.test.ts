import {computeGroupInsights} from '../groupInsights';

const expenses = [
  {
    amount: 1000,
    paidBy: 'me',
    shares: {me: 500, you: 500},
    category: 'food' as const,
  },
  {
    amount: 300,
    paidBy: 'you',
    shares: {me: 100, you: 200},
    category: 'travel' as const,
  },
];

describe('computeGroupInsights', () => {
  it('computes totals, share, paid and top category', () => {
    const r = computeGroupInsights(expenses, 'me', 400);
    expect(r.totalSpent).toBe(1300);
    expect(r.myShare).toBe(600);
    expect(r.myPaid).toBe(1000);
    expect(r.myShareRatio).toBeCloseTo(600 / 1300);
    expect(r.position).toBe('owed');
    expect(r.topCategory?.key).toBe('food');
    expect(r.expenseCount).toBe(2);
  });
  it('handles owes, settled and an empty group', () => {
    expect(computeGroupInsights(expenses, 'you', -400).position).toBe('owes');
    expect(computeGroupInsights(expenses, 'me', 0.004).position).toBe(
      'settled',
    );
    const empty = computeGroupInsights([], 'me', 0);
    expect(empty.totalSpent).toBe(0);
    expect(empty.myShareRatio).toBe(0);
    expect(empty.topCategory).toBeNull();
  });
});
