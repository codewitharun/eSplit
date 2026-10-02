// src/data/firebase.ts
// THE DATA LAYER RULE: only files in src/data/ may import
// @react-native-firebase/{auth,firestore,messaging}. Screens, hooks and
// stores call the functions exported from src/data/* instead. If EzySplit
// ever moves off Firebase (or moves a write behind the backend), only this
// folder changes.
//
// PROD RULE: same collections, same field names, same write shapes as the
// old CLI app - both app versions share one live Firestore database.
import {getApp} from '@react-native-firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  type User,
} from '@react-native-firebase/auth';
import {getFirestore} from '@react-native-firebase/firestore';

export type AuthUser = User;

export const db = () => getFirestore(getApp());
export const firebaseAuth = () => getAuth(getApp());

export function currentUser(): AuthUser | null {
  return firebaseAuth().currentUser;
}

export function currentUid(): string | null {
  return firebaseAuth().currentUser?.uid ?? null;
}

export function subscribeAuth(cb: (user: AuthUser | null) => void): () => void {
  return onAuthStateChanged(firebaseAuth(), cb);
}

// Firebase ID token for authenticating calls to esplit-backend.
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const user = currentUser();
  return user ? user.getIdToken(forceRefresh) : null;
}
