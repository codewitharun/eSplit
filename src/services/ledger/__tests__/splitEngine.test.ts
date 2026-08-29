import {computeSplits, validateSplitInput} from '../splitEngine';

describe('splitEngine', () => {
  it('splits equally and reconciles rounding across 3 people', () => {
    const splits = computeSplits(100, 'equal', ['a', 'b', 'c']);
    expect(Object.values(splits).reduce((s, v) => s + v, 0)).toBeCloseTo(
      100,
      2,
    );
    // 100 / 3 = 33.33 repeating; someone must absorb the extra paisa.
    const values = Object.values(splits).sort();
    expect(values).toEqual([33.33, 33.33, 33.34]);
  });

  it('splits exact amounts as given', () => {
    const splits = computeSplits(600, 'exact', ['a', 'b'], {
      exactAmounts: {a: 250, b: 350},
    });
    expect(splits).toEqual({a: 250, b: 350});
  });

  it('rejects exact amounts that do not add up to the total', () => {
    const check = validateSplitInput(600, 'exact', ['a', 'b'], {
      exactAmounts: {a: 250, b: 300},
    });
    expect(check.valid).toBe(false);
  });

  it('splits by percentage and reconciles to the exact total', () => {
    const splits = computeSplits(
      9600,
      'percentage',
      ['you', 'priya', 'aman', 'rahul'],
      {
        percentages: {you: 40, priya: 20, aman: 20, rahul: 20},
      },
    );
    expect(splits).toEqual({you: 3840, priya: 1920, aman: 1920, rahul: 1920});
    expect(Object.values(splits).reduce((s, v) => s + v, 0)).toBeCloseTo(
      9600,
      2,
    );
  });

  it('splits by weighted shares (e.g. a couple counts double)', () => {
    const splits = computeSplits(300, 'shares', ['couple', 'single'], {
      shares: {couple: 2, single: 1},
    });
    expect(splits).toEqual({couple: 200, single: 100});
  });

  it('rejects a zero or negative total', () => {
    const check = validateSplitInput(0, 'equal', ['a', 'b']);
    expect(check.valid).toBe(false);
  });
});
