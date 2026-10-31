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
  EmailAuthProvider,
  GoogleAuthProvider,
  deleteUser,
  linkWithCredential,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type UserCredential,
} from '@react-native-firebase/auth';
import {getApps, initializeApp as initJsApp} from 'firebase/app';
import {
  GoogleAuthProvider as JsGoogleAuthProvider,
  getAuth as getJsAuth,
  signInWithPopup,
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

// Opened from the iPhone Home Screen (no Google popup there, see passwordSignIn).
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

// Google ID token from a popup, or null if the user closed it.
async function googleIdToken(): Promise<string | null> {
  const auth = popupAuth();
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

// ── Home Screen app: email + password, all inside the app ──────────────────
// iOS opens Google's page in a Safari layer on top of a Home Screen app, and a
// login made there stays in that layer. So the Home Screen app signs in with
// email + password on a small form drawn here, never leaving the page. The
// password belongs to the same account as Google (same uid, same data): set it
// once with "Set / reset password" (Firebase emails a link).
// Needs Firebase Auth > Sign-in method > Email/Password enabled. (Don't turn
// off "Enable create" in Auth settings: that would also block new Google
// sign-ups on Android.) Only WEB_ALLOWED_EMAILS can sign in here.
type FormResult = {email: string; password: string} | 'reset' | null;

function passwordForm(message = ''): Promise<FormResult> {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.setAttribute(
      'style',
      'position:fixed;inset:0;z-index:99999;background:rgba(5,8,16,.88);display:flex;align-items:center;justify-content:center;padding:24px;font-family:Manrope-Regular,system-ui,sans-serif',
    );
    const field =
      'width:100%;box-sizing:border-box;padding:14px 16px;border-radius:14px;border:1px solid #2a3348;background:#0f1626;color:#fff;font-size:16px;margin-top:10px';
    wrap.innerHTML = `
      <form style="width:100%;max-width:380px;background:#141b2d;border:1px solid #2a3348;border-radius:22px;padding:22px;color:#fff">
        <div style="font-family:Sora-Bold,system-ui;font-size:20px">Sign in</div>
        <div style="color:#9aa4b8;font-size:14px;margin-top:6px">Same account as Google, with your EzySplit password.</div>
        <div data-msg style="color:#f0819c;font-size:14px;margin-top:10px;${message ? '' : 'display:none'}"></div>
        <input name="email" type="email" autocomplete="username" placeholder="Email" style="${field}" />
        <input name="password" type="password" autocomplete="current-password" placeholder="Password" style="${field}" />
        <button type="submit" style="width:100%;margin-top:16px;padding:14px;border:0;border-radius:999px;background:linear-gradient(90deg,#1f8fbf,#3fd6c2);color:#04121a;font-size:16px;font-family:Manrope-Bold,system-ui">Sign in</button>
        <div style="display:flex;justify-content:space-between;margin-top:14px">
          <button type="button" data-reset style="background:none;border:0;color:#5cc8e6;font-size:14px;padding:4px">Set / reset password</button>
          <button type="button" data-cancel style="background:none;border:0;color:#9aa4b8;font-size:14px;padding:4px">Cancel</button>
        </div>
      </form>`;
    document.body.appendChild(wrap);
    const form = wrap.querySelector('form') as HTMLFormElement;
    const email = form.elements.namedItem('email') as HTMLInputElement;
    const password = form.elements.namedItem('password') as HTMLInputElement;
    (wrap.querySelector('[data-msg]') as HTMLElement).textContent = message;
    email.value = WEB_ALLOWED_EMAILS?.[0] ?? '';
    const done = (r: FormResult) => {
      wrap.remove();
      resolve(r);
    };
    form.addEventListener('submit', e => {
      e.preventDefault();
      done({email: email.value.trim().toLowerCase(), password: password.value});
    });
    (wrap.querySelector('[data-reset]') as HTMLElement).onclick = () => done('reset');
    (wrap.querySelector('[data-cancel]') as HTMLElement).onclick = () => done(null);
    setTimeout(() => (email.value ? password : email).focus(), 50);
  });
}

async function passwordSignIn(): Promise<UserCredential | null> {
  let message = '';
  for (;;) {
    const r = await passwordForm(message);
    if (r === null) {
      return null;
    }
    const email = WEB_ALLOWED_EMAILS?.[0] ?? '';
    if (r === 'reset') {
      try {
        await sendPasswordResetEmail(firebaseAuth(), email);
        message = `We emailed ${email} a link to set your password. Set it, then come back and sign in.`;
      } catch (error: any) {
        message = error?.message ?? 'Could not send the email. Try again.';
      }
      continue;
    }
    if (!isWebEmailAllowed(r.email)) {
      message = NOT_ALLOWED;
      continue;
    }
    try {
      return await signInWithEmailAndPassword(firebaseAuth(), r.email, r.password);
    } catch (error: any) {
      message =
        error?.code === 'auth/too-many-requests'
          ? 'Too many tries. Wait a few minutes.'
          : 'Wrong email or password. No password yet? Tap "Set / reset password".';
    }
  }
}

export async function onGoogleButtonPress(): Promise<UserCredential | null> {
  if (isStandalone()) {
    return passwordSignIn();
  }
  const idToken = await googleIdToken();
  if (!idToken) {
    return null;
  }
  const cred = await signInWithCredential(
    firebaseAuth(),
    GoogleAuthProvider.credential(idToken),
  );
  await offerHomeScreenPassword(cred);
  return cred;
}

// Safari tab, right after Google sign-in: if this account has no password yet,
// offer to add one (linked to the SAME account) for the Home Screen app.
// Firebase won't create a second email/password account for an email Google
// already owns, so linking while signed in is the way to add it.
async function offerHomeScreenPassword(cred: UserCredential): Promise<void> {
  const user = cred.user;
  if (WEB_ALLOWED_EMAILS === null || !user.email) {
    return;
  }
  if (user.providerData.some(p => p.providerId === 'password')) {
    return;
  }
  let message = '';
  for (;;) {
    const pw = await setPasswordForm(message);
    if (pw === null) {
      return;
    }
    try {
      await linkWithCredential(user, EmailAuthProvider.credential(user.email, pw));
      window.alert('Password saved. Use it in the Home Screen app.');
      return;
    } catch (error: any) {
      message =
        error?.code === 'auth/weak-password'
          ? 'Use at least 6 characters.'
          : error?.code === 'auth/provider-already-linked' ||
            error?.code === 'auth/credential-already-in-use'
          ? 'A password is already set. Use "Set / reset password" in the Home Screen app to change it.'
          : error?.message ?? 'Could not save the password. Try again.';
      if (/already/.test(message)) {
        window.alert(message);
        return;
      }
    }
  }
}

function setPasswordForm(message: string): Promise<string | null> {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.setAttribute(
      'style',
      'position:fixed;inset:0;z-index:99999;background:rgba(5,8,16,.88);display:flex;align-items:center;justify-content:center;padding:24px;font-family:Manrope-Regular,system-ui,sans-serif',
    );
    const field =
      'width:100%;box-sizing:border-box;padding:14px 16px;border-radius:14px;border:1px solid #2a3348;background:#0f1626;color:#fff;font-size:16px;margin-top:10px';
    wrap.innerHTML = `
      <form style="width:100%;max-width:380px;background:#141b2d;border:1px solid #2a3348;border-radius:22px;padding:22px;color:#fff">
        <div style="font-family:Sora-Bold,system-ui;font-size:20px">Password for the Home Screen app</div>
        <div style="color:#9aa4b8;font-size:14px;margin-top:6px">The iPhone Home Screen app can't use Google sign-in. Set a password for this same account to use there.</div>
        <div data-msg style="color:#f0819c;font-size:14px;margin-top:10px"></div>
        <input name="email" type="email" autocomplete="username" readonly style="${field};opacity:.7" />
        <input name="pw" type="password" autocomplete="new-password" placeholder="New password (6+ characters)" style="${field}" />
        <input name="pw2" type="password" autocomplete="new-password" placeholder="Repeat password" style="${field}" />
        <button type="submit" style="width:100%;margin-top:16px;padding:14px;border:0;border-radius:999px;background:linear-gradient(90deg,#1f8fbf,#3fd6c2);color:#04121a;font-size:16px;font-family:Manrope-Bold,system-ui">Save password</button>
        <button type="button" data-cancel style="width:100%;margin-top:10px;background:none;border:0;color:#9aa4b8;font-size:14px;padding:6px">Not now</button>
      </form>`;
    document.body.appendChild(wrap);
    const form = wrap.querySelector('form') as HTMLFormElement;
    const msg = wrap.querySelector('[data-msg]') as HTMLElement;
    msg.textContent = message;
    (form.elements.namedItem('email') as HTMLInputElement).value = WEB_ALLOWED_EMAILS?.[0] ?? '';
    const pw = form.elements.namedItem('pw') as HTMLInputElement;
    const pw2 = form.elements.namedItem('pw2') as HTMLInputElement;
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (pw.value !== pw2.value) {
        msg.textContent = "Passwords don't match.";
        return;
      }
      wrap.remove();
      resolve(pw.value);
    });
    (wrap.querySelector('[data-cancel]') as HTMLElement).onclick = () => {
      wrap.remove();
      resolve(null);
    };
    setTimeout(() => pw.focus(), 50);
  });
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
