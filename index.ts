// FIRST: on web this initializes Firebase (bootstrap.web.ts); no-op on native.
import './src/data/bootstrap';
import 'react-native-gesture-handler';
import {registerRootComponent} from 'expo';

import App from './App';
import {registerBackgroundPushHandler} from './src/data/push';

// FCM headless handler: must be registered outside React, before mount.
registerBackgroundPushHandler();

// registerRootComponent -> AppRegistry.registerComponent('main', () => App)
registerRootComponent(App);
