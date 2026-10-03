// src/store/useGroupsStore.ts
// Backs useGroups.ts with a single shared cache instead of each screen
// keeping its own local useState copy. Before this, GroupCheck.tsx (the
// dashboard), Groups.tsx (the "See All" list), SwitchGroupSheet.tsx (the
// switch-group sheet - mounted, just hidden, inside every header's
// GroupSwitcherPill) and CreateJoinGroup.tsx each called useGroups()
// independently, and each one independently ran its own getUserGroups()
// Firestore read (1 read for the user doc + 1 per group) on mount - so
// just opening the dashboard, opening a group, then tapping "Switch
// group" could cost 3-4x the Firestore reads it actually needed.
//
// This store is fetched once per signed-in uid and reused by all of
// them; it's only re-read from Firestore when something that can
// actually change WHICH groups you belong to happens - creating a group
// or joining one (both call `refresh()`, which forces a real read) - or
// updated locally with zero reads when you leave a group (see
// `removeGroup`, used by useGroups.ts's `removeGroupLocally`). It is NOT
// re-read just because a screen was re-focused or remounted.
//
// Per-group BALANCES (useGroupsOverview.ts) are deliberately NOT cached
// here and keep reading live every time - those numbers need to stay
// accurate. Only the group list's own metadata (name, members, join
// code, type) is what rarely changes and is worth caching.
import {create} from 'zustand';
import {getUserGroups} from '../data/ledger';
import {Group} from '../services/ledger/types';

interface GroupsStoreState {
  groups: Group[];
  loading: boolean;
  // Which uid the current `groups` array was fetched for. A different
  // uid always forces a fresh read regardless of `force` - guards
  // against showing a stale cache left over from a previously
  // signed-in account.
  fetchedForUid: string | null;
  fetchGroups: (uid: string, opts?: {force?: boolean}) => Promise<void>;
  removeGroup: (groupId: string) => void;
  renameGroup: (groupId: string, newName: string) => void;
  clear: () => void;
}

export const useGroupsStore = create<GroupsStoreState>((set, get) => ({
  groups: [],
  loading: false,
  fetchedForUid: null,

  fetchGroups: async (uid, opts) => {
    const {fetchedForUid, loading} = get();
    const alreadyCachedForThisUser = fetchedForUid === uid;

    if (alreadyCachedForThisUser && !opts?.force) {
      // The whole point of the cache: reuse it with zero Firestore reads.
      return;
    }
    if (loading && alreadyCachedForThisUser) {
      // A fetch for this exact uid is already in flight (e.g. two
      // screens mounting useGroups() in the same tick) - let it finish
      // rather than firing a second parallel read for identical data.
      return;
    }

    set({loading: true});
    try {
      const list = await getUserGroups(uid);
      set({groups: list, fetchedForUid: uid, loading: false});
    } catch (error) {
      set({loading: false});
      throw error;
    }
  },

  // Updates the cache in place right after a successful "leave group" -
  // no Firestore read needed, and it's more immediate than waiting for
  // some future refetch to notice the group is gone.
  removeGroup: groupId =>
    set(state => ({groups: state.groups.filter(g => g.id !== groupId)})),

  // Same idea as removeGroup: GroupSettings.tsx's rename lives outside
  // this store (it edits the group doc directly via renameGroup() in
  // firestoreLedger.ts, since GroupSettings reads the group from the
  // live useGroupLedger() subscription, not this cache) - but the
  // dashboard/Groups-list cache still needs its own copy of the name
  // patched in place, or it'd keep showing the old name until the next
  // forced refresh (creating/joining a group).
  renameGroup: (groupId, newName) =>
    set(state => ({
      groups: state.groups.map(g =>
        g.id === groupId ? {...g, name: newName} : g,
      ),
    })),

  clear: () => set({groups: [], fetchedForUid: null, loading: false}),
}));
