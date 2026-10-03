// src/config/appEnv.ts
// Which build variant is running (see app.config.ts). 'development' talks to
// the separate dev Firebase project; 'production' is the live one.
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as {
  appVariant?: 'development' | 'production';
  googleWebClientId?: string;
};

export const APP_VARIANT = extra.appVariant ?? 'production';
export const IS_DEV_VARIANT = APP_VARIANT === 'development';
export const GOOGLE_WEB_CLIENT_ID = extra.googleWebClientId;
