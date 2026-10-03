/**
 * Release + debug signing for the generated android/ project (CNG).
 *
 * Release (Play upload key, same as the CLI app) - first match wins:
 *   1. CI env: ANDROID_KEYSTORE_PATH / ANDROID_KEYSTORE_PASSWORD /
 *      ANDROID_KEY_ALIAS / ANDROID_KEY_PASSWORD  (GitHub Actions secrets)
 *   2. credentials/signing.properties (MYAPP_UPLOAD_* keys, git-ignored)
 *   3. neither -> release builds fall back to debug signing (Play rejects
 *      those, so you can't accidentally upload one).
 *
 * Debug: credentials/debug.keystore if present - the SAME debug key the
 * CLI app used, whose SHA-1 is already registered in Firebase, so Google
 * Sign-In keeps working in dev builds. Falls back to Expo's own key.
 */
const {withAppBuildGradle} = require('expo/config-plugins');

const MARK = '// @ezysplit-signing';

const HEADER = `${MARK}
def ezyCredDir = new File(rootDir, "../credentials")
def ezySigning = new Properties()
def ezySigningFile = new File(ezyCredDir, "signing.properties")
if (ezySigningFile.exists()) { ezySigningFile.withInputStream { ezySigning.load(it) } }
def ezyDebugKeystore = new File(ezyCredDir, "debug.keystore")
def ezyHasRelease = System.getenv("ANDROID_KEYSTORE_PATH") || ezySigning['MYAPP_UPLOAD_STORE_FILE']

`;

const RELEASE_CONFIG = `
        release {
            if (System.getenv("ANDROID_KEYSTORE_PATH")) {
                storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            } else if (ezySigning['MYAPP_UPLOAD_STORE_FILE']) {
                storeFile new File(ezyCredDir, ezySigning['MYAPP_UPLOAD_STORE_FILE'])
                storePassword ezySigning['MYAPP_UPLOAD_STORE_PASSWORD']
                keyAlias ezySigning['MYAPP_UPLOAD_KEY_ALIAS']
                keyPassword ezySigning['MYAPP_UPLOAD_KEY_PASSWORD']
            }
        }`;

function patch(gradle) {
  if (gradle.includes(MARK)) {
    return gradle;
  }
  const fail = what => {
    throw new Error(
      `[withEzySplitSigning] Could not find ${what} in android/app/build.gradle - the Expo template changed; update plugins/withEzySplitSigning.js.`,
    );
  };

  if (!/\nandroid\s*\{/.test(gradle)) fail('"android {"');
  gradle = gradle.replace(/\nandroid\s*\{/, `\n${HEADER}android {`);

  const debugStore = /storeFile file\('debug\.keystore'\)/;
  if (!debugStore.test(gradle)) fail("storeFile file('debug.keystore')");
  gradle = gradle.replace(
    debugStore,
    "storeFile(ezyDebugKeystore.exists() ? ezyDebugKeystore : file('debug.keystore'))",
  );

  const sc = /signingConfigs\s*\{/;
  if (!sc.test(gradle)) fail('"signingConfigs {"');
  gradle = gradle.replace(sc, m => m + RELEASE_CONFIG);

  // buildTypes.release: the template signs release with the debug key.
  const bt = gradle.indexOf('buildTypes');
  if (bt < 0) fail('"buildTypes"');
  const rel = gradle.indexOf('release', bt);
  const target = 'signingConfig signingConfigs.debug';
  const at = rel < 0 ? -1 : gradle.indexOf(target, rel);
  if (at < 0) fail('release signingConfig');
  gradle =
    gradle.slice(0, at) +
    'signingConfig ezyHasRelease ? signingConfigs.release : signingConfigs.debug' +
    gradle.slice(at + target.length);
  return gradle;
}

module.exports = function withEzySplitSigning(config) {
  return withAppBuildGradle(config, cfg => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('[withEzySplitSigning] expected a Groovy build.gradle');
    }
    cfg.modResults.contents = patch(cfg.modResults.contents);
    return cfg;
  });
};
module.exports.patch = patch;
