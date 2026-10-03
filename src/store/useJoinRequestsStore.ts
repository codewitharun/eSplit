// src/store/useJoinRequestsStore.ts
// Pending join requests for every group the signed-in user ADMINS, kept
// live by <JoinRequestsSync /> (mounted once, in App.tsx). One shared
// source so the Notifications screen, the Settings tab badge, the group
// switcher and the group lists all agree - and Firestore is only
// listened to once per group, not once per badge.
import {useMemo} from 'react';
import {create} from 'zustand';
import {JoinRequest} from '../services/ledger/types';

export interface PendingJoinRequest extends JoinRequest {
  groupId: string;
  groupName: string;
}

interface JoinRequestsState {
  byGroup: Record<string, PendingJoinRequest[]>;
  setGroup: (groupId: string, requests: PendingJoinRequest[]) => void;
  clearGroup: (groupId: string) => void;
  reset: () => void;
}

export const useJoinRequestsStore = create<JoinRequestsState>(set => ({
  byGroup: {},
  setGroup: (groupId, requests) =>
    set(state => ({byGroup: {...state.byGroup, [groupId]: requests}})),
  clearGroup: groupId =>
    set(state => {
      if (!(groupId in state.byGroup)) {
        return state;
      }
      const next = {...state.byGroup};
      delete next[groupId];
      return {byGroup: next};
    }),
  reset: () => set({byGroup: {}}),
}));

// Pure helpers (unit-tested in __tests__/useJoinRequestsStore.test.ts).
export function countPending(
  byGroup: Record<string, PendingJoinRequest[]>,
  excludeGroupId?: string | null,
): number {
  return Object.entries(byGroup).reduce(
    (sum, [id, list]) => (id === excludeGroupId ? sum : sum + list.length),
    0,
  );
}

export function flattenPending(
  byGroup: Record<string, PendingJoinRequest[]>,
): PendingJoinRequest[] {
  return Object.values(byGroup)
    .flat()
    .sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
}

/** Pending requests for one group (0 if you're not its admin). */
export function usePendingRequestCount(groupId: string | null | undefined) {
  return useJoinRequestsStore(state =>
    groupId ? state.byGroup[groupId]?.length ?? 0 : 0,
  );
}

/** Pending requests across every group you admin. */
export function useTotalPendingRequests(excludeGroupId?: string | null) {
  return useJoinRequestsStore(state =>
    countPending(state.byGroup, excludeGroupId),
  );
}

/** Every pending request you can act on, newest first. */
export function usePendingRequestsList(): PendingJoinRequest[] {
  const byGroup = useJoinRequestsStore(state => state.byGroup);
  return useMemo(() => flattenPending(byGroup), [byGroup]);
}
