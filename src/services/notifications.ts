// src/services/notifications.ts
// Push notifications go through the existing esplit-backend (a small
// Express app, deployed separately from this repo, at
// API_BASE_URL in src/config/urls.ts) - POST /send-notification takes
// {tokens, title, body} and fans it out via
// admin.messaging().sendEachForMulticast() on the server side, using the
// Firebase Admin SDK credentials that live there (mobile clients can't
// send FCM pushes to OTHER devices directly - only a trusted server with
// an Admin SDK key can).
//
// v1 called this endpoint after every expense add and group join. The v2
// ledger rewrite (this file's addExpense()/joinGroup()) never called it at
// all, which is why members stopped getting notified even though the
// server-side endpoint itself was never touched and still works fine.

import {API_BASE_URL} from '../config/urls';

const NOTIFY_ENDPOINT = `${API_BASE_URL}/send-notification`;

export async function sendPushNotification(
  tokens: Array<string | null | undefined>,
  title: string,
  body: string,
  // Optional custom payload carried alongside the notification - e.g.
  // {type: 'join_request', groupId} - so a tap can be routed to the right
  // screen instead of just opening the app. FCM requires every value to
  // be a string. Backward compatible: omitting this sends exactly what
  // this function always sent before.
  data?: Record<string, string>,
): Promise<void> {
  const cleanTokens = Array.from(
    new Set(tokens.filter((t): t is string => !!t)),
  );
  if (cleanTokens.length === 0) {
    return;
  }
  try {
    await fetch(NOTIFY_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        tokens: cleanTokens,
        title,
        body,
        ...(data ? {data} : {}),
      }),
    });
  } catch (error) {
    // A notification hiccup (backend hiccup, no network) should never
    // break the expense/join flow that triggered it - log and move on.
    console.log('🚀 ~ sendPushNotification ~ error:', error);
  }
}
