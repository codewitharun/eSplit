import {dayLabel, expenseImpact, timeLabel} from '../activityFormat';

describe('expenseImpact', () => {
  it('lent when you paid for others', () => {
    expect(
      expenseImpact(
        {amount: 900, paidBy: 'me', shares: {me: 300, a: 600}},
        'me',
      ),
    ).toEqual({kind: 'lent', amount: 600});
  });
  it('self when you paid only for yourself', () => {
    expect(
      expenseImpact({amount: 120, paidBy: 'me', shares: {me: 120}}, 'me'),
    ).toEqual({kind: 'self', amount: 120});
  });
  it('borrowed when someone else paid and you have a share', () => {
    expect(
      expenseImpact(
        {amount: 900, paidBy: 'a', shares: {me: 300, a: 600}},
        'me',
      ),
    ).toEqual({kind: 'borrowed', amount: 300});
  });
  it('none when you are not part of it', () => {
    expect(
      expenseImpact({amount: 900, paidBy: 'a', shares: {a: 900}}, 'me'),
    ).toEqual({kind: 'none', amount: 0});
  });
});

describe('dayLabel / timeLabel', () => {
  const now = new Date(2026, 9, 2, 15);
  it('labels today, yesterday and older days', () => {
    expect(dayLabel(new Date(2026, 9, 2, 9).toISOString(), now)).toBe('Today');
    expect(dayLabel(new Date(2026, 9, 1, 23).toISOString(), now)).toBe(
      'Yesterday',
    );
    expect(dayLabel(new Date(2026, 8, 28, 10).toISOString(), now)).toBe(
      'Mon, 28 Sep',
    );
    expect(dayLabel(new Date(2025, 11, 31, 10).toISOString(), now)).toBe(
      'Wed, 31 Dec 2025',
    );
  });
  it('formats time', () => {
    expect(timeLabel(new Date(2026, 9, 2, 20, 42).toISOString())).toBe(
      '8:42 pm',
    );
    expect(timeLabel(new Date(2026, 9, 2, 0, 5).toISOString())).toBe(
      '12:05 am',
    );
  });
});
