import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import auth from '@react-native-firebase/auth';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './src/screens/BeforeLogin/Login';
import ExpenseTracker from './src/screens/AfterLogin/ExpenseTracker';
import Notifications from './src/screens/Notifications';
import { signOut } from './src/services/auth';
import firestore from '@react-native-firebase/firestore';
import notifee, { AndroidImportance, AuthorizationStatus } from '@notifee/react-native';

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    // Request permission for notifications
    messaging().requestPermission();
    checkPermission()

    messaging().registerDeviceForRemoteMessages();


    Notifications.createChannel();


    messaging().onMessage(async (remoteMessage) => {
      console.log('Received notification:', remoteMessage);
      Notifications.displayNotification(remoteMessage.notification.title, remoteMessage.notification.body);
    });
  }, []);
  useEffect(() => {
    requestUserPermission();

    const subscriber = auth().onAuthStateChanged(onAuthStateChanged);
    return subscriber;
  }, []);

  const checkPermission = async () => {

    const settings = await notifee.requestPermission();

    if (settings.authorizationStatus === AuthorizationStatus.DENIED) {
      console.log('User denied permissions request');
    } else if (settings.authorizationStatus === AuthorizationStatus.AUTHORIZED) {
      console.log('User granted permissions request');
    } else if (settings.authorizationStatus === AuthorizationStatus.PROVISIONAL) {
      console.log('User provisionally granted permissions request');
    }

  };

  const requestUserPermission = async () => {
    const authStatus = await messaging().requestPermission();
    if (authStatus === messaging.AuthorizationStatus.AUTHORIZED || authStatus === messaging.AuthorizationStatus.PROVISIONAL) {
      Notifications.createChannel();
    }
  };

  const onAuthStateChanged = async (user) => {
    setUser(user);
    setLoading(false);
    if (user) {

      const token = await messaging().getToken();
      await firestore().collection('mobileUser').doc(user.uid).set({
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        token: token
      });
      await AsyncStorage.setItem('userToken', user.uid);
    } else {
      await AsyncStorage.removeItem('userToken');
    }
  };



  return (
    user ? <ExpenseTracker user={user} onLogoutPress={signOut} /> : <LoginScreen />
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
