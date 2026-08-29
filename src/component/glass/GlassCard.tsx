// src/component/glass/GlassCard.tsx
// A frosted-glass-styled surface: semi-transparent fill + soft border +
// elevation, built from plain RN View/StyleSheet only. True backdrop blur
// (seeing the background genuinely blurred through the card) needs
// @react-native-community/blur, a native module - left as a documented
// follow-up once the project's native build is healthy again. Visually,
// a translucent surface over the GradientMesh gets most of the way there
// without adding build risk today.
//
// Rendered as two nested Views rather than one: Android's `elevation`
// shadow is drawn from the view's own outline, and when that same view
// also has a semi-transparent background, Android sometimes falls back to
// a square shadow outline instead of a rounded one - the "sharp inner
// rectangle poking out of the rounded card" artifact. Splitting the shadow
// (outer, opaque-shape-only) from the translucent fill + content clipping
// (inner, `overflow: hidden`) fixes that without changing how any caller
// uses the component: incoming `style` is partitioned automatically so
// sizing/position props (margin, width, flex...) land on the outer wrapper
// and everything else (background, padding, flex layout of children...)
// lands on the inner surface that actually clips its content to the
// rounded corners.

import React from 'react';
import {StyleSheet, View, ViewProps, ViewStyle} from 'react-native';
import theme from '../../utils/theme';

interface Props extends ViewProps {
  style?: ViewStyle | ViewStyle[];
  strong?: boolean;
  tilt?: boolean; // subtle 3D tilt, for hero-style cards
  opaque?: boolean; // near-solid fill for modal sheets/dialogs - see theme.color.modalSurface
}

// Props that determine how this card sits inside ITS parent (size,
// position, spacing around it) belong on the outer shadow wrapper.
const OUTER_KEYS = new Set([
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'marginStart',
  'marginEnd',
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'position',
  'top',
  'left',
  'right',
  'bottom',
  'start',
  'end',
  'zIndex',
  'aspectRatio',
  'transform',
]);

// Corner-radius overrides (e.g. a bottom sheet squaring off its bottom
// corners) need to apply to both layers so the shadow's shape always
// matches the visible card's shape.
const RADIUS_KEYS = new Set([
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'borderTopStartRadius',
  'borderTopEndRadius',
  'borderBottomStartRadius',
  'borderBottomEndRadius',
]);

function splitStyle(style?: ViewStyle | ViewStyle[]) {
  const flat = (StyleSheet.flatten(style) || {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  Object.keys(flat).forEach(key => {
    if (RADIUS_KEYS.has(key)) {
      outer[key] = flat[key];
      inner[key] = flat[key];
    } else if (OUTER_KEYS.has(key)) {
      outer[key] = flat[key];
    } else {
      inner[key] = flat[key];
    }
  });
  return {outer: outer as ViewStyle, inner: inner as ViewStyle};
}

const GlassCard: React.FC<Props> = ({
  style,
  strong,
  tilt,
  opaque,
  children,
  ...rest
}) => {
  const {outer, inner} = splitStyle(style);
  const backgroundColor = opaque
    ? theme.color.modalSurface
    : strong
    ? theme.color.surfaceStrong
    : theme.color.surface;

  return (
    <View style={[styles.shadowWrap, tilt && styles.tilt, outer]} {...rest}>
      <View style={[styles.surface, {backgroundColor}, inner]}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  shadowWrap: {
    borderRadius: theme.radius.lg,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowOffset: {width: 0, height: 14},
    shadowRadius: 28,
    elevation: 10,
  },
  surface: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: 16,
    overflow: 'hidden',
  },
  tilt: {
    transform: [{perspective: 900}, {rotateX: '3deg'}, {rotateY: '-4deg'}],
  },
});

export default GlassCard;
