// src/utils/haptics.ts
// Deliberately built on React Native's built-in Vibration API rather than
// react-native-haptic-feedback: that library needs native linking, and
// this project's Gradle build is currently broken for unrelated reasons
// (see the corporate-proxy Gradle wrapper issue). Vibration needs no new
// native module, so this ships today; swap the implementation for the
// haptic-feedback library later once a clean build is confirmed working -
// the call sites (tap/success/warning) won't need to change.

import {Platform, Vibration} from 'react-native';

export const haptics = {
  tap: () => Vibration.vibrate(Platform.OS === 'ios' ? 8 : 10),
  success: () =>
    Vibration.vibrate(
      Platform.OS === 'ios' ? [0, 12, 40, 12] : [0, 15, 40, 15],
    ),
  warning: () => Vibration.vibrate(25),
};
