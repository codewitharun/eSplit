// src/hooks/useAnnouncements.ts
// Live list of active announcements, for the Notifications screen.

import {useEffect, useState} from 'react';
import {
  Announcement,
  subscribeActiveAnnouncements,
} from '../data/announcements';

export interface AnnouncementsState {
  loading: boolean;
  announcements: Announcement[];
}

export function useAnnouncements(): AnnouncementsState {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeActiveAnnouncements(list => {
      setAnnouncements(list);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return {loading, announcements};
}
