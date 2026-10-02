// Web twin of localNotifications.ts - notifee is native-only.
import type {LocalNotificationPress, LocalPermission} from './localNotifications';

export type {LocalNotificationPress, LocalPermission};

export async function requestLocalNotificationPermission(): Promise<LocalPermission> {
  return 'unknown';
}

export function onLocalNotificationPress(
  _cb: (press: LocalNotificationPress) => void | Promise<void>,
): () => void {
  return () => {};
}
