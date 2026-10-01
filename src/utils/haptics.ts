// src/utils/haptics.ts
// Deliberately built on React Native's built-in Vibration API rather than
// react-native-haptic-feedback: that library needs native linking, and
// this project's Gradle build has been fragile. Vibration needs no new
// native module; swap the implementation for a haptics library later -
// call sites (tap/tick/success/warning/error) won't need to change.
//
// ANDROID: needs <uses-permission android:name="android.permission.VIBRATE"/>
// in AndroidManifest.xml - without it every call here is a silent no-op
// (that was why no haptics fired on real Android devices before Oct 2026).
//
// iOS: RN's Vibration ignores durations and always plays a full ~400ms
// buzz, so the very light `tick` is Android-only (on iOS it would feel
// like a phone call, not a tap).

import {Platform, Vibration} from 'react-native';

const isAndroid = Platform.OS === 'android';

export const haptics = {
  // A normal button press / selection.
  tap: () => Vibration.vibrate(isAndroid ? 10 : 8),
  // The lightest possible pulse - for repeated feedback like the AI's
  // "typing" and text streaming in. Android only (see above).
  tick: () => {
    if (isAndroid) {
      Vibration.vibrate(4);
    }
  },
  // Something was created / saved / answered.
  success: () =>
    Vibration.vibrate(isAndroid ? [0, 15, 40, 15] : [0, 12, 40, 12]),
  // A soft "that didn't work" - validation, blocked action.
  warning: () => Vibration.vibrate(25),
  // A real failure (network/server error).
  error: () => Vibration.vibrate(isAndroid ? [0, 30, 60, 30, 60, 30] : 25),
};
