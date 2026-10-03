// src/data/bootstrap.web.ts
// Must be the FIRST import in index.ts. On web there is no native config,
// so register the [DEFAULT] app with the dev project's web config before
// any module calls getApp(). RNFirebase registers the app synchronously
// (the returned promise only tracks the JS SDK finishing its setup).
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initializeApp,
  setReactNativeAsyncStorage,
} from '@react-native-firebase/app';
import {FIREBASE_WEB_CONFIG} from '../config/firebaseWeb';

// Keeps the web login across page reloads (localStorage via AsyncStorage).
setReactNativeAsyncStorage(AsyncStorage);

initializeApp(FIREBASE_WEB_CONFIG).catch(error => {
  console.error('[web] Firebase init failed', error);
});

export {};
