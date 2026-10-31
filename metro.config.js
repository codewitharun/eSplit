// Learn more https://docs.expo.dev/guides/customizing-metro
const {getDefaultConfig} = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Web build only: keep the Firebase login across reloads (see
// src/data/webAuthPersistence.web.js). Android/iOS bundles are untouched.
const RNFB_WEB_AUTH = '@react-native-firebase/app/dist/module/internal/web/firebaseAuth';
const WEB_AUTH_SHIM = path.resolve(__dirname, 'src/data/webAuthPersistence.web.js');

const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === RNFB_WEB_AUTH) {
    return {type: 'sourceFile', filePath: WEB_AUTH_SHIM};
  }
  return (upstreamResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
