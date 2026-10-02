import 'react-native-gesture-handler';
import {registerRootComponent} from 'expo';

import App from './App';
import {registerBackgroundPushHandler} from './src/data/push';

// FCM headless handler: must be registered outside React, before mount.
registerBackgroundPushHandler();

// registerRootComponent -> AppRegistry.registerComponent('main', () => App)
registerRootComponent(App);
