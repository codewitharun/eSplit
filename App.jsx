import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {navigationRef} from './src/services/NavigationService';

import notifee, {AuthorizationStatus, EventType} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import messaging from '@react-native-firebase/messaging';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import FileViewer from 'react-native-file-viewer';
import Toast from './src/services/toast';
import ToastHost from './src/component/glass/ToastHost';
import AppAlertHost from './src/component/glass/AppAlertHost';
import ForceUpdateGate from './src/component/glass/ForceUpdateGate';
import {identifyUser, trackScreenView} from './src/services/crashReporting';
import MainTabs from './src/navigator/BottomTabNavigator';
import GroupManagement from './src/screens/AfterLogin/GroupCheck';
import LogoutScreen from './src/screens/AfterLogin/Logout';
import LoginScreen from './src/screens/BeforeLogin/Login';
import Notifications from './src/screens/Notifications';
import SplashScreen from './src/screens/Splash';
import {useAuthStore} from './src/store/useAuthStore';

const App = () => {
  const user = useAuthStore(state => state.user);
  const setUser = useAuthStore(state => state.setUser);

  const [loading, setLoading] = useState(true);
  const Stack = createNativeStackNavigator();
  // Tracks the previously-active screen name so onStateChange below only
  // logs a screen_view when the route actually changed, not on every
  // navigation state update (which fires more often than screens change).
  const routeNameRef = useRef();

  // Deep links (Group-Check/:groupId) are handled entirely by React
  // Navigation's own `linking` mechanism below - it parses the URL into
  // route params on the Group-Check screen itself (see GroupCheck.tsx).
  // This used to be double-handled: a second, hand-rolled
  // `Linking.addEventListener` + AsyncStorage "already handled" flag lived
  // in AfterLogin below, racing against this exact mechanism for the same
  // incoming URL. That was the root cause of deep links intermittently
  // doing nothing when tapped while the app was merely backgrounded on
  // Group-Check (already-mounted screen, stuck de-dupe flag, no remount to
  // reset it) - removed in favor of this single source of truth.
  const linking = {
    prefixes: ['ezysplit://', 'https://ezysplit.arun.codes/app/'], // note the trailing slash
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

    notifee.onForegroundEvent(async ({type, detail}) => {
      try {
        if (type === EventType.PRESS && detail.pressAction.id === 'open-pdf') {
          const filePath = detail.notification?.data?.filePath;
          if (filePath) {
            await FileViewer.open(filePath, {showOpenWithDialog: true});
          }
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
      // console.log('🚀 ~ unsubscribe ~ user:', user);
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
      // console.log('User granted permissions request');
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
    if (user) {
      try {
        const token = await messaging().getToken();
        setTimeout(() => {
          setLoading(false);
          setUser(user);
        }, 2500);
        // New ledger schema (src/services/ledger) - this is what
        // getUserGroups()/useGroups() reads. photoUrl/fcmToken names match
        // the AppUser type; groupIds is left untouched here so an existing
        // membership list from the old flow (or the migration script)
        // survives repeated logins.
        await firestore().collection('users').doc(user.uid).set(
          {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoUrl: user.photoURL,
            defaultCurrency: 'INR',
            fcmToken: token,
          },
          {merge: true},
        );

        await AsyncStorage.setItem('userToken', user.uid);
        identifyUser(user.uid);

        // Check if the user has already completed group check
      } catch (error) {
        console.error('Error in onAuthStateChanged:', error);
      }
    } else {
      try {
        console.log('else block runing');

        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('lastJoinedGroup');
        identifyUser(null);
        setLoading(false);
      } catch (error) {
        console.error('Error in onAuthStateChanged (logout):', error);
      }
    }
  };

  const AfterLogin = () => (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="Group-Check" component={GroupManagement} />
      <Stack.Screen name="Home" component={MainTabs} />
      <Stack.Screen name="Logout" component={LogoutScreen} />
    </Stack.Navigator>
  );

  const BeforeLogin = () => (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );

  if (loading) {
    return (
      <SafeAreaProvider>
        <GestureHandlerRootView style={styles.flex}>
          <SplashScreen />
        </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.flex}>
        <NavigationContainer
          linking={linking}
          ref={navigationRef}
          onReady={() => {
            routeNameRef.current = navigationRef.getCurrentRoute()?.name;
          }}
          onStateChange={() => {
            const previousRouteName = routeNameRef.current;
            const currentRouteName = navigationRef.getCurrentRoute()?.name;
            if (currentRouteName && previousRouteName !== currentRouteName) {
              trackScreenView(currentRouteName);
            }
            routeNameRef.current = currentRouteName;
          }}>
          {user ? <AfterLogin /> : <BeforeLogin />}

          <ToastHost />
        </NavigationContainer>
        <AppAlertHost />
        <ForceUpdateGate />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1},
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
