import React, {useEffect, useRef, useState} from 'react';
import {Platform, StyleSheet, Text, TextInput} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {navigationRef} from './src/services/NavigationService';
import {BodyFont} from './src/utils/fonts';

// Global font default: any <Text>/<TextInput> that doesn't explicitly
// spread a Typography.* preset (see src/utils/fonts.tsx) still gets the
// app's real body typeface instead of silently falling back to the
// system font. Typography.* presets still win wherever they're used -
// this only fills the gaps.
Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.style = [
  {fontFamily: BodyFont.regular},
  Text.defaultProps.style,
];
TextInput.defaultProps = TextInput.defaultProps || {};
TextInput.defaultProps.style = [
  {fontFamily: BodyFont.regular},
  TextInput.defaultProps.style,
];

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
import CreateJoinGroup from './src/screens/AfterLogin/CreateJoinGroup';
import GroupManagement from './src/screens/AfterLogin/GroupCheck';
import LogoutScreen from './src/screens/AfterLogin/Logout';
import NotificationsScreen from './src/screens/AfterLogin/NotificationsScreen';
import ProfileScreen from './src/screens/AfterLogin/Profile';
import LoginScreen from './src/screens/BeforeLogin/Login';
import OnboardingScreen from './src/screens/BeforeLogin/Onboarding';
import Notifications from './src/screens/Notifications';
import SplashScreen from './src/screens/Splash';
import {identifyUser, trackScreenView} from './src/services/crashReporting';
import {handleNotificationTap} from './src/services/notificationNavigation';
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
  // Set once by getInitialNotification() below if the app was launched
  // (cold start, previously killed) by tapping a notification. It can't
  // navigate the instant it's known - NavigationContainer isn't mounted
  // yet at that point (still on SplashScreen, possibly still signing the
  // user back in) - so it's read and cleared inside onReady() instead,
  // once a navigator actually exists to receive the navigate() call.
  const pendingNotificationDataRef = useRef(null);

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

    // Each of these three registers a listener that lives for as long as
    // the app does - fine for a real launch (this effect only ever runs
    // once), but during development, Fast Refresh can re-run this effect
    // on a hot reload without the app actually restarting. Without
    // unsubscribing, that stacks a second, third, ... copy of the same
    // listener on top of the previous ones, so a single incoming push
    // gets logged/handled multiple times (harmless, but noisy and
    // confusing to debug against). Capturing and calling their
    // unsubscribe functions on cleanup keeps it to exactly one listener
    // of each kind, in dev or in production.
    const unsubscribeOnMessage = messaging().onMessage(async remoteMessage => {
      console.log('Received notification:', remoteMessage);
      if (remoteMessage.data && remoteMessage.data.type) {
        // A notification carrying a `type` (currently just the
        // join-approval flow) gets a real, tappable system notification
        // instead of a Toast - a Toast disappears on its own and can't
        // be tapped, so there'd be no way to act on "someone wants to
        // join" without hunting for the group manually. Every other
        // notification (every existing expense-added / plain join
        // notification, none of which send `data`) keeps the exact
        // Toast-only behavior this app already had.
        try {
          await Notifications.displayDataNotification({
            title: remoteMessage.notification?.title,
            body: remoteMessage.notification?.body,
            data: remoteMessage.data,
          });
        } catch (error) {
          console.log('🚀 ~ displayDataNotification ~ error:', error);
        }
      } else {
        Toast.show({
          type: 'success',
          text1: remoteMessage.notification.title,
          text2: remoteMessage.notification.body,
        });
      }
    });

    // Backgrounded: the app is already running (just not in front), and
    // the OS displayed the notification itself from the push's own
    // `notification` payload - this only needs to catch the tap once the
    // user brings the app back to the foreground because of it.
    const unsubscribeOpenedApp = messaging().onNotificationOpenedApp(
      remoteMessage => {
        handleNotificationTap(remoteMessage?.data);
      },
    );

    // Killed: the app wasn't running at all, and this exact tap is what
    // launched it - there's no live listener to have caught it, so it has
    // to be recovered once on this cold start instead. Stashed in a ref
    // rather than acted on immediately: see pendingNotificationDataRef's
    // comment for why this can't navigate yet. A one-shot promise, not a
    // subscription, so there's nothing here to unsubscribe.
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage?.data) {
          pendingNotificationDataRef.current = remoteMessage.data;
        }
      });

    const unsubscribeForegroundEvent = notifee.onForegroundEvent(
      async ({type, detail}) => {
        try {
          if (type !== EventType.PRESS) {
            return;
          }
          if (detail.pressAction.id === 'open-pdf') {
            const filePath = detail.notification?.data?.filePath;
            if (filePath) {
              await FileViewer.open(filePath, {showOpenWithDialog: true});
            }
          } else if (detail.pressAction.id === 'join-notification') {
            await handleNotificationTap(detail.notification?.data);
          }
        } catch (error) {
          console.log('🚀 ~ notifee.onForegroundEvent ~ error:', error);
        }
      },
    );

    return () => {
      unsubscribeOnMessage();
      unsubscribeOpenedApp();
      unsubscribeForegroundEvent();
    };
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

    // Safety net: `loading` only ever flips to false from inside
    // onAuthStateChanged above, so if that listener is ever late to fire
    // its first event - observed after a JS-only reload (Fast Refresh /
    // Metro "r"), as opposed to fully closing and relaunching the app,
    // which reliably worked - the app is stuck on the splash screen
    // forever with nothing left to trigger it. The try/finally fix
    // earlier only guarded against the callback THROWING; it can't help
    // when the callback simply never runs. This forces past the splash
    // screen after a few seconds no matter what, defaulting to
    // signed-out (Login screen) if the real check still hasn't reported
    // in - safe, since signing in from there re-runs the real auth flow
    // regardless. It's a no-op on the normal path: setLoading(false) is
    // already false by the time this fires almost every time.
    const splashTimeout = setTimeout(() => {
      setLoading(false);
    }, 4000);

    return () => {
      unsubscribe();
      clearTimeout(splashTimeout);
    };
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
      // setLoading(false) used to be the last line INSIDE this try block,
      // after two awaited AsyncStorage calls - if either of those ever
      // threw (a transient native-bridge hiccup right after a JS reload
      // is a common trigger), execution jumped straight to the catch
      // below and setLoading(false) never ran, leaving `loading` stuck
      // true forever: the app never gets past the splash screen for a
      // signed-out user. This is the "not logged in, reload the app, now
      // it's stuck on splash" bug - moved to `finally` so it always runs,
      // whether or not the AsyncStorage cleanup above succeeded.
      try {
        console.log('else block runing');

        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('lastJoinedGroup');
        identifyUser(null);
      } catch (error) {
        console.error('Error in onAuthStateChanged (logout):', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const AfterLogin = () => (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="Group-Check" component={GroupManagement} />
      <Stack.Screen name="CreateJoinGroup" component={CreateJoinGroup} />
      <Stack.Screen name="Home" component={MainTabs} />
      {/* Reached by tapping the avatar in the dashboard header
          (src/component/header/index.tsx) - identity + logout + delete
          account, scoped to the signed-in person, not any one group. */}
      <Stack.Screen name="Profile" component={ProfileScreen} />
      {/* Reached by tapping the bell in the dashboard header, or by
          tapping a "someone wants to join" push - join requests,
          announcements and admin-sent personal messages, not group
          activity (see NotificationsScreen.tsx's own header comment). */}
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Logout" component={LogoutScreen} />
    </Stack.Navigator>
  );

  const BeforeLogin = () => (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      {/* First screen by default (React Navigation's initial route is
          whichever Screen is listed first) - Onboarding.tsx itself checks
          AsyncStorage and immediately replaces itself with Login for
          anyone who's already been through it, so this only actually
          shows once per install. */}
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
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
            if (pendingNotificationDataRef.current) {
              const data = pendingNotificationDataRef.current;
              pendingNotificationDataRef.current = null;
              handleNotificationTap(data);
            }
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
