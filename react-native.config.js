// react-native.config.js
// Points react-native-asset (npx react-native-asset) at the Sora/Manrope/
// JetBrains Mono static font files so it can link them into both native
// projects: copies each .ttf into android/app/src/main/assets/fonts/ and
// adds each to the iOS project's Copy Bundle Resources phase + Info.plist
// UIAppFonts. See src/utils/fonts.tsx for where these are referenced by
// their PostScript name (which matches each file's name, minus .ttf).
module.exports = {
  assets: ['./src/assets/fonts'],
};
