// src/services/ledger/upi.ts
// Builds a `upi://pay` deep link so "settle up" can hand off straight to
// whatever UPI app (GPay/PhonePe/Paytm) the person already has installed.
// Requires the payee to have set a UPI VPA in their profile - if they
// haven't, there's nothing safe to deep-link to, so callers should fall
// back to just recording the settlement without opening an app.

export interface UpiPayParams {
  payeeVpa: string; // e.g. "arun@okhdfcbank"
  payeeName: string;
  amount: number;
  note?: string;
  transactionRefId?: string;
}

export function buildUpiPayUri({
  payeeVpa,
  payeeName,
  amount,
  note,
  transactionRefId,
}: UpiPayParams): string | null {
  if (!payeeVpa || !payeeVpa.includes('@')) {
    return null;
  }
  // Hermes only implements a subset of the URLSearchParams spec - the
  // constructor-from-object form works, but `.set()` throws
  // "URLSearchParams.set is not implemented" at runtime (only catchable on
  // a real device/JS engine, not from a type check). Building the query
  // string by hand sidesteps the whole API instead of depending on which
  // methods this Hermes version happens to support.
  const pairs: Array<[string, string]> = [
    ['pa', payeeVpa],
    ['pn', payeeName || 'EzySplit'],
    ['am', amount.toFixed(2)],
    ['cu', 'INR'],
  ];
  if (note) {
    pairs.push(['tn', note]);
  }
  if (transactionRefId) {
    pairs.push(['tr', transactionRefId]);
  }
  const query = pairs
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  return `upi://pay?${query}`;
}

const VPA_PATTERN = /^[\w.+-]{2,256}@[A-Za-z]{2,64}$/;

export function isValidUpiVpa(vpa: string): boolean {
  return VPA_PATTERN.test(vpa.trim());
}
