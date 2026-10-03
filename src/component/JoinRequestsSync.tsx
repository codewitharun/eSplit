// src/component/JoinRequestsSync.tsx
// Renders nothing. Mounted once while signed in (App.tsx) to keep
// useJoinRequestsStore filled with the pending join requests of every
// group the user ADMINS:
//   - for each shared group, listen to your own member entry to know
//     whether you're an admin there (role === 'admin', still active);
//   - only then listen to that group's pending joinRequests.
// Before this, the Notifications screen treated "admin" as "created the
// group" - so an admin who didn't create it (creator left, or promoted)
// never saw requests there and had to dig through Group Settings.
// Read-only: nothing here writes to Firestore.
import {useEffect, useMemo} from 'react';
import {currentUser} from '../data/firebase';
import {subscribeJoinRequests, subscribeMyMembership} from '../data/ledger';
import {useGroupsStore} from '../store/useGroupsStore';
import {useJoinRequestsStore} from '../store/useJoinRequestsStore';

export default function JoinRequestsSync(): null {
  const uid = currentUser()?.uid ?? null;
  const groups = useGroupsStore(state => state.groups);
  const fetchGroups = useGroupsStore(state => state.fetchGroups);

  // Make sure the group list exists even if no screen has loaded it yet
  // (e.g. cold start straight into the Notifications screen).
  useEffect(() => {
    if (uid) {
      fetchGroups(uid).catch(() => {});
    }
  }, [uid, fetchGroups]);

  const shared = useMemo(
    () => groups.filter(g => g.type !== 'personal'),
    [groups],
  );
  // Re-subscribe only when the set of groups (or a name) actually changes.
  const groupsKey = useMemo(
    () =>
      shared
        .map(g => `${g.id}:${g.name}`)
        .sort()
        .join('|'),
    [shared],
  );

  useEffect(() => {
    const store = useJoinRequestsStore.getState();
    if (!uid) {
      store.reset();
      return;
    }

    // Drop requests for groups you're no longer in.
    const ids = new Set(shared.map(g => g.id));
    Object.keys(store.byGroup).forEach(id => {
      if (!ids.has(id)) {
        store.clearGroup(id);
      }
    });

    const requestUnsubs = new Map<string, () => void>();
    const memberUnsubs = shared.map(group =>
      subscribeMyMembership(group.id, uid, member => {
        const isAdmin = member?.role === 'admin' && member.active !== false;
        const listening = requestUnsubs.has(group.id);
        if (isAdmin && !listening) {
          requestUnsubs.set(
            group.id,
            subscribeJoinRequests(group.id, list =>
              useJoinRequestsStore.getState().setGroup(
                group.id,
                list.map(r => ({...r, groupId: group.id, groupName: group.name})),
              ),
            ),
          );
        } else if (!isAdmin && listening) {
          requestUnsubs.get(group.id)?.();
          requestUnsubs.delete(group.id);
          useJoinRequestsStore.getState().clearGroup(group.id);
        }
      }),
    );

    return () => {
      memberUnsubs.forEach(unsub => unsub());
      requestUnsubs.forEach(unsub => unsub());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, groupsKey]);

  // Signed out (this unmounts) -> forget everything.
  useEffect(() => () => useJoinRequestsStore.getState().reset(), []);

  return null;
}
