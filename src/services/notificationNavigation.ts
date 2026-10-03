// src/services/notificationNavigation.ts
// Routes a tapped push notification to the right in-app screen. Shared by
// every state a tap can arrive in - foreground (via notifee, wired in
// App.jsx's onForegroundEvent), backgrounded
// (messaging().onNotificationOpenedApp) and cold-started from a killed
// app (messaging().getInitialNotification) - so all three behave
// identically instead of three separately hand-rolled versions.
//
// There was previously NO tap-to-navigate handling anywhere in the app -
// every push just opened whatever screen the app happened to already be
// on. This is what the join-approval feature needs: tapping "so-and-so
// wants to join" should land an admin straight on the Notifications
// screen where they can approve/decline, not leave them to go find it
// themselves.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {currentUser} from '../data/firebase';
import {Routes} from '../navigator/constants';
import {useExpenseState} from '../store/useExpenseStore';
import {useGroupsStore} from '../store/useGroupsStore';
import {navigate} from './NavigationService';

// Switches the app's active group the same way useEnterGroup.ts's
// enterGroup() does - every group-scoped screen (Home/Activity/Balances/
// GroupSettings) reads the current group from this Zustand store +
// AsyncStorage, not from navigation params, so a notification tap has to
// set it exactly the same way a manual join or group-switch already does.
async function setActiveGroup(groupId: string) {
  useExpenseState.getState().setGroupKey(groupId);
  try {
    await AsyncStorage.setItem('groupKey', groupId);
    await AsyncStorage.setItem('lastJoinedGroup', groupId);
  } catch (error) {
    console.log('🚀 ~ setActiveGroup (notification tap) ~ error:', error);
  }
}

/**
 * Opens a group's Settings tab, where its join requests are listed at the
 * top - switching the app to that group first. `requesterUid` highlights
 * that person's request. Falls back to the Notifications screen if the
 * group isn't one of yours (left it, removed, or it was deleted).
 * Used by a "wants to join" push tap and by the Notifications screen.
 */
export async function openGroupJoinRequests(
  groupId: string,
  requesterUid?: string,
) {
  const uid = currentUser()?.uid;
  const store = useGroupsStore.getState();
  let group = store.groups.find(g => g.id === groupId);
  if (!group && uid) {
    // Cold start, or a group joined since the list was loaded.
    try {
      await store.fetchGroups(uid, {force: true});
    } catch {
      // fall through to the Notifications screen below
    }
    group = useGroupsStore.getState().groups.find(g => g.id === groupId);
  }
  if (!group) {
    navigate('Notifications');
    return;
  }
  await setActiveGroup(groupId);
  navigate('Home', {
    screen: Routes.GroupSettings,
    // focusAt makes a repeat tap for the same person re-highlight.
    params: {focusRequestUid: requesterUid, focusAt: Date.now()},
  });
}

// `data` is the custom payload attached by esplit-backend's
// /send-notification (see src/services/notifications.ts) - every value
// on it arrives as a string, FCM's own requirement.
export type NotificationData = {
  [key: string]: string | number | object | undefined;
};

export async function handleNotificationTap(data?: NotificationData | null) {
  const type = typeof data?.type === 'string' ? data.type : undefined;
  const groupId = typeof data?.groupId === 'string' ? data.groupId : undefined;
  if (!type || !groupId) {
    return;
  }
  try {
    switch (type) {
      case 'join_request':
        // An admin tapped "so-and-so wants to join" - go straight to that
        // group's Settings, where the request is at the top with
        // Approve / Decline (it used to open the Notifications screen,
        // leaving the admin to find the group and its settings).
        await openGroupJoinRequests(
          groupId,
          typeof data?.requesterUid === 'string' ? data.requesterUid : undefined,
        );
        break;
      case 'join_approved':
        // The requester tapped "you're in" - drop them straight into the
        // group they just joined, same destination a manual join lands
        // on.
        await setActiveGroup(groupId);
        navigate('Home');
        break;
      case 'join_declined':
        // Purely informational - nothing to navigate to.
        break;
      default:
        break;
    }
  } catch (error) {
    console.log('🚀 ~ handleNotificationTap ~ error:', error);
  }
}
