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
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import GroupManagement from './src/screens/AfterLogin/GroupCheck';
import LogoutScreen from './src/screens/AfterLogin/Logout';

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasCheckedGroup, setHasCheckedGroup] = useState("false");
  const Stack = createNativeStackNavigator();
  const Drawer = createDrawerNavigator();

  useEffect(() => {
    messaging().requestPermission();
    checkPermission();
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
      try {
        const token = await messaging().getToken();

        // Use merge: true to update the document if it exists, or create it if it doesn't
        await firestore().collection('Esplitusers').doc(user.uid).set({
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          tokens: token,
        }, { merge: true });

        await AsyncStorage.setItem('userToken', user.uid);

        // Check if the user has already completed group check
        const hasChecked = await AsyncStorage.getItem('hasCheckedGroup');
        setHasCheckedGroup(hasChecked);

      } catch (error) {
        console.error('Error in onAuthStateChanged:', error);
      }
    } else {
      try {
        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('hasCheckedGroup');
        setHasCheckedGroup("false");
      } catch (error) {
        console.error('Error in onAuthStateChanged (logout):', error);
      }
    }
  };

  const AfterLogin = () => (
    <Drawer.Navigator screenOptions={{ headerShown: false }} initialRouteName={hasCheckedGroup === "true" ? "Home" : " Group-Check"}>
      <Drawer.Screen name="Group-Check" component={GroupManagement} />

      <Drawer.Screen name="Home" component={ExpenseTracker} />
      <Drawer.Screen name="Logout" component={LogoutScreen} />

    </Drawer.Navigator>
  );

  const BeforeLogin = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <AfterLogin /> : <BeforeLogin />}
    </NavigationContainer>
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
