// src/data/announcements.ts
// Read-only access to the `announcements` top-level collection - written
// by the admin panel's Announcements page (esplit-backend/routes/admin.js)
// and already pushed out via FCM the moment one is created. The app never
// had any in-app list for these before; this only adds read access for
// the new Notifications screen and never writes to this collection.

import {
  collection,
  onSnapshot,
  query,
  where,
  type Timestamp,
} from '@react-native-firebase/firestore';
import {db} from './firebase';

export interface Announcement {
  id: string;
  title: string;
  message: string;
  active: boolean;
  createdAt: string; // ISO timestamp, converted from Firestore's Timestamp
  createdBy?: string;
}

function toIso(value: Timestamp | undefined): string {
  return value ? value.toDate().toISOString() : new Date(0).toISOString();
}

// Deliberately no `.orderBy('createdAt')` alongside the `active` filter -
// a where() on one field plus orderBy() on a different one needs a
// composite Firestore index that doesn't exist for this collection yet,
// which would fail at runtime with a "requires an index" error instead of
// just working. Sorting newest-first happens in JS below instead, same
// as this codebase already avoids that trap elsewhere (see
// subscribeJoinRequests in firestoreLedger.ts).
export function subscribeActiveAnnouncements(
  onChange: (announcements: Announcement[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(db(), 'announcements'), where('active', '==', true)),
      snap => {
        const list = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            title: data.title,
            message: data.message,
            active: data.active,
            createdAt: toIso(data.createdAt),
            createdBy: data.createdBy,
          } as Announcement;
        });
        list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        onChange(list);
      },
    err => onError?.(err as unknown as Error),
  );
}
