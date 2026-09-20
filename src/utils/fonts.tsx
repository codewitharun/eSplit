// src/utils/fonts.tsx
//
// Single source of truth for EzySplit's typography. Nothing else in the
// app should hardcode a font family, a raw fontSize number, or a
// lineHeight - it should import from here instead.
//
// Typeface: Sora (display - headings, big numbers, avatar initials) +
// Manrope (body - everything else) + JetBrains Mono (join codes / meta
// text), matching the approved web mockup's --font-display/--font-body/
// --font-mono choices exactly. Linked as static per-weight .ttf files
// under src/assets/fonts/ (see react-native.config.js), instantiated from
// Google's variable-font sources with fonttools since neither family
// ships static per-weight files upstream. Referenced below by each
// file's exact PostScript name, which matches its filename.
//
// "Responsive": sizes are computed from the device's own width against a
// reference phone width, then clamped so a small phone doesn't get
// illegibly tiny text and a tablet doesn't get comically large text. This
// is a small self-contained version of the "moderate scale" pattern
// (react-native-size-matters does the same thing) - no new dependency.

import {Dimensions, PixelRatio} from 'react-native';

// ---------------------------------------------------------------------------
// Responsive scaling
// ---------------------------------------------------------------------------

// iPhone 11/XR-class width - the size most of the app's UI was designed
// against. Scaling is relative to this, not to any single "standard".
const BASE_WIDTH = 375;

function currentWindowWidth(): number {
  // Dimensions.get is cheap and always current - safe to call per-render,
  // no need to cache/subscribe for a text-size utility.
  const {width} = Dimensions.get('window');
  return width || BASE_WIDTH;
}

/**
 * Scales `size` by how much wider/narrower this device is than the
 * reference width, but only applies a fraction (`factor`) of that
 * difference - a pure linear scale makes text on a tablet absurdly big.
 * factor 0.5 (default) means a 20% wider screen only grows text by ~10%.
 * Result is clamped to +/-35% of the input so nothing goes illegible or
 * cartoonish on extreme screen sizes, then rounded to the nearest pixel.
 */
export function moderateScale(size: number, factor = 0.5): number {
  const ratio = currentWindowWidth() / BASE_WIDTH;
  const scaled = size + (size * ratio - size) * factor;
  const min = size * 0.65;
  const max = size * 1.35;
  const clamped = Math.min(Math.max(scaled, min), max);
  return PixelRatio.roundToNearestPixel(clamped);
}

// ---------------------------------------------------------------------------
// Font families - two families by ROLE (display vs body), each with its
// own weight ladder, plus one mono face. Every value below is the exact
// PostScript name baked into its linked .ttf (src/assets/fonts/), which
// is what iOS's font system requires to resolve a custom typeface; on
// Android the same string doubles as the linked file's name, so one set
// of constants covers both platforms - no more Platform.select needed.
// ---------------------------------------------------------------------------

export const DisplayFont = {
  regular: 'Sora-Regular',
  semibold: 'Sora-SemiBold',
  bold: 'Sora-Bold',
  extrabold: 'Sora-ExtraBold',
};

export const BodyFont = {
  regular: 'Manrope-Regular',
  medium: 'Manrope-Medium',
  semibold: 'Manrope-SemiBold',
  bold: 'Manrope-Bold',
  extrabold: 'Manrope-ExtraBold',
};

// Join codes, timestamps, and other code-like meta text - matches the
// mockup's --font-mono usage (.g-meta, .code-input, etc).
export const MonoFont = 'JetBrainsMono-Medium';

// ---------------------------------------------------------------------------
// Font sizes - named roles, each responsive via moderateScale
// ---------------------------------------------------------------------------

export const FontSize = {
  caption: moderateScale(12),
  small: moderateScale(13),
  body: moderateScale(15),
  bodyLarge: moderateScale(16),
  subtitle: moderateScale(18),
  title: moderateScale(22),
  headline: moderateScale(26),
  display: moderateScale(34),
  hero: moderateScale(42),
};

export const LineHeight = {
  caption: moderateScale(16),
  small: moderateScale(18),
  body: moderateScale(21),
  bodyLarge: moderateScale(22),
  subtitle: moderateScale(24),
  title: moderateScale(28),
  headline: moderateScale(32),
  display: moderateScale(40),
  hero: moderateScale(48),
};

// ---------------------------------------------------------------------------
// Composed presets - what screens should actually import and spread onto
// a <Text> style. Keeps every headline/body/caption in the app visually
// consistent, and means a font swap or a size-scale tweak happens once,
// here, instead of hunting through every screen.
//
// Family/weight per role mirrors how the mockup actually uses Sora vs
// Manrope: anything heading- or number-like (hero amounts, stat values,
// section titles, the header greeting, avatar initials) is Sora; plain
// paragraph/label/button text is Manrope.
// ---------------------------------------------------------------------------

export interface TextPreset {
  fontFamily?: string;
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700' | '800';
  letterSpacing?: number;
}

export const Typography: Record<string, TextPreset> = {
  // Big hero numbers - the "position" amount on the dashboard card, the
  // total on a receipt-style screen.
  hero: {
    fontFamily: DisplayFont.extrabold,
    fontSize: FontSize.hero,
    lineHeight: LineHeight.hero,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  display: {
    fontFamily: DisplayFont.bold,
    fontSize: FontSize.display,
    lineHeight: LineHeight.display,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headline: {
    fontFamily: DisplayFont.bold,
    fontSize: FontSize.headline,
    lineHeight: LineHeight.headline,
    fontWeight: '700',
  },
  title: {
    fontFamily: DisplayFont.bold,
    fontSize: FontSize.title,
    lineHeight: LineHeight.title,
    fontWeight: '700',
  },
  subtitle: {
    fontFamily: DisplayFont.bold,
    fontSize: FontSize.subtitle,
    lineHeight: LineHeight.subtitle,
    fontWeight: '700',
  },
  bodyLarge: {
    fontFamily: BodyFont.regular,
    fontSize: FontSize.bodyLarge,
    lineHeight: LineHeight.bodyLarge,
    fontWeight: '400',
  },
  body: {
    fontFamily: BodyFont.regular,
    fontSize: FontSize.body,
    lineHeight: LineHeight.body,
    fontWeight: '400',
  },
  bodyMedium: {
    fontFamily: BodyFont.medium,
    fontSize: FontSize.body,
    lineHeight: LineHeight.body,
    fontWeight: '500',
  },
  bodySemibold: {
    fontFamily: BodyFont.semibold,
    fontSize: FontSize.body,
    lineHeight: LineHeight.body,
    fontWeight: '600',
  },
  small: {
    fontFamily: BodyFont.regular,
    fontSize: FontSize.small,
    lineHeight: LineHeight.small,
    fontWeight: '400',
  },
  caption: {
    fontFamily: BodyFont.medium,
    fontSize: FontSize.caption,
    lineHeight: LineHeight.caption,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  overline: {
    fontFamily: BodyFont.semibold,
    fontSize: FontSize.caption,
    lineHeight: LineHeight.caption,
    fontWeight: '600',
    letterSpacing: 1.1,
  },
  button: {
    fontFamily: BodyFont.extrabold,
    fontSize: FontSize.bodyLarge,
    lineHeight: LineHeight.bodyLarge,
    fontWeight: '800',
  },
};

export default Typography;
