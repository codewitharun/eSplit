// src/services/notificationNavigation.js
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
import {useExpenseState} from '../store/useExpenseStore';
import {navigate} from './NavigationService';

// Switches the app's active group the same way useEnterGroup.ts's
// enterGroup() does - every group-scoped screen (Home/Activity/Balances/
// GroupSettings) reads the current group from this Zustand store +
// AsyncStorage, not from navigation params, so a notification tap has to
// set it exactly the same way a manual join or group-switch already does.
async function setActiveGroup(groupId) {
  useExpenseState.getState().setGroupKey(groupId);
  try {
    await AsyncStorage.setItem('groupKey', groupId);
    await AsyncStorage.setItem('lastJoinedGroup', groupId);
  } catch (error) {
    console.log('🚀 ~ setActiveGroup (notification tap) ~ error:', error);
  }
}

// `data` is the custom payload attached by esplit-backend's
// /send-notification (see src/services/notifications.ts) - every value
// on it arrives as a string, FCM's own requirement.
export async function handleNotificationTap(data) {
  if (!data || !data.type || !data.groupId) {
    return;
  }
  try {
    switch (data.type) {
      case 'join_request':
        // An admin tapped "so-and-so wants to join" - the Notifications
        // screen (NotificationsScreen.tsx) aggregates pending requests
        // across every group they administer on its own, so there's no
        // active-group switch to do here - just open it.
        navigate('Notifications');
        break;
      case 'join_approved':
        // The requester tapped "you're in" - drop them straight into the
        // group they just joined, same destination a manual join lands
        // on.
        await setActiveGroup(data.groupId);
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
