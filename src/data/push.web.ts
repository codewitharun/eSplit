// src/data/push.web.ts - web twin of push.ts. No FCM on web: every call is
// a harmless no-op so App.tsx's notification wiring just does nothing.
export type PushMessage = {
  messageId?: string;
  data?: {[key: string]: string | object};
  notification?: {title?: string; body?: string};
};

export function registerBackgroundPushHandler(): void {}
export async function requestPushPermission(): Promise<boolean> {
  return false;
}
export async function registerForRemotePush(): Promise<void> {}
export async function getPushToken(): Promise<string> {
  throw new Error('Push notifications are not available on web');
}
export function onForegroundPush(_cb: (m: PushMessage) => void): () => void {
  return () => {};
}
export function onPushOpenedApp(_cb: (m: PushMessage) => void): () => void {
  return () => {};
}
export async function getLaunchPush(): Promise<PushMessage | null> {
  return null;
}
