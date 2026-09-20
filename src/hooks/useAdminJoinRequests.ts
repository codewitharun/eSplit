// src/hooks/useAdminJoinRequests.ts
// Aggregates pending join requests across EVERY group the current user
// administers, not just whichever one happens to be open right now - this
// is what the Notifications screen needs (an admin managing several
// groups should see every pending request in one place), unlike
// GroupSettings.tsx's panel, which is scoped to the single active group.
//
// "Admin" here means group.createdBy === the current uid - the only way
// to become an admin today (createGroup() is the sole place that ever
// sets role: 'admin'; every join path, approved or not, only ever creates
// role: 'member'). If a promote/demote-admin feature is ever added, this
// will need to check each group's members/{uid}.role instead of
// createdBy - noted here so that future change doesn't miss this spot.

import {useEffect, useMemo, useState} from 'react';
import auth from '@react-native-firebase/auth';
import {useGroups} from './useGroups';
import {subscribeJoinRequests} from '../services/ledger/firestoreLedger';
import {JoinRequest} from '../services/ledger/types';

export interface AdminJoinRequest extends JoinRequest {
  groupId: string;
  groupName: string;
}

export function useAdminJoinRequests(): AdminJoinRequest[] {
  const user = auth().currentUser;
  const {groups} = useGroups();
  const [requests, setRequests] = useState<AdminJoinRequest[]>([]);

  // Only re-subscribe when the actual set of admin-owned group ids
  // changes, not on every `groups` array identity change from
  // useGroups()'s own refreshes.
  const adminGroupsKey = useMemo(() => {
    const admin = groups.filter(g => g.createdBy === user?.uid);
    return admin.map(g => `${g.id}:${g.name}`).join('|');
  }, [groups, user?.uid]);

  useEffect(() => {
    const adminGroups = groups.filter(g => g.createdBy === user?.uid);
    if (adminGroups.length === 0) {
      setRequests([]);
      return;
    }
    const perGroup = new Map<string, AdminJoinRequest[]>();
    const publish = () => setRequests(Array.from(perGroup.values()).flat());
    const unsubscribes = adminGroups.map(group =>
      subscribeJoinRequests(group.id, list => {
        perGroup.set(
          group.id,
          list.map(r => ({...r, groupId: group.id, groupName: group.name})),
        );
        publish();
      }),
    );
    return () => unsubscribes.forEach(unsub => unsub());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminGroupsKey, user?.uid]);

  return requests;
}
