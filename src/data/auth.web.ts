// src/data/auth.web.ts - web twin of auth.ts (dev Firebase project only).
//
// Native Google Sign-In doesn't exist on web, so: open Google's popup with
// the plain Firebase JS SDK on a throwaway secondary app, take the Google ID
// token from the result, and sign in to the app's REAL auth (RNFirebase's
// web layer) with it via signInWithCredential - the same final call the
// native flow makes. Requires `localhost` in Firebase Auth's authorized
// domains (it is by default).
import {
  GoogleAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  signInWithCredential,
  signOut as firebaseSignOut,
  type UserCredential,
} from '@react-native-firebase/auth';
import {getApps, initializeApp as initJsApp} from 'firebase/app';
import {
  GoogleAuthProvider as JsGoogleAuthProvider,
  getAuth as getJsAuth,
  signInWithPopup,
  signOut as jsSignOut,
} from 'firebase/auth';
import {FIREBASE_WEB_CONFIG} from '../config/firebaseWeb';
import {useAuthStore} from '../store/useAuthStore';
import {currentUser, firebaseAuth} from './firebase';
import {deleteUserDoc} from './users';

const POPUP_APP = 'ezysplit-web-popup';

function popupAuth() {
  const app =
    getApps().find(a => a.name === POPUP_APP) ??
    initJsApp(FIREBASE_WEB_CONFIG, POPUP_APP);
  return getJsAuth(app);
}

// Google ID token from a popup, or null if the user closed it.
async function googleIdToken(): Promise<string | null> {
  const auth = popupAuth();
  try {
    const provider = new JsGoogleAuthProvider();
    provider.setCustomParameters({prompt: 'select_account'});
    const result = await signInWithPopup(auth, provider);
    return JsGoogleAuthProvider.credentialFromResult(result)?.idToken ?? null;
  } catch (error: any) {
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request'
    ) {
      return null;
    }
    throw error;
  } finally {
    jsSignOut(auth).catch(() => {});
  }
}

export async function onGoogleButtonPress(): Promise<UserCredential | null> {
  const idToken = await googleIdToken();
  if (!idToken) {
    return null;
  }
  return signInWithCredential(
    firebaseAuth(),
    GoogleAuthProvider.credential(idToken),
  );
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(firebaseAuth());
  useAuthStore.getState().setUser(null);
}

export async function deleteAccount(): Promise<void> {
  const user = currentUser();
  if (!user) {
    throw new Error('You are not signed in.');
  }
  await deleteUserDoc(user.uid);
  try {
    await deleteUser(user);
  } catch (error: any) {
    if (error?.code !== 'auth/requires-recent-login') {
      throw error;
    }
    const idToken = await googleIdToken();
    if (!idToken) {
      throw new Error('Please sign in again to delete your account.');
    }
    await reauthenticateWithCredential(
      user,
      GoogleAuthProvider.credential(idToken),
    );
    await deleteUser(user);
  }
  useAuthStore.getState().setUser(null);
}
