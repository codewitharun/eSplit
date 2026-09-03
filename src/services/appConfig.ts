// src/services/appConfig.ts
// Force-update gate: a single Firestore doc (appConfig/global) drives two
// independent thresholds so a real "please update now" only fires for
// genuinely broken old builds, while everyone else just gets a dismissible
// nudge toward the newest release:
//   - minSupportedVersion: below this, the app is hard-blocked (see
//     ForceUpdateGate.tsx) - reserve this for releases with a critical,
//     unfixable-client-side bug.
//   - latestVersion: below this but at/above the minimum, a one-time
//     dismissible AppAlert suggests updating.
// Both fields are optional - an empty/missing doc, a network failure, or a
// permissions problem must never block or nag anyone, so every failure
// path below "fails open" (treated as `status: 'ok'`).
//
// Reads the app's own version from package.json rather than adding
// react-native-device-info - this project already keeps package.json's
// "version" and android/app/build.gradle's versionName in sync by hand for
// every release, so it's a free source of truth with no new dependency.

import firestore from '@react-native-firebase/firestore';
import {Linking} from 'react-native';

const pkg = require('../../package.json');

const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.techtitens.ezysplit';

const CURRENT_VERSION: string = pkg.version;

/**
 * Compares two dot-separated version strings numerically, segment by
 * segment (so "2.9.0" < "2.10.0", unlike a plain string comparison).
 * Returns <0 if a<b, 0 if equal, >0 if a>b. Missing/non-numeric segments
 * are treated as 0.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    String(v)
      .split('.')
      .map(n => parseInt(n, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) {
      return diff < 0 ? -1 : 1;
    }
  }
  return 0;
}

export type AppConfigStatus = 'ok' | 'nudge' | 'blocked';

export interface AppConfigCheckResult {
  status: AppConfigStatus;
  latestVersion?: string;
  minSupportedVersion?: string;
  message?: string;
}

export async function checkAppConfig(): Promise<AppConfigCheckResult> {
  try {
    const snap = await firestore().collection('appConfig').doc('global').get();
    if (!snap.exists) {
      return {status: 'ok'};
    }
    const data = snap.data() || {};
    const min: string | undefined = data.minSupportedVersion;
    const latest: string | undefined = data.latestVersion;
    const message: string | undefined = data.updateMessage;

    if (min && compareVersions(CURRENT_VERSION, min) < 0) {
      return {
        status: 'blocked',
        minSupportedVersion: min,
        latestVersion: latest,
        message,
      };
    }
    if (latest && compareVersions(CURRENT_VERSION, latest) < 0) {
      return {status: 'nudge', latestVersion: latest, message};
    }
    return {status: 'ok'};
  } catch (error) {
    console.log('checkAppConfig failed, failing open:', error);
    return {status: 'ok'};
  }
}

export function openPlayStore(): void {
  Linking.openURL(PLAY_STORE_URL).catch(() => {});
}
