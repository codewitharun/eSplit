// src/data/realtime.ts
// Live listeners for the data layer. Native: real Firestore onSnapshot.
// (realtime.web.ts polls instead - RNFirebase's web fallback uses the
// Firestore *lite* SDK, which has no listeners.)
import {
  onSnapshot,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type Query,
  type QuerySnapshot,
} from '@react-native-firebase/firestore';

export function listenDoc<T extends DocumentData = DocumentData>(
  ref: DocumentReference<T>,
  next: (snap: DocumentSnapshot<T>) => void,
  error?: (err: Error) => void,
): () => void {
  return onSnapshot(ref, next, err => error?.(err as unknown as Error));
}

export function listenQuery<T extends DocumentData = DocumentData>(
  query: Query<T>,
  next: (snap: QuerySnapshot<T>) => void,
  error?: (err: Error) => void,
): () => void {
  return onSnapshot(query, next, err => error?.(err as unknown as Error));
}
