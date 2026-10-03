// src/component/glass/GradientView.tsx
// Linear-gradient background, now a thin wrapper over expo-linear-gradient
// (a native view). Same props as before - colors / locations / start / end
// as 0..1 fractions, e.g. {x: 0, y: 0} -> {x: 1, y: 1} = top-left to
// bottom-right - so no call site changes.
//
// Why native instead of the old react-native-svg version: the SVG had to be
// sized to the view, either from onLayout (lags when the size is animated on
// the UI thread - the half-filled "Add expense" pill) or as width="100%"
// (not resolved reliably on the New Architecture - buttons only half
// painted). A native gradient view stretches with its box on every frame.
// (The old reason to avoid a native gradient module - the fragile CLI
// Gradle build - doesn't apply under Expo.)
//
// Usage: wrap content the way you would a <View> -
//   <GradientView colors={theme.gradient.hero} style={styles.card}>
//     <Text>...</Text>
//   </GradientView>
import {LinearGradient} from 'expo-linear-gradient';
import React from 'react';
import type {ColorValue, StyleProp, ViewProps, ViewStyle} from 'react-native';

interface Point {
  x: number;
  y: number;
}

interface Props extends ViewProps {
  colors: string[];
  locations?: number[];
  start?: Point;
  end?: Point;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

type GradientColors = readonly [ColorValue, ColorValue, ...ColorValue[]];
type GradientLocations = readonly [number, number, ...number[]];

const GradientView: React.FC<Props> = ({
  colors,
  locations,
  start = {x: 0, y: 0},
  end = {x: 1, y: 1},
  style,
  children,
  ...rest
}) => {
  // expo-linear-gradient needs at least two stops; a single colour is just
  // a flat fill.
  const stops = (colors.length >= 2
    ? colors
    : [colors[0], colors[0]]) as unknown as GradientColors;
  const locs =
    locations && locations.length === stops.length
      ? (locations as unknown as GradientLocations)
      : undefined;

  return (
    <LinearGradient
      colors={stops}
      locations={locs}
      start={start}
      end={end}
      style={style}
      {...rest}>
      {children}
    </LinearGradient>
  );
};

export default GradientView;
