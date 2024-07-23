// Notifications.js
import notifee, { AndroidImportance } from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';

const Notifications = {
    createChannel: async () => {
        await notifee.createChannel({
            id: 'split',
            name: 'split',
            importance: AndroidImportance.HIGH,
            sound: 'default',
        });
    },

    displayNotification: async (title, body) => {
        await notifee.displayNotification({
            title: title,
            body: body,
            android: {
                channelId: 'split',
                importance: AndroidImportance.HIGH,
            },
        });
    },


};


export default Notifications;
