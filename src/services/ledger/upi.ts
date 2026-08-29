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
  const params = new URLSearchParams({
    pa: payeeVpa,
    pn: payeeName || 'EzySplit',
    am: amount.toFixed(2),
    cu: 'INR',
  });
  if (note) {
    params.set('tn', note);
  }
  if (transactionRefId) {
    params.set('tr', transactionRefId);
  }
  return `upi://pay?${params.toString()}`;
}

const VPA_PATTERN = /^[\w.+-]{2,256}@[A-Za-z]{2,64}$/;

export function isValidUpiVpa(vpa: string): boolean {
  return VPA_PATTERN.test(vpa.trim());
}
