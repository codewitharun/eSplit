/**
 * Local config plugin: carries the hand-written AndroidManifest bits from the
 * old ESplit_App android/ folder into Expo's generated (CNG) android/ project.
 *
 *  1. <queries> so Linking/Sharing can see WhatsApp + PDF/XLSX viewers (Android 11+).
 *  2. Status-bar notification icon: copies assets/notification-icon/<dpi>.png
 *     to res/drawable-<dpi>/notification_icon.png and defines
 *     @color/notification_icon_color. The RNFirebase messaging plugin points
 *     FCM's default_notification_icon/color at these (it doesn't create
 *     them), and notifee uses smallIcon 'notification_icon'.
 *
 * (The old AD_SERVICES_CONFIG tools:replace fix is gone: it only existed for
 *  the firebase-analytics vs google-mobile-ads collision, and AdMob was never
 *  used in code, so the package was dropped from the Expo build.)
 */
const fs = require('fs');
const path = require('path');
const {
  withAndroidColors,
  withAndroidManifest,
  withDangerousMod,
} = require('expo/config-plugins');

const QUERY_INTENTS = [
  {action: 'android.intent.action.VIEW', data: {'android:mimeType': 'application/pdf'}},
  {
    action: 'android.intent.action.VIEW',
    data: {'android:mimeType': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},
  },
  {action: 'android.intent.action.VIEW', data: {'android:scheme': 'whatsapp'}},
  {action: 'android.intent.action.SEND', data: {'android:mimeType': 'text/plain'}},
];

function addQueries(manifest) {
  const root = manifest.manifest;
  root.queries = root.queries || [{}];
  const q = root.queries[0];
  q.intent = q.intent || [];
  const has = (a, d) =>
    q.intent.some(
      i =>
        i.action?.[0]?.$?.['android:name'] === a &&
        JSON.stringify(i.data?.[0]?.$ || {}) === JSON.stringify(d),
    );
  for (const {action, data} of QUERY_INTENTS) {
    if (!has(action, data)) {
      q.intent.push({action: [{$: {'android:name': action}}], data: [{$: data}]});
    }
  }
  q.package = q.package || [];
  if (!q.package.some(p => p.$['android:name'] === 'com.whatsapp')) {
    q.package.push({$: {'android:name': 'com.whatsapp'}});
  }
}

const NOTIFICATION_COLOR = '#3ECF8E';
const DPIS = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];

function withNotificationIcon(config) {
  config = withDangerousMod(config, [
    'android',
    async cfg => {
      const root = cfg.modRequest.projectRoot;
      const res = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/res');
      for (const dpi of DPIS) {
        const dir = path.join(res, `drawable-${dpi}`);
        fs.mkdirSync(dir, {recursive: true});
        fs.copyFileSync(
          path.join(root, 'assets/notification-icon', `${dpi}.png`),
          path.join(dir, 'notification_icon.png'),
        );
      }
      return cfg;
    },
  ]);
  return withAndroidColors(config, cfg => {
    const colors = cfg.modResults.resources;
    colors.color = (colors.color || []).filter(
      c => c.$.name !== 'notification_icon_color',
    );
    colors.color.push({$: {name: 'notification_icon_color'}, _: NOTIFICATION_COLOR});
    return cfg;
  });
}

module.exports = function withEzySplitAndroid(config) {
  config = withAndroidManifest(config, cfg => {
    addQueries(cfg.modResults);
    return cfg;
  });
  return withNotificationIcon(config);
};
