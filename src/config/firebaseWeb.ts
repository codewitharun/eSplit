// src/config/firebaseWeb.ts
// Firebase WEB app config - DEV project (ezysplit-dev) on purpose: the web
// build exists only for Arun's own quick testing and must never touch prod
// data. (Firebase web config values are public identifiers, not secrets;
// access is controlled by Firestore rules + authorized domains.)
export const FIREBASE_WEB_CONFIG = {
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
