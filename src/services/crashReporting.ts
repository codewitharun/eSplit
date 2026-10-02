// src/services/crashReporting.ts
// Thin wrapper around Crashlytics + Analytics so the rest of the app
// doesn't import either SDK directly. Modular RNFirebase API (v22+).
//
// Crashlytics captures uncaught JS errors and native crashes
// automatically once the package is linked - nothing to wire up for that.
// What this file adds on top: tying a crash/analytics event back to which
// user hit it (setUserId), and screen-view tracking so Analytics has a
// basic picture of navigation, not just raw event counts.

import {
  getAnalytics,
  logScreenView,
  setUserId as setAnalyticsUserId,
} from '@react-native-firebase/analytics';
import {
  getCrashlytics,
  log,
  recordError as crashlyticsRecordError,
  setUserId as setCrashlyticsUserId,
} from '@react-native-firebase/crashlytics';

/**
 * Call once after a successful login, and again with `null` on logout.
 * Ties future crash reports and analytics events to this user so a crash
 * in the dashboard can be traced back to an account (e.g. for support),
 * without putting anything sensitive (email, name) into either SDK.
 */
export async function identifyUser(uid: string | null): Promise<void> {
  try {
    await setCrashlyticsUserId(getCrashlytics(), uid || '');
    await setAnalyticsUserId(getAnalytics(), uid);
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
      log(getCrashlytics(), context);
    }
    crashlyticsRecordError(getCrashlytics(), err);
  } catch {
    // Never let error reporting itself throw.
  }
}

/**
 * Logs a screen_view event to Analytics. Pass the current route name from
 * React Navigation's `onStateChange` (see App.tsx) - kept as a plain
 * function here rather than baked into the navigation setup so it's easy
 * to unit-test or swap later.
 */
export function trackScreenView(screenName: string): void {
  logScreenView(getAnalytics(), {
    screen_name: screenName,
    screen_class: screenName,
  }).catch(() => {});
}
