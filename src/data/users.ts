// src/data/users.ts
// users/{uid} - one doc per signed-in person. PROD RULE: only ever
// merge-writes the fields listed here; never replaces the whole doc
// (groupIds and anything the admin panel adds must survive).
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from '@react-native-firebase/firestore';
import {db} from './firebase';

const userRef = (uid: string) => doc(db(), 'users', uid);

// '' when the user has no doc yet or never saved a UPI ID.
export async function getUserUpiId(uid: string): Promise<string> {
  const snap = await getDoc(userRef(uid));
  return snap.exists() ? snap.data()?.upiId || '' : '';
}

export async function setUserUpiId(uid: string, upiId: string): Promise<void> {
  await setDoc(userRef(uid), {upiId}, {merge: true});
}

export interface LoginProfileFields {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoUrl: string | null;
  defaultCurrency: string;
  appVersion: string;
  platform: string;
  osVersion: string;
  fcmToken?: string;
}

// Runs on every login / cold launch (same as the old App.jsx write).
// lastSeenAt is a server timestamp so the admin panel's "last seen" is
// trustworthy regardless of the phone's clock.
export async function upsertLoginProfile(fields: LoginProfileFields): Promise<void> {
  await setDoc(
    userRef(fields.uid),
    {...fields, lastSeenAt: serverTimestamp()},
    {merge: true},
  );
}

export async function deleteUserDoc(uid: string): Promise<void> {
  await deleteDoc(userRef(uid));
}
