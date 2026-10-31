// src/config/firebaseWeb.ts
// Firebase WEB app configs. The web build is NOT for users:
// - development variant -> ezysplit-dev (Arun's quick testing)
// - production variant  -> live project, but locked to WEB_ALLOWED_EMAILS so
//   Arun can use his own account from his iPhone (my.ezysplit.techtiten.com).
//   It runs the exact same app code as Android, so every write has the same
//   shape as the phone app's.
// (Firebase web config values are public identifiers, not secrets; access is
// controlled by Firestore rules + authorized domains.)
import {IS_DEV_VARIANT} from './appEnv';

const DEV_CONFIG = {
  apiKey: 'AIzaSyCqQBZt0CEzu8bWhYmu-P651jaMmujT-vA',
  authDomain: 'ezysplit-dev.firebaseapp.com',
  projectId: 'ezysplit-dev',
  storageBucket: 'ezysplit-dev.firebasestorage.app',
  messagingSenderId: '627849069354',
  appId: '1:627849069354:web:4262ef6e28dfaf37419453',
  // RNFirebase's initializeApp requires this field even though EzySplit
  // doesn't use Realtime Database; the default URL shape is fine.
  databaseURL: 'https://ezysplit-dev-default-rtdb.firebaseio.com',
};

// Live project (esplit-d362c): Firebase console > Project settings > Your apps
// > the web app registered on 31 Oct 2026.
// authDomain = the site's own host on Vercel: public/vercel.json proxies
// /__/auth/* to Firebase, so Google sign-in stays same-origin. Safari (and the
// iPhone Home Screen app) block the cross-site storage the default
// firebaseapp.com handler needs. Needs https://<host>/__/auth/handler in the
// Google OAuth web client's Authorized redirect URIs.
const webHost = typeof window !== 'undefined' ? window.location.host : '';
const PROD_AUTH_DOMAIN = /(\.vercel\.app|\.techtiten\.com)$/.test(webHost)
  ? webHost
  : 'esplit-d362c.firebaseapp.com';

const PROD_CONFIG = {
  apiKey: 'AIzaSyBqK0EOqRyGCAix_73hOok5RfTk4p-8h7U',
  authDomain: PROD_AUTH_DOMAIN,
  projectId: 'esplit-d362c',
  storageBucket: 'esplit-d362c.firebasestorage.app',
  messagingSenderId: '564933121716',
  appId: '1:564933121716:web:912115340f49c6999ce9e1',
  databaseURL: 'https://esplit-d362c-default-rtdb.firebaseio.com',
};

export const FIREBASE_WEB_CONFIG = IS_DEV_VARIANT ? DEV_CONFIG : PROD_CONFIG;

// Who may sign in to the production web build (null = anyone, dev only).
export const WEB_ALLOWED_EMAILS: string[] | null = IS_DEV_VARIANT
  ? null
  : ['arunk4it@gmail.com'];

export const isWebEmailAllowed = (email: string | null | undefined) =>
  WEB_ALLOWED_EMAILS === null ||
  (!!email && WEB_ALLOWED_EMAILS.includes(email.trim().toLowerCase()));
