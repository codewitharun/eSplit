// src/services/crashReporting.ts
// Thin wrapper around Crashlytics + Analytics so the rest of the app
// doesn't import either SDK directly. Uses the namespaced API
// (crashlytics()/analytics()) rather than the newer modular API to match
// every other Firebase call in this codebase (firestore(), auth(),
// messaging()) - the modular rewrite is scoped as part of the bigger
// react-native-firebase v26 upgrade (see PHASE_2_FEASIBILITY.md section
// 7), not something to mix in piecemeal here.
//
// Crashlytics captures uncaught JS errors and native crashes
// automatically once the package is linked - nothing to wire up for that.
// What this file adds on top: tying a crash/analytics event back to which
// user hit it (setUserId), and screen-view tracking so Analytics has a
// basic picture of navigation, not just raw event counts.

import analytics from '@react-native-firebase/analytics';
import crashlytics from '@react-native-firebase/crashlytics';

/**
 * Call once after a successful login, and again with `null` on logout.
 * Ties future crash reports and analytics events to this user so a crash
 * in the dashboard can be traced back to an account (e.g. for support),
 * without putting anything sensitive (email, name) into either SDK.
 */
export async function identifyUser(uid: string | null): Promise<void> {
  try {
    await crashlytics().setUserId(uid || '');
    await analytics().setUserId(uid);
  } catch (error) {
    console.log('identifyUser failed:', error);
  }
}

/**
 * Records a caught error to Crashlytics without crashing the app - use
 * this in catch blocks for failures worth seeing in the dashboard (a
 * failed Firestore write, a failed notification send) that the user
 * already sees a Toast for, so support has the stack trace too.
 */
export function recordError(error: unknown, context?: string): void {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    if (context) {
      crashlytics().log(context);
    }
    crashlytics().recordError(err);
  } catch {
    // Never let error reporting itself throw.
  }
}

/**
 * Logs a screen_view event to Analytics. Pass the current route name from
 * React Navigation's `onStateChange` (see App.jsx) - kept as a plain
 * function here rather than baked into the navigation setup so it's easy
 * to unit-test or swap later.
 */
export function trackScreenView(screenName: string): void {
  analytics()
    .logScreenView({screen_name: screenName, screen_class: screenName})
    .catch(() => {});
}
