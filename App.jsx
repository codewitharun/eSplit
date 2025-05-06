import React, {Suspense, useEffect, useState} from 'react';
import {View, ActivityIndicator, StyleSheet, Linking} from 'react-native';
import {navigationRef} from './src/services/NavigationService';

import auth from '@react-native-firebase/auth';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './src/screens/BeforeLogin/Login';
import ExpenseTracker from './src/screens/AfterLogin/ExpenseTracker';
import Notifications from './src/screens/Notifications';
import firestore from '@react-native-firebase/firestore';
import notifee, {AuthorizationStatus, EventType} from '@notifee/react-native';
import {NavigationContainer, useNavigation} from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createDrawerNavigator} from '@react-navigation/drawer';
import GroupManagement from './src/screens/AfterLogin/GroupCheck';
import LogoutScreen from './src/screens/AfterLogin/Logout';
import {useExpenseState} from './src/store/useExpenseStore';
import {useAuthStore} from './src/store/useAuthStore';
import SplashScreen from './src/screens/Splash';
import MobileAds from 'react-native-google-mobile-ads';
const App = () => {
  const user = useAuthStore(state => state.user);
  const setUser = useAuthStore(state => state.setUser);

  const [loading, setLoading] = useState(true);
  const Stack = createNativeStackNavigator();

  const linking = {
    prefixes: ['ezysplit://', 'https://ezysplit.appaura.xyz/app/'], // note the trailing slash
    config: {
      screens: {
        'Group-Check': {
          path: 'Group-Check/:groupId',
          parse: {
            groupId: id => `${id}`,
          },
        },
        Home: 'home',
        Logout: 'logout',
      },
    },
  };

  const [groupHandled, setGroupHandled] = useState(false);

  useEffect(() => {
    messaging().requestPermission();
    checkPermission();
    messaging().registerDeviceForRemoteMessages();
    Notifications.createChannel();
    Notifications.createExportChannel();
    messaging().onMessage(async remoteMessage => {
      console.log('Received notification:', remoteMessage);
      Toast.show({
        type: 'success',
        text1: remoteMessage.notification.title,
        text2: remoteMessage.notification.body,
      });
    });

    notifee.onForegroundEvent(({type, detail}) => {
      try {
        if (type === EventType.PRESS && detail.pressAction.id === 'open-pdf') {
          const filePath = detail.notification?.data?.filePath;
          Toast.show({
            type: 'info',
            text1: 'Coming Soon!',
            text2: 'Click to open the PDF feature coming soon.',
          });
        }
      } catch (error) {
        console.log('🚀 ~ notifee.onForegroundEvent ~ error:', error);
      }
    });
  }, []);

  useEffect(() => {
    requestUserPermission();

    // Manually check current user on app load
    const currentUser = auth().currentUser;
    if (currentUser) {
      onAuthStateChanged(currentUser);
    }

    // Set up listener for real-time changes
    const unsubscribe = auth().onAuthStateChanged(user => {
      console.log('🚀 ~ unsubscribe ~ user:', user);
      onAuthStateChanged(user);
    });

    return unsubscribe;
  }, []);

  const checkPermission = async () => {
    const settings = await notifee.requestPermission();

    if (settings.authorizationStatus === AuthorizationStatus.DENIED) {
      console.log('User denied permissions request');
    } else if (
      settings.authorizationStatus === AuthorizationStatus.AUTHORIZED
    ) {
      console.log('User granted permissions request');
    } else if (
      settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
    ) {
      console.log('User provisionally granted permissions request');
    }
  };

  const requestUserPermission = async () => {
    const authStatus = await messaging().requestPermission();
    if (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    ) {
      Notifications.createChannel();
      Notifications.createExportChannel();
    }
  };
  // useEffect(() => {
  //   MobileAds().initialize();
  // }, []);

  const onAuthStateChanged = async user => {
    console.log('Inside onAuthStateChanged, user:', user);

    if (user) {
      console.log('if block runing');
      try {
        const token = await messaging().getToken();
        setTimeout(() => {
          setLoading(false);
          setUser(user);
        }, 2500);
        await firestore().collection('Esplitusers').doc(user.uid).set(
          {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            tokens: token,
          },
          {merge: true},
        );

        await AsyncStorage.setItem('userToken', user.uid);

        // Check if the user has already completed group check
      } catch (error) {
        console.error('Error in onAuthStateChanged:', error);
      }
    } else {
      try {
        console.log('else block runing');

        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('lastJoinedGroup');
        setLoading(false);
      } catch (error) {
        console.error('Error in onAuthStateChanged (logout):', error);
      }
    }
  };

  const AfterLogin = () => {
    const navigation = useNavigation();
    const user = useAuthStore(state => state.user);
    const setGroupHandled = useExpenseState(state => state.setGroupHandled);
    const setIncomingDeeplink = useExpenseState(
      state => state.setincomingDeeplink,
    );

    useEffect(() => {
      const handleDeepLink = async url => {
        if (!url) return;

        const match = url.match(/Group-Check\/([^/]+)/);
        const groupId = match?.[1];

        if (groupId) {
          const alreadyHandled = await AsyncStorage.getItem('groupHandled');
          if (!JSON.parse(alreadyHandled)) {
            navigation.navigate('Group-Check', {groupId});
            setGroupHandled(true);
            await AsyncStorage.setItem('groupHandled', JSON.stringify(true));
          }
        }
      };

      const init = async () => {
        if (!user) return;
        const url = await Linking.getInitialURL();
        handleDeepLink(url);
      };

      const listener = Linking.addEventListener('url', ({url}) => {
        if (user) {
          console.log('🚀 ~ listener ~ url:', url);
          AsyncStorage.removeItem('groupHandled');
          setIncomingDeeplink(true);
          handleDeepLink(url);
        }
      });

      init();

      return () => {
        listener.remove();
      };
    }, [user]);

    return (
      <Stack.Navigator screenOptions={{headerShown: false}}>
        <Stack.Screen name="Group-Check" component={GroupManagement} />
        <Stack.Screen name="Home" component={ExpenseTracker} />
        <Stack.Screen name="Logout" component={LogoutScreen} />
      </Stack.Navigator>
    );
  };

  const BeforeLogin = () => (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );

  if (loading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer linking={linking} ref={navigationRef}>
      {user ? <AfterLogin /> : <BeforeLogin />}

      <Toast />
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
