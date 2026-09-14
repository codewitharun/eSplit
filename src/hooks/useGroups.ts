// src/hooks/useGroups.ts
// Group list + create/join, shared by GroupCheck.js (the initial gate +
// deep-link target) and the Groups tab so that logic isn't duplicated.

import {useCallback, useEffect, useState} from 'react';
import auth from '@react-native-firebase/auth';
import {
  createGroup as createGroupApi,
  getGroupByJoinCode,
  getUserGroups,
  joinGroup as joinGroupApi,
} from '../services/ledger/firestoreLedger';
import {Group} from '../services/ledger/types';

export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const user = auth().currentUser;

  const refresh = useCallback(async () => {
    if (!user) {
      return;
    }
    setLoading(true);
    try {
      const list = await getUserGroups(user.uid);
      setGroups(list);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createGroup = useCallback(
    async (name: string, currency?: string) => {
      if (!user) {
        throw new Error('You need to be signed in to create a group.');
      }
      const group = await createGroupApi(user, name, currency);
      await refresh();
      return group;
    },
    [user, refresh],
  );

  const joinGroupByCode = useCallback(
    async (code: string) => {
      if (!user) {
        throw new Error('You need to be signed in to join a group.');
      }
      const group = await getGroupByJoinCode(code);
      if (!group) {
        throw new Error('No group matches that code.');
      }
      const result = await joinGroupApi(user, group.id);
      await refresh();
      return result;
    },
    [user, refresh],
  );

  const joinGroupById = useCallback(
    async (groupId: string) => {
      if (!user) {
        throw new Error('You need to be signed in to join a group.');
      }
      const result = await joinGroupApi(user, groupId);
      await refresh();
      return result;
    },
    [user, refresh],
  );

  return {
    groups,
    loading,
    refresh,
    createGroup,
    joinGroupByCode,
    joinGroupById,
  };
}
