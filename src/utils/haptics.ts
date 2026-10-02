// src/utils/haptics.ts
// Expo build: real haptic effects via expo-haptics (VIBRATE permission is
// added by its config plugin). The call-site API is unchanged from the old
// Vibration-based version: haptics.tap/tick/success/warning/error.
// Every call is fire-and-forget and never throws - a phone with haptics
// turned off must not break a button press.
import * as Haptics from 'expo-haptics';

const safe = (p: Promise<unknown>) => {
  p.catch(() => {});
};

export const haptics = {
  // A normal button press / selection.
  tap: () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  // The lightest possible pulse - for repeated feedback like the AI's
  // "typing" and text streaming in.
  tick: () => safe(Haptics.selectionAsync()),
  // Something was created / saved / answered.
  success: () =>
    safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  // A soft "that didn't work" - validation, blocked action.
  warning: () =>
    safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  // A real failure (network/server error).
  error: () =>
    safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
