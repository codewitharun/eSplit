import React, {useEffect, useRef, useState} from 'react';
import {Platform, StyleSheet} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {navigationRef} from './src/services/NavigationService';

// Own app version, read straight from package.json - same source
// src/services/appConfig.ts already uses for the force-update check,
// so there's exactly one place this ever needs to be bumped by hand.
const pkg = require('./package.json');

import notifee, {AuthorizationStatus, EventType} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import messaging from '@react-native-firebase/messaging';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import FileViewer from 'react-native-file-viewer';
import AppAlertHost from './src/component/glass/AppAlertHost';
import ForceUpdateGate from './src/component/glass/ForceUpdateGate';
import ToastHost from './src/component/glass/ToastHost';
import MainTabs from './src/navigator/BottomTabNavigator';
import GroupManagement from './src/screens/AfterLogin/GroupCheck';
import LogoutScreen from './src/screens/AfterLogin/Logout';
import LoginScreen from './src/screens/BeforeLogin/Login';
import Notifications from './src/screens/Notifications';
import SplashScreen from './src/screens/Splash';
import {identifyUser, trackScreenView} from './src/services/crashReporting';
import Toast from './src/services/toast';
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
        setTimeout(() => {
          setLoading(false);
          setUser(user);
        }, 2500);

        // Fetching the FCM push token is best-effort and must never block
        // creating this user's core Firestore record. It used to be
        // `await`-ed directly inside this same try block, so on any device
        // where it throws (no Google Play Services, denied notification
        // permission, a flaky network on first launch - all more common
        // among the international users added by the multi-currency
        // rollout) the whole block aborted BEFORE the users/{uid}.set()
        // below ever ran. The result: the account exists in Firebase
        // Auth (so it shows up as a "new user" there) but never gets a
        // Firestore doc, with only a console.error to show for it - no
        // crash, no visible error, nothing in the admin panel. Isolating
        // it in its own try/catch means a token failure just costs that
        // device push notifications, not its entire user record.
        let token = null;
        try {
          token = await messaging().getToken();
        } catch (tokenError) {
          console.error('Error fetching FCM token:', tokenError);
        }

        // New ledger schema (src/services/ledger) - this is what
        // getUserGroups()/useGroups() reads. photoUrl/fcmToken names match
        // the AppUser type; groupIds is left untouched here so an existing
        // membership list from the old flow (or the migration script)
        // survives repeated logins.
        // App/OS version + last-seen, for the admin panel's device view
        // (support: "who's still on 2.0.1?"). Purely additive fields on
        // the same merge write that already runs for every user on every
        // login and every cold launch - no new write, no new listener,
        // and every other field on this doc (groupIds, upiId, ...) is
        // untouched since {merge: true} only overwrites the keys listed
        // here. Existing users just won't have these fields until they
        // next open a build that includes this code.
        const osVersion =
          Platform.OS === 'android'
            ? String(Platform.constants?.Release ?? Platform.Version)
            : String(Platform.Version);

        // fcmToken is only included when the fetch above actually
        // succeeded, so a transient failure on a later login can't wipe
        // out a good token this device already registered previously -
        // {merge: true} simply leaves the existing field untouched.
        const userDoc = {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoUrl: user.photoURL,
          defaultCurrency: 'INR',
          appVersion: pkg.version,
          platform: Platform.OS,
          osVersion,
          lastSeenAt: firestore.FieldValue.serverTimestamp(),
        };
        if (token) {
          userDoc.fcmToken = token;
        }
        await firestore()
          .collection('users')
          .doc(user.uid)
          .set(userDoc, {merge: true});

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
