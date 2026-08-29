// src/services/ledger/firestoreUtils.ts
// Split out from firestoreLedger.ts so this pure helper can be unit tested
// without pulling in @react-native-firebase/firestore (which needs native
// mocks jest doesn't have configured).

export function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) {
      out[key] = obj[key];
    }
  });
  return out as T;
}
