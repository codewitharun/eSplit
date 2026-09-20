// src/hooks/useAdminNotifications.ts
// Live list of this user's personal admin-sent notifications, for the
// Notifications screen.

import {useEffect, useState} from 'react';
import auth from '@react-native-firebase/auth';
import {
  AdminNotification,
  subscribeAdminNotifications,
} from '../services/adminNotifications';

export interface AdminNotificationsState {
  loading: boolean;
  notifications: AdminNotification[];
}

export function useAdminNotifications(): AdminNotificationsState {
  const user = auth().currentUser;
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    const unsubscribe = subscribeAdminNotifications(user.uid, list => {
      setNotifications(list);
      setLoading(false);
    });
    return unsubscribe;
  }, [user]);

  return {loading, notifications};
}
