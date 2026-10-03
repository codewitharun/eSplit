// Web twin of Notifications.ts - notifee channels/local notifications are
// native-only, so these are no-ops with the same shape.
const Notifications = {
  createChannel: async () => {},
  createExportChannel: async () => {},
  displayExportedNotification: async (_args: {
    title: string;
    body: string;
    filePath: string;
    channelId?: string;
  }) => {},
  displayNotification: async (_title: string, _body: string) => {},
  displayDataNotification: async (_args: {
    title?: string;
    body?: string;
    data?: {[key: string]: string | object};
  }) => {},
};

export default Notifications;
