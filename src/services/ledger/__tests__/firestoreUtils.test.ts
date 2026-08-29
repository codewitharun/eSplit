import {stripUndefined} from '../firestoreUtils';

describe('stripUndefined', () => {
  it('drops keys whose value is undefined', () => {
    const input = {
      description: 'Lunch',
      amount: 500,
      splitParams: undefined,
      category: 'food',
    };
    expect(stripUndefined(input)).toEqual({
      description: 'Lunch',
      amount: 500,
      category: 'food',
    });
    expect('splitParams' in stripUndefined(input)).toBe(false);
  });

  it('keeps falsy-but-defined values (0, "", false)', () => {
    const input = {amount: 0, note: '', isRecurring: false};
    expect(stripUndefined(input)).toEqual({
      amount: 0,
      note: '',
      isRecurring: false,
    });
  });

  it('this is exactly the shape addExpense() builds for the common equal-split case', () => {
    // Regression test for the real bug report: adding a plain equal-split
    // expense (no recurrence) left `splitParams` and `recurrenceIntervalDays`
    // set to literal `undefined`, which @react-native-firebase/firestore
    // rejects with "Unsupported field value: undefined".
    const expenseLikeEqualSplit = {
      description: 'Dinner',
      amount: 900,
      currency: 'INR',
      category: 'food',
      paidBy: 'uid1',
      splitType: 'equal',
      splitParams: undefined,
      shares: {uid1: 300, uid2: 300, uid3: 300},
      isRecurring: false,
      recurrenceIntervalDays: undefined,
      createdBy: 'uid1',
      createdAt: new Date().toISOString(),
    };
    const cleaned = stripUndefined(expenseLikeEqualSplit);
    expect(Object.values(cleaned).some(v => v === undefined)).toBe(false);
    expect('splitParams' in cleaned).toBe(false);
    expect('recurrenceIntervalDays' in cleaned).toBe(false);
  });
});
