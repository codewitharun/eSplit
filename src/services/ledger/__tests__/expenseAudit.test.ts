import {
  amountDelta,
  changesSinceSettlement,
  deletionImpact,
  describeChange,
  editBadge,
  isMoneyEdit,
  lastSettlementAt,
  predatesLastSettlement,
} from '../expenseAudit';
import type {DeletedExpense, Expense, Settlement} from '../types';

const exp = (over: Partial<Expense> = {}): Expense => ({
  id: 'e1',
  description: 'Dinner',
  amount: 900,
  currency: 'INR',
  category: 'food',
  paidBy: 'a',
  splitType: 'equal',
  shares: {a: 300, b: 300, c: 300},
  createdBy: 'a',
  createdAt: '2026-09-01T10:00:00.000Z',
  ...over,
});
const settle = (createdAt: string): Settlement => ({
  fromUid: 'b',
  toUid: 'a',
  amount: 300,
  currency: 'INR',
  createdAt,
});

describe('expenseAudit', () => {
  const settlements = [settle('2026-09-10T00:00:00.000Z')];

  it('classifies money vs cosmetic edits', () => {
    expect(isMoneyEdit('amount: Rs.900.00 -> Rs.1200.00')).toBe(true);
    expect(isMoneyEdit('description: "a" -> "b"; payer changed')).toBe(true);
    expect(isMoneyEdit('shares changed')).toBe(true);
    expect(isMoneyEdit('description: "a" -> "b"')).toBe(false);
    expect(isMoneyEdit('category: food -> travel')).toBe(false);
    expect(isMoneyEdit('Edited expense')).toBe(true); // unknown = be safe
  });

  it('badges edits, flagging money edits after a covering settle-up', () => {
    expect(editBadge(exp(), settlements)).toBe('none');
    const cosmetic = exp({
      editedAt: '2026-09-15T00:00:00.000Z',
      editHistory: [
        {editedAt: '2026-09-15T00:00:00.000Z', editedBy: 'a', change: 'category: food -> travel'},
      ],
    });
    expect(editBadge(cosmetic, settlements)).toBe('edited');
    const before = exp({
      editHistory: [
        {editedAt: '2026-09-05T00:00:00.000Z', editedBy: 'a', change: 'amount: Rs.900.00 -> Rs.1200.00'},
      ],
    });
    expect(editBadge(before, settlements)).toBe('edited'); // edited before settling
    const after = exp({
      editHistory: [
        {editedAt: '2026-09-15T00:00:00.000Z', editedBy: 'a', change: 'amount: Rs.900.00 -> Rs.1200.00'},
      ],
    });
    expect(editBadge(after, settlements)).toBe('afterSettle');
    // legacy doc: editedAt only
    expect(editBadge(exp({editedAt: '2026-09-15T00:00:00.000Z'}), settlements)).toBe('afterSettle');
  });

  it('knows whether an expense predates the last settle-up', () => {
    expect(lastSettlementAt([])).toBeNull();
    expect(predatesLastSettlement(exp(), settlements)).toBe(true);
    expect(predatesLastSettlement(exp({createdAt: '2026-09-20T00:00:00.000Z'}), settlements)).toBe(false);
    expect(predatesLastSettlement(exp(), [])).toBe(false);
  });

  it('describes changes readably in the group currency', () => {
    expect(describeChange('amount: Rs.900.00 -> Rs.1200.00; payer changed', 'INR')).toEqual([
      'Amount: ₹900.00 → ₹1200.00',
      'Payer changed',
    ]);
    expect(amountDelta('amount: Rs.900.00 -> Rs.1200.00')).toBe(300);
    expect(amountDelta('payer changed')).toBeNull();
  });

  it('computes how a deletion moves your balance', () => {
    const d = {...exp(), deletedBy: 'a', deletedAt: '2026-09-15T00:00:00.000Z'} as DeletedExpense;
    expect(deletionImpact(d, 'a')).toBe(-600); // a was owed 600, not any more
    expect(deletionImpact(d, 'b')).toBe(300); // b owed 300, not any more
  });

  it('lists post-settlement changes newest first, within the window', () => {
    const now = new Date('2026-09-20T00:00:00.000Z');
    const edited = exp({
      editHistory: [
        {editedAt: '2026-09-15T00:00:00.000Z', editedBy: 'a', change: 'amount: Rs.900.00 -> Rs.1200.00'},
        {editedAt: '2026-09-16T00:00:00.000Z', editedBy: 'a', change: 'description: "Dinner" -> "Dinner!"'},
      ],
    });
    const deleted: DeletedExpense[] = [
      {...exp({id: 'e2', description: 'Cab', amount: 300, shares: {a: 150, b: 150}}), deletedBy: 'a', deletedAt: '2026-09-18T00:00:00.000Z'} as DeletedExpense,
      // created after the settle-up -> not a "reopened" change
      {...exp({id: 'e3', createdAt: '2026-09-12T00:00:00.000Z'}), deletedBy: 'a', deletedAt: '2026-09-18T00:00:00.000Z'} as DeletedExpense,
    ];
    const out = changesSinceSettlement([edited], deleted, settlements, {uid: 'b', currency: 'INR', now});
    expect(out.map(c => c.kind)).toEqual(['deleted', 'edited']);
    expect(out[0].yourImpact).toBe(150);
    expect(out[1].amountDelta).toBe(300);
    expect(changesSinceSettlement([edited], deleted, [], {uid: 'b', now})).toEqual([]);
    expect(changesSinceSettlement([edited], deleted, settlements, {uid: 'b', now: new Date('2026-12-01T00:00:00.000Z')})).toEqual([]);
  });
});
