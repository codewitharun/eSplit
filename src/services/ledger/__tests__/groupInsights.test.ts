import {computeGroupInsights} from '../groupInsights';

const expenses = [
  {
    amount: 1000,
    paidBy: 'me',
    shares: {me: 500, you: 500},
    category: 'food' as const,
    createdAt: new Date(2026, 9, 1).toISOString(),
  },
  {
    amount: 300,
    paidBy: 'you',
    shares: {me: 100, you: 200},
    category: 'travel' as const,
    createdAt: new Date(2026, 8, 15).toISOString(),
  },
];

describe('computeGroupInsights', () => {
  it('computes totals, share, paid and top category', () => {
    const r = computeGroupInsights(expenses, 'me', 400, new Date(2026, 9, 2));
    expect(r.totalSpent).toBe(1300);
    expect(r.myShare).toBe(600);
    expect(r.myPaid).toBe(1000);
    expect(r.myShareRatio).toBeCloseTo(600 / 1300);
    expect(r.position).toBe('owed');
    expect(r.topCategory?.key).toBe('food');
    expect(r.expenseCount).toBe(2);
    expect(r.thisMonth).toBe(1000);
    expect(r.lastMonth).toBe(300);
    expect(r.monthChange).toBeCloseTo(700 / 300);
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
    expect(empty.monthChange).toBeNull();
  });
});

describe('computeSettleUpSummary', () => {
  const {computeSettleUpSummary} = require('../groupInsights');
  it('splits what I am owed and what I owe, and settle-up progress', () => {
    const r = computeSettleUpSummary(
      [
        {fromUid: 'a', toUid: 'me', amount: 100},
        {fromUid: 'b', toUid: 'me', amount: 50},
        {fromUid: 'me', toUid: 'c', amount: 30},
        {fromUid: 'a', toUid: 'c', amount: 20},
      ],
      [{amount: 200}],
      'me',
    );
    expect(r.owedToMe).toBe(150);
    expect(r.owedToMeCount).toBe(2);
    expect(r.iOwe).toBe(30);
    expect(r.iOweCount).toBe(1);
    expect(r.outstanding).toBe(200);
    expect(r.settledRatio).toBeCloseTo(0.5);
  });
  it('treats a group with nothing outstanding as fully settled', () => {
    expect(computeSettleUpSummary([], [], 'me').settledRatio).toBe(1);
  });
});
