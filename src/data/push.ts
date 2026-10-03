// src/data/push.ts
// Firebase Cloud Messaging (modular API). The data layer's only messaging
// entry point - App.tsx and index.ts call these instead of the SDK.
import {getApp} from '@react-native-firebase/app';
import {
  AuthorizationStatus,
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  registerDeviceForRemoteMessages,
  requestPermission,
  setBackgroundMessageHandler,
  type RemoteMessage,
} from '@react-native-firebase/messaging';

export type PushMessage = RemoteMessage;

const messaging = () => getMessaging(getApp());

// Must run at module load in index.ts (headless JS), before React mounts.
export function registerBackgroundPushHandler(): void {
  setBackgroundMessageHandler(messaging(), async message => {
    console.log('Message handled in the background!', message?.messageId);
  });
}

// true when the user allowed notifications (authorized or provisional).
export async function requestPushPermission(): Promise<boolean> {
  const status = await requestPermission(messaging());
  return (
    status === AuthorizationStatus.AUTHORIZED ||
    status === AuthorizationStatus.PROVISIONAL
  );
}

export function registerForRemotePush(): Promise<void> {
  return registerDeviceForRemoteMessages(messaging());
}

export function getPushToken(): Promise<string> {
  return getToken(messaging());
}

export function onForegroundPush(cb: (m: PushMessage) => void): () => void {
  return onMessage(messaging(), async m => cb(m));
}

export function onPushOpenedApp(cb: (m: PushMessage) => void): () => void {
  return onNotificationOpenedApp(messaging(), cb);
}

export function getLaunchPush(): Promise<PushMessage | null> {
  return getInitialNotification(messaging());
}
