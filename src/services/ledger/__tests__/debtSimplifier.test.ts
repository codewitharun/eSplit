import {
  computeNetBalances,
  computePairwiseLedger,
  simplifyDebts,
} from '../debtSimplifier';

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

describe('computePairwiseLedger', () => {
  it('keeps a debt chain intact instead of collapsing it like simplifyDebts', () => {
    // b paid 100 that only a owed; separately c paid 100 that only b
    // owed. a and c never shared an expense. Net balances alone would
    // let simplifyDebts skip b entirely and settle a directly with c -
    // exactly the "why do I pay someone I never split a bill with"
    // confusion users reported. The pairwise ledger must instead report
    // the two real debts as they actually happened.
    const expenses: {paidBy: string; shares: Record<string, number>}[] = [
      {paidBy: 'b', shares: {a: 100}},
      {paidBy: 'c', shares: {b: 100}},
    ];
    expect(computePairwiseLedger(expenses)).toEqual([
      {fromUid: 'a', toUid: 'b', amount: 100},
      {fromUid: 'b', toUid: 'c', amount: 100},
    ]);

    // Sanity check: simplifyDebts on the equivalent net balances DOES
    // collapse this into a single a->c transfer, confirming the two
    // algorithms genuinely disagree here rather than coincidentally
    // matching (as they do whenever there's no chain to collapse).
    const net = computeNetBalances(
      ['a', 'b', 'c'],
      [
        {paidBy: 'b', amount: 100, splits: {a: 100}},
        {paidBy: 'c', amount: 100, splits: {b: 100}},
      ],
    );
    expect(simplifyDebts(net)).toEqual([
      {fromUid: 'a', toUid: 'c', amount: 100},
    ]);
  });

  it('nets a settlement only against the specific pair it was paid against', () => {
    const expenses = [{paidBy: 'a', shares: {a: 100, b: 100}}];
    const settlements = [{fromUid: 'b', toUid: 'a', amount: 60}];
    expect(computePairwiseLedger(expenses, settlements)).toEqual([
      {fromUid: 'b', toUid: 'a', amount: 40},
    ]);
  });

  it('produces zero transfers once a pair is fully settled', () => {
    const expenses = [{paidBy: 'a', shares: {a: 100, b: 100}}];
    const settlements = [{fromUid: 'b', toUid: 'a', amount: 100}];
    expect(computePairwiseLedger(expenses, settlements)).toEqual([]);
  });

  it("ignores the payer's own share and unrelated members with no shared expense", () => {
    const expenses = [{paidBy: 'a', shares: {a: 100, b: 200, c: 200}}];
    const result = computePairwiseLedger(expenses);
    expect(result).toEqual(
      expect.arrayContaining([
        {fromUid: 'b', toUid: 'a', amount: 200},
        {fromUid: 'c', toUid: 'a', amount: 200},
      ]),
    );
    expect(result).toHaveLength(2);
  });
});
