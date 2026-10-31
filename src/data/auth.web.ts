// src/data/auth.web.ts - web twin of auth.ts.
// Production web build: only WEB_ALLOWED_EMAILS can sign in (checked on the
// popup result, BEFORE the real sign-in, so no one else even gets an account
// or a users/{uid} doc), and account deletion is disabled.
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
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signOut as jsSignOut,
  type UserCredential as JsUserCredential,
} from 'firebase/auth';
import {FIREBASE_WEB_CONFIG, WEB_ALLOWED_EMAILS, isWebEmailAllowed} from '../config/firebaseWeb';
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

const NOT_ALLOWED =
  'This web version of EzySplit is private. Please use the Android app.';

// Opened from the iPhone Home Screen: popups can't report back there, so the
// Google page opens in the same window (redirect) and we finish on return.
const isStandalone = () =>
  typeof window !== 'undefined' &&
  ((navigator as {standalone?: boolean}).standalone === true ||
    !!window.matchMedia?.('(display-mode: standalone)').matches);

const googleProvider = () => {
  const provider = new JsGoogleAuthProvider();
  provider.setCustomParameters({prompt: 'select_account'});
  return provider;
};

// Email check + the Google ID token, from a popup or redirect result.
function idTokenFrom(result: JsUserCredential): string | null {
  if (!isWebEmailAllowed(result.user.email)) {
    throw new Error(NOT_ALLOWED);
  }
  return JsGoogleAuthProvider.credentialFromResult(result)?.idToken ?? null;
}

// Back from the Google redirect (Home Screen app): sign in to the real auth.
async function finishRedirectSignIn(): Promise<void> {
  const auth = popupAuth();
  try {
    const result = await getRedirectResult(auth);
    if (!result) {
      return;
    }
    const idToken = idTokenFrom(result);
    if (idToken) {
      await signInWithCredential(
        firebaseAuth(),
        GoogleAuthProvider.credential(idToken),
      );
    }
  } catch (error: any) {
    console.error('[web] Google redirect sign-in failed', error);
    if (error?.message === NOT_ALLOWED && typeof window !== 'undefined') {
      window.alert(NOT_ALLOWED);
    }
  } finally {
    jsSignOut(auth).catch(() => {});
  }
}
if (typeof window !== 'undefined') {
  finishRedirectSignIn();
}

// Google ID token from a popup, or null if the user closed it.
async function googleIdToken(): Promise<string | null> {
  const auth = popupAuth();
  if (isStandalone()) {
    await signInWithRedirect(auth, googleProvider());
    return new Promise<null>(() => {}); // the page navigates to Google
  }
  try {
    const result = await signInWithPopup(auth, googleProvider());
    return idTokenFrom(result);
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
  if (WEB_ALLOWED_EMAILS !== null) {
    throw new Error('Delete your account from the Android app.');
  }
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
