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
 *  3. Notifee's core AAR ships INSIDE the npm package as a local Maven repo
 *     (node_modules/@notifee/react-native/android/libs). Notifee's own
 *     gradle hook no longer registers it with Gradle 9 / RN 0.86, so the
 *     build fails with "Could not find app.notifee:core:+". Register it in
 *     allprojects.repositories, resolved via node so it works in CI too.
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
  withProjectBuildGradle,
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

const NOTIFEE_MARK = '// @ezysplit-notifee-repo';
const NOTIFEE_REPO = `    ${NOTIFEE_MARK}
    maven {
      url = uri(new File(
        ["node", "--print", "require.resolve('@notifee/react-native/package.json')"]
          .execute(null, rootDir).text.trim()
      ).getParentFile().absolutePath + "/android/libs")
    }
`;

function withNotifeeRepo(config) {
  return withProjectBuildGradle(config, cfg => {
    let g = cfg.modResults.contents;
    if (g.includes(NOTIFEE_MARK)) {
      return cfg;
    }
    const re = /allprojects\s*\{\s*repositories\s*\{/;
    if (!re.test(g)) {
      throw new Error(
        '[withEzySplitAndroid] allprojects.repositories not found in android/build.gradle - update the notifee repo patch.',
      );
    }
    cfg.modResults.contents = g.replace(re, m => `${m}\n${NOTIFEE_REPO}`);
    return cfg;
  });
}

module.exports = function withEzySplitAndroid(config) {
  config = withAndroidManifest(config, cfg => {
    addQueries(cfg.modResults);
    return cfg;
  });
  config = withNotifeeRepo(config);
  return withNotificationIcon(config);
};
