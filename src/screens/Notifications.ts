// src/screens/Notifications.ts - notifee channels + local notifications.
import notifee, {AndroidImportance} from '@notifee/react-native';

const Notifications = {
  createChannel: async () => {
    await notifee.createChannel({
      id: 'Transaction',
      name: 'Split Notifications',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
    });
  },
  createExportChannel: async () => {
    await notifee.createChannel({
      id: 'Export',
      name: 'Exported PDF',
      importance: AndroidImportance.LOW,
      vibration: true,
      sound: undefined,
    });
  },
  displayExportedNotification: async ({
    title,
    body,
    filePath,
    channelId = 'Transaction',
  }: {
    title: string;
    body: string;
    filePath: string;
    channelId?: string;
  }) => {
    await notifee.displayNotification({
      title,
      body,
      android: {
        channelId,
        smallIcon: 'notification_icon',
        color: '#0082B0',
        sound: undefined,
        pressAction: {
          id: 'open-pdf',
        },
      },
      data: {filePath},
    });
  },

  displayNotification: async (title: string, body: string) => {
    await notifee.displayNotification({
      title,
      body,
      android: {
        channelId: 'Transaction',
        smallIcon: 'notification_icon',
        color: '#0082B0',
      },
    });
  },

  // For a push that carries a `data` payload (e.g. {type: 'join_request',
  // groupId}) - used only while the app is in the FOREGROUND, where FCM
  // never shows a system notification on its own (see App.jsx's
  // onMessage), so there'd otherwise be nothing for the user to tap.
  // Backgrounded/killed states don't need this: the OS displays those
  // notifications itself from the same push, and a tap on those is
  // caught by messaging().onNotificationOpenedApp /
  // getInitialNotification instead (see notificationNavigation.js).
  displayDataNotification: async ({
    title,
    body,
    data,
  }: {
    title?: string;
    body?: string;
    data?: {[key: string]: string | object};
  }) => {
    await notifee.displayNotification({
      title,
      body,
      android: {
        channelId: 'Transaction',
        smallIcon: 'notification_icon',
        color: '#0082B0',
        pressAction: {id: 'join-notification'},
      },
      data,
    });
  },
};

export default Notifications;
