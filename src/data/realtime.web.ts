// src/data/realtime.web.ts - web twin of realtime.ts.
// RNFirebase on web runs the Firestore LITE SDK: no onSnapshot. For local
// web testing, poll instead and only call `next` when the data changed.
import {
  getDoc,
  getDocs,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type Query,
  type QuerySnapshot,
} from '@react-native-firebase/firestore';

const POLL_MS = 4000;

function poll<S>(
  read: () => Promise<S>,
  signature: (snap: S) => string,
  next: (snap: S) => void,
  error?: (err: Error) => void,
): () => void {
  let stopped = false;
  let last: string | null = null;
  const tick = async () => {
    try {
      const snap = await read();
      if (stopped) return;
      const sig = signature(snap);
      if (sig !== last) {
        last = sig;
        next(snap);
      }
    } catch (err) {
      if (!stopped) error?.(err as Error);
    }
  };
  tick();
  const timer = setInterval(tick, POLL_MS);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

export function listenDoc<T extends DocumentData = DocumentData>(
  ref: DocumentReference<T>,
  next: (snap: DocumentSnapshot<T>) => void,
  error?: (err: Error) => void,
): () => void {
  return poll(
    () => getDoc(ref),
    s => JSON.stringify([s.exists(), s.data() ?? null]),
    next,
    error,
  );
}

export function listenQuery<T extends DocumentData = DocumentData>(
  query: Query<T>,
  next: (snap: QuerySnapshot<T>) => void,
  error?: (err: Error) => void,
): () => void {
  return poll(
    () => getDocs(query),
    s => JSON.stringify(s.docs.map(d => [d.id, d.data()])),
    next,
    error,
  );
}
