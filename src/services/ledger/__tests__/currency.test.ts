import {currencySymbol, formatMoney, isUpiCurrency} from '../currency';

describe('currency helper', () => {
  it("formats INR without a space, matching the app's existing look", () => {
    expect(formatMoney(450, 'INR')).toBe('₹450.00');
  });

  it('formats other short symbols without a space', () => {
    expect(formatMoney(12.5, 'USD')).toBe('$12.50');
    expect(formatMoney(12.5, 'EUR')).toBe('€12.50');
    expect(formatMoney(12.5, 'GBP')).toBe('£12.50');
    expect(formatMoney(12.5, 'AUD')).toBe('A$12.50');
  });

  it('puts a space before longer, letter-based symbols', () => {
    expect(formatMoney(100, 'AED')).toBe('AED 100.00');
  });

  it('falls back to the raw ISO code for an unrecognized currency', () => {
    expect(currencySymbol('XYZ')).toBe('XYZ');
  });

  it('defaults to INR when no currency is given', () => {
    expect(currencySymbol(undefined)).toBe('₹');
    expect(currencySymbol(null)).toBe('₹');
  });

  it('treats only INR as a UPI-capable currency', () => {
    expect(isUpiCurrency('INR')).toBe(true);
    expect(isUpiCurrency(undefined)).toBe(true); // legacy groups with no currency set
    expect(isUpiCurrency('USD')).toBe(false);
    expect(isUpiCurrency('EUR')).toBe(false);
  });

  // These currencies only became selectable once the group-creation picker
  // switched from an 8-currency shortlist to the full country dropdown
  // (src/data/countries.ts) - covering them here locks in that the new
  // data source resolves to sensible symbols, not just the original 8.
  it('resolves symbols for currencies added by the country dropdown', () => {
    expect(formatMoney(1000, 'JPY')).toBe('¥1000.00');
    expect(formatMoney(50, 'CNY')).toBe('¥50.00');
    expect(formatMoney(20, 'KRW')).toBe('₩20.00');
  });

  it('keeps the pre-existing disambiguated symbols for currencies that would otherwise collide on a bare "$"', () => {
    // CAD/SGD share a plain "$" with USD/AUD/many others in the raw
    // country data; these were already shown disambiguated before the
    // country-data switch and must stay that way.
    expect(formatMoney(12.5, 'CAD')).toBe('C$12.50');
    expect(formatMoney(12.5, 'SGD')).toBe('S$12.50');
  });

  it('adds a space for two-letter alphabetic symbols like Nordic kroner', () => {
    expect(formatMoney(100, 'NOK')).toBe('kr 100.00');
    expect(formatMoney(100, 'DKK')).toBe('kr 100.00');
  });
});
