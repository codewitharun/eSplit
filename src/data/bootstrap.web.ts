// src/data/bootstrap.web.ts
// Must be the FIRST import in index.ts. On web there is no native config,
// so register the [DEFAULT] app with the web config (dev or prod, see
// src/config/firebaseWeb.ts) before
// any module calls getApp(). RNFirebase registers the app synchronously
// (the returned promise only tracks the JS SDK finishing its setup).
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initializeApp,
  setReactNativeAsyncStorage,
} from '@react-native-firebase/app';
import {FIREBASE_WEB_CONFIG} from '../config/firebaseWeb';
import * as Font from 'expo-font';

// Native builds embed the fonts at build time (expo-font plugin in
// app.config.ts); the browser has to load them. Same names as the .ttf files
// (src/utils/fonts.tsx uses them as fontFamily). Text shows in a fallback
// font for a moment, then swaps.
const FONT_NAMES = [
  'JetBrainsMono-Medium',
  'Manrope-Bold',
  'Manrope-ExtraBold',
  'Manrope-Medium',
  'Manrope-Regular',
  'Manrope-SemiBold',
  'Sora-Bold',
  'Sora-ExtraBold',
  'Sora-Regular',
  'Sora-SemiBold',
] as const;
const FONT_FILES: Record<(typeof FONT_NAMES)[number], number> = {
  'JetBrainsMono-Medium': require('../assets/fonts/JetBrainsMono-Medium.ttf'),
  'Manrope-Bold': require('../assets/fonts/Manrope-Bold.ttf'),
  'Manrope-ExtraBold': require('../assets/fonts/Manrope-ExtraBold.ttf'),
  'Manrope-Medium': require('../assets/fonts/Manrope-Medium.ttf'),
  'Manrope-Regular': require('../assets/fonts/Manrope-Regular.ttf'),
  'Manrope-SemiBold': require('../assets/fonts/Manrope-SemiBold.ttf'),
  'Sora-Bold': require('../assets/fonts/Sora-Bold.ttf'),
  'Sora-ExtraBold': require('../assets/fonts/Sora-ExtraBold.ttf'),
  'Sora-Regular': require('../assets/fonts/Sora-Regular.ttf'),
  'Sora-SemiBold': require('../assets/fonts/Sora-SemiBold.ttf'),
};
Font.loadAsync(FONT_FILES).catch(error => {
  console.error('[web] Font loading failed', error);
});

// Keeps the web login across page reloads (localStorage via AsyncStorage).
setReactNativeAsyncStorage(AsyncStorage);

if (!FIREBASE_WEB_CONFIG.apiKey) {
  throw new Error('[web] Missing Firebase web config (src/config/firebaseWeb.ts PROD_CONFIG).');
}

initializeApp(FIREBASE_WEB_CONFIG).catch(error => {
  console.error('[web] Firebase init failed', error);
});

export {};
