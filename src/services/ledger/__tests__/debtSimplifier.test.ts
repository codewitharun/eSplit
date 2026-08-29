import {computeNetBalances, simplifyDebts} from '../debtSimplifier';

describe('debtSimplifier', () => {
  it('nets balances across several expenses to zero-sum', () => {
    const net = computeNetBalances(
      ['rahul', 'priya', 'aman'],
      [
        {
          paidBy: 'rahul',
          amount: 900,
          splits: {rahul: 300, priya: 300, aman: 300},
        },
        {
          paidBy: 'priya',
          amount: 750,
          splits: {rahul: 250, priya: 250, aman: 250},
        },
      ],
    );
    const total = Object.values(net).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(0, 2);
  });

  it('collapses three pairwise IOUs into the minimum transfers', () => {
    // Mirrors the roadmap's worked example: after netting, Priya is
    // zero, and Rahul->Aman is the one transfer that clears the group.
    const net = {rahul: -550, priya: 0, aman: 550};
    const transfers = simplifyDebts(net);
    expect(transfers).toEqual([{fromUid: 'rahul', toUid: 'aman', amount: 550}]);
  });

  it('settlements reduce what a debtor still owes', () => {
    const net = computeNetBalances(
      ['a', 'b'],
      [{paidBy: 'a', amount: 200, splits: {a: 100, b: 100}}],
      [{fromUid: 'b', toUid: 'a', amount: 60}],
    );
    // b owed 100, paid back 60, so still owes 40; a is owed 40.
    expect(net.b).toBeCloseTo(-40, 2);
    expect(net.a).toBeCloseTo(40, 2);
    expect(simplifyDebts(net)).toEqual([
      {fromUid: 'b', toUid: 'a', amount: 40},
    ]);
  });

  it('produces zero transfers once everyone is settled', () => {
    expect(simplifyDebts({a: 0, b: 0, c: 0})).toEqual([]);
  });
});
