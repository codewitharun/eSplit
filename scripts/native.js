#!/usr/bin/env node
/**
 * One android/ (and one ios/) folder serves BOTH variants - prebuild for
 * one overwrites the other. This wrapper remembers which variant the
 * native folder was generated for (<platform>/.ezysplit-variant) and only
 * re-runs `expo prebuild --clean` when you switch, so:
 *   - switching prod <-> dev can never build with the wrong package /
 *     Firebase file / icon
 *   - repeat runs of the same variant keep Gradle/Xcode caches (fast)
 *
 * usage: node scripts/native.js <android|ios> <prod|dev> [--prebuild-only] [expo run args...]
 */
const {spawnSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const [platform, variantArg, ...rest] = process.argv.slice(2);
if (!['android', 'ios'].includes(platform) || !['prod', 'dev'].includes(variantArg)) {
  console.error('usage: node scripts/native.js <android|ios> <prod|dev> [--prebuild-only] [args]');
  process.exit(1);
}
const prebuildOnly = rest.includes('--prebuild-only');
const runArgs = rest.filter(a => a !== '--prebuild-only');

const root = path.resolve(__dirname, '..');
const nativeDir = path.join(root, platform);
const marker = path.join(nativeDir, '.ezysplit-variant');
const env = {...process.env};
if (variantArg === 'dev') {
  env.APP_VARIANT = 'development';
} else {
  delete env.APP_VARIANT;
}

if (variantArg === 'dev') {
  const file =
    platform === 'android'
      ? 'firebase/dev/google-services.json'
      : 'firebase/dev/GoogleService-Info.plist';
  if (!fs.existsSync(path.join(root, file))) {
    console.error(`\n✖ Missing ${file} - download it from the DEV Firebase project first (see MIGRATION.md).\n`);
    process.exit(1);
  }
}

const run = (args) => {
  const r = spawnSync('npx', args, {cwd: root, env, stdio: 'inherit'});
  if (r.status !== 0) process.exit(r.status ?? 1);
};

const current = fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8').trim() : null;
if (prebuildOnly || current !== variantArg) {
  console.log(
    `\n▶ ${platform}: generating native project for ${variantArg.toUpperCase()}` +
      (current && current !== variantArg ? ` (was ${current})` : '') + '\n',
  );
  run(['expo', 'prebuild', '--platform', platform, '--clean']);
  fs.writeFileSync(marker, variantArg + '\n');
} else {
  console.log(`\n▶ ${platform}: native project already ${variantArg.toUpperCase()} - reusing (fast)\n`);
}

if (!prebuildOnly) {
  run(['expo', `run:${platform}`, ...runArgs]);
}
