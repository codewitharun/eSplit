import {
  comparisonWindows,
  periodLabels,
  computeMonthInsight,
  monthToDateTotal,
  type ShareEntry,
} from '../monthInsight';

const e = (
  amount: number,
  category: string,
  createdAt: string,
  extra: Partial<ShareEntry> = {},
): ShareEntry => ({
  amount,
  category,
  createdAt,
  currency: 'INR',
  personal: false,
  ...extra,
});

const NOW = new Date(2026, 9, 3, 18, 0); // 3 Oct 2026, 6pm local

describe('computeMonthInsight', () => {
  const entries = [
    // this month
    e(800, 'food', new Date(2026, 9, 1, 12).toISOString()),
    e(500, 'food', new Date(2026, 9, 2, 12).toISOString()),
    e(300, 'travel', new Date(2026, 9, 3, 9).toISOString()),
    // last month, same stretch (1-3 Sep) and later in Sep
    e(1000, 'food', new Date(2026, 8, 2, 12).toISOString()),
    e(5000, 'rent', new Date(2026, 8, 20).toISOString()),
    // other currency / zero share - ignored
    e(9999, 'shopping', new Date(2026, 9, 2).toISOString(), {currency: 'USD'}),
    e(0, 'shopping', new Date(2026, 9, 2).toISOString()),
  ];

  it('finds the top category and compares with the same days last month', () => {
    const r = computeMonthInsight(entries, {currency: 'INR', now: NOW})!;
    expect(r.top.key).toBe('food');
    expect(r.top.amount).toBe(1300);
    expect(r.top.icon).toBe('🍔');
    expect(r.thisMonthTotal).toBe(1600);
    expect(r.lastMonthSamePeriod).toBe(1000); // not the 5000 rent on 20 Sep
    expect(r.delta).toBe(600);
    expect(r.thisPeriodLabel).toBe('1\u20133 Oct');
    expect(r.lastPeriodLabel).toBe('1\u20133 Sep');
  });

  it('labels single days and clamps at month end', () => {
    expect(periodLabels(new Date(2026, 9, 1))).toEqual({
      thisPeriodLabel: '1 Oct',
      lastPeriodLabel: '1 Sep',
    });
    expect(periodLabels(new Date(2026, 2, 31)).lastPeriodLabel).toBe('1\u201328 Feb');
    expect(periodLabels(new Date(2026, 0, 5)).lastPeriodLabel).toBe('1\u20135 Dec');
  });

  it('needs a few expenses before saying anything', () => {
    expect(computeMonthInsight(entries.slice(0, 2), {now: NOW})).toBeNull();
  });

  it('has no comparison when last month was empty', () => {
    const r = computeMonthInsight(entries.slice(0, 3), {now: NOW})!;
    expect(r.lastMonthSamePeriod).toBeNull();
    expect(r.delta).toBeNull();
  });

  it('respects the All / Groups / Personal scope', () => {
    const mixed = [
      ...entries.slice(0, 3),
      e(2000, 'groceries', new Date(2026, 9, 2).toISOString(), {personal: true}),
    ];
    expect(computeMonthInsight(mixed, {now: NOW, scope: 'all'})!.top.key).toBe('groceries');
    expect(computeMonthInsight(mixed, {now: NOW, scope: 'groups'})!.top.key).toBe('food');
    expect(computeMonthInsight(mixed, {now: NOW, scope: 'personal', minExpenses: 1})!.thisMonthTotal).toBe(2000);
    expect(monthToDateTotal(mixed, {now: NOW, scope: 'personal'})).toBe(2000);
  });

  it('clamps the comparison window at month ends (31 Mar vs Feb)', () => {
    const w = comparisonWindows(new Date(2026, 2, 31, 10));
    // last month window runs to the end of February
    expect(w.lastEnd.getTime()).toBe(new Date(2026, 2, 1).getTime());
    const jan = comparisonWindows(new Date(2026, 0, 15));
    expect(jan.lastStart.getFullYear()).toBe(2025);
    expect(jan.lastStart.getMonth()).toBe(11);
  });
});
