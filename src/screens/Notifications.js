// Notifications.js
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
  }) => {
    await notifee.displayNotification({
      title,
      body,
      android: {
        channelId,
        sound: undefined,
        pressAction: {
          id: 'open-pdf',
        },
      },
      data: {filePath},
    });
  },

  displayNotification: async (title, body) => {
    await notifee.displayNotification({
      title,
      body,
      android: {
        channelId: 'Transaction',
      },
    });
  },
};

export default Notifications;
