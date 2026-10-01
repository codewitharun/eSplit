// src/hooks/useGroups.ts
// Group list + create/join, shared by GroupCheck.tsx (the initial gate +
// deep-link target), the Groups tab, SwitchGroupSheet and
// CreateJoinGroup so that logic isn't duplicated.
//
// The actual list now lives in useGroupsStore (a single shared Zustand
// cache) instead of a local useState here - every call site used to run
// its own independent getUserGroups() Firestore read on mount, so simply
// navigating between screens re-read the same group list several times
// over (see useGroupsStore.ts's own comment for the full reasoning).
// `refresh()` still forces a real Firestore read (used right after
// create/join, since that's the one moment the list has genuinely
// changed); `ensureLoaded()` is the same fetch but non-forced - a no-op
// whenever a cached copy for this uid already exists - safe to call on
// every mount/focus. `removeGroupLocally` updates the cache after a
// successful "leave group" with zero extra reads.

import {useCallback, useEffect} from 'react';
import auth from '@react-native-firebase/auth';
import {
  createGroup as createGroupApi,
  getGroupByJoinCode,
  joinGroup as joinGroupApi,
} from '../services/ledger/firestoreLedger';
import {GroupType} from '../services/ledger/types';
import {useGroupsStore} from '../store/useGroupsStore';

export function useGroups() {
  const user = auth().currentUser;
  const groups = useGroupsStore(state => state.groups);
  const loading = useGroupsStore(state => state.loading);
  const fetchGroups = useGroupsStore(state => state.fetchGroups);
  const removeGroup = useGroupsStore(state => state.removeGroup);
  const renameGroupInStore = useGroupsStore(state => state.renameGroup);

  const refresh = useCallback(async () => {
    if (!user) {
      return;
    }
    await fetchGroups(user.uid, {force: true});
  }, [user, fetchGroups]);

  // Non-forced: reuses the cache (zero Firestore reads) whenever one
  // already exists for this uid. Safe to call from every screen's mount
  // or focus effect instead of each one forcing its own refetch.
  const ensureLoaded = useCallback(async () => {
    if (!user) {
      return;
    }
    await fetchGroups(user.uid);
  }, [user, fetchGroups]);

  useEffect(() => {
    ensureLoaded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const createGroup = useCallback(
    async (name: string, currency?: string, groupType?: GroupType) => {
      if (!user) {
        throw new Error('You need to be signed in to create a group.');
      }
      const group = await createGroupApi(user, name, currency, groupType);
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
    ensureLoaded,
    removeGroupLocally: removeGroup,
    renameGroupLocally: renameGroupInStore,
    createGroup,
    joinGroupByCode,
    joinGroupById,
  };
}
