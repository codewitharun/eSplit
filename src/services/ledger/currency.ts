// src/services/ledger/currency.ts
// Single source of truth for "what does this currency look like" and
// "does this currency have a one-tap settle rail". Every screen that used
// to hardcode the ₹ symbol goes through here instead.
//
// The symbol table below is derived from the same curated country data
// (src/data/countries.ts) that backs the group-creation country picker,
// so any of the 247 countries a user can pick from renders its real
// currency symbol here too - not just the original 8-currency shortlist
// this file used to hardcode.
//
// UPI only exists as a payment rail in India - every currency other than
// INR settles manually (see Balances.tsx's handleSettlePress), since
// there's no single equivalent one-tap deep link that works the same way
// across all of these.

import {COUNTRIES} from '../../data/countries';

export const DEFAULT_CURRENCY = 'INR';

// Built by walking the country list in order and keeping the first symbol
// seen per ISO 4217 code (India is first, so INR resolves to '₹' as
// before; every other currency resolves to whichever country using it
// happens to come first alphabetically - the symbol itself doesn't vary
// by country, only which country "owns" a shared currency like EUR does).
const SYMBOL_BY_CODE: Record<string, string> = {};
for (const c of COUNTRIES) {
  if (!(c.currency in SYMBOL_BY_CODE)) {
    SYMBOL_BY_CODE[c.currency] = c.symbol;
  }
}

// A handful of currencies share a bare "$" (or other overloaded glyph) in
// the raw country data - fine next to a country name in the picker, but
// ambiguous on its own in an amount like "$12.50". These four already
// shipped with a disambiguated symbol before the country-data switch, so
// they're pinned here to avoid changing what existing users see.
const SYMBOL_OVERRIDES: Record<string, string> = {
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$',
  AED: 'AED',
};
Object.assign(SYMBOL_BY_CODE, SYMBOL_OVERRIDES);

// Falls back to the raw code (e.g. "XYZ") for anything not in the table
// above, rather than silently mislabeling an unrecognized currency as ₹.
export function currencySymbol(code?: string | null): string {
  if (!code) {
    return SYMBOL_BY_CODE[DEFAULT_CURRENCY];
  }
  return SYMBOL_BY_CODE[code] ?? code;
}

// Symbols that are pure glyphs (₹, $, €, £, ¥, A$, C$...) read better with
// no space before the number; symbols that are letter-based abbreviations
// (AED, kr, Fr, DH...) read better with one. A$/C$/S$ are the one case
// that's two letters *and* a glyph, so they're carved out explicitly.
function needsSpace(symbol: string): boolean {
  if (symbol.length > 2) {
    return true;
  }
  if (symbol.length === 2 && /^[A-Za-z]{2}$/.test(symbol)) {
    return true;
  }
  return false;
}

export function formatMoney(
  amount: number,
  code?: string | null,
  decimals: number = 2,
): string {
  const symbol = currencySymbol(code);
  const sep = needsSpace(symbol) ? ' ' : '';
  return `${symbol}${sep}${amount.toFixed(decimals)}`;
}

export function isUpiCurrency(code?: string | null): boolean {
  return (code || DEFAULT_CURRENCY) === 'INR';
}
