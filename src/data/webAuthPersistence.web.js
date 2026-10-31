// src/data/webAuthPersistence.web.js - web build only (wired in metro.config.js).
//
// Stands in for @react-native-firebase/app's internal web firebaseAuth module,
// which is just `export * from 'firebase/app'` + `export * from 'firebase/auth'`.
// The one change: RNFirebase calls initializeAuth(app, {}) on web, and with no
// persistence the Firebase JS SDK keeps the login in memory only, so every
// reload or reopen logged Arun out. Here initializeAuth gets IndexedDB/
// localStorage persistence (what getAuth() uses by default), so the login is
// saved like on the phone.
import {
  browserLocalPersistence,
  indexedDBLocalPersistence,
  initializeAuth as baseInitializeAuth,
} from 'firebase/auth';

export * from 'firebase/app';
export * from 'firebase/auth';

export function initializeAuth(app, deps) {
  return baseInitializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    ...(deps || {}),
  });
}
