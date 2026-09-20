// src/services/adminNotifications.ts
// Read-only access to users/{uid}/notifications - personal messages sent
// from the admin panel's "Send a notification" page
// (esplit-backend/routes/admin.js), persisted there specifically so they
// show up here even on a device where the push itself never arrived
// (missing/stale token, app killed, etc). Purely additive read access;
// nothing on the mobile side ever writes to this subcollection.

import firestore, {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';

export interface AdminNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  createdAt: string; // ISO timestamp, converted from Firestore's Timestamp
}

function toIso(value: FirebaseFirestoreTypes.Timestamp | undefined): string {
  return value ? value.toDate().toISOString() : new Date(0).toISOString();
}

export function subscribeAdminNotifications(
  uid: string,
  onChange: (notifications: AdminNotification[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return firestore()
    .collection('users')
    .doc(uid)
    .collection('notifications')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .onSnapshot(
      snap =>
        onChange(
          snap.docs.map(d => {
            const data = d.data();
            return {
              id: d.id,
              title: data.title,
              body: data.body,
              type: data.type || 'admin',
              createdAt: toIso(data.createdAt),
            } as AdminNotification;
          }),
        ),
      err => onError?.(err as unknown as Error),
    );
}
