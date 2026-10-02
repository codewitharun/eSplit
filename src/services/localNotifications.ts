// src/services/localNotifications.ts
// The only place App.tsx touches notifee (local notifications: permission +
// taps on "PDF exported" / "join request" notifications). Has a .web.ts twin.
import notifee, {AuthorizationStatus, EventType} from '@notifee/react-native';

export type LocalPermission = 'authorized' | 'provisional' | 'denied' | 'unknown';

export interface LocalNotificationPress {
  actionId?: string;
  data?: {[key: string]: string | number | object};
}

export async function requestLocalNotificationPermission(): Promise<LocalPermission> {
  const {authorizationStatus} = await notifee.requestPermission();
  switch (authorizationStatus) {
    case AuthorizationStatus.AUTHORIZED:
      return 'authorized';
    case AuthorizationStatus.PROVISIONAL:
      return 'provisional';
    case AuthorizationStatus.DENIED:
      return 'denied';
    default:
      return 'unknown';
  }
}

// Foreground taps on a local notification.
export function onLocalNotificationPress(
  cb: (press: LocalNotificationPress) => void | Promise<void>,
): () => void {
  return notifee.onForegroundEvent(async ({type, detail}) => {
    if (type !== EventType.PRESS) {
      return;
    }
    await cb({
      actionId: detail.pressAction?.id,
      data: detail.notification?.data,
    });
  });
}
