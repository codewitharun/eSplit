// src/component/glass/GradientView.tsx
// A reusable linear-gradient background, built on react-native-svg (an
// existing dependency) instead of react-native-linear-gradient/
// expo-linear-gradient (neither is installed, and adding either means a
// new native module + Gradle changes, which this project's build has
// historically been fragile around - see GradientMesh.tsx for the same
// reasoning applied to the radial glow).
//
// API deliberately mirrors react-native-linear-gradient's shape (colors/
// start/end/locations) so it reads familiar and is a drop-in if a native
// gradient library is ever added later - `start`/`end` are 0..1 fractions
// of the box, e.g. {x: 0, y: 0} -> {x: 1, y: 1} is top-left to
// bottom-right.
//
// Usage: wrap content the way you would a <View> -
//   <GradientView colors={theme.gradient.hero} style={styles.card}>
//     <Text>...</Text>
//   </GradientView>

import React, {useState} from 'react';
import {
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';

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

let gradientIdCounter = 0;

const GradientView: React.FC<Props> = ({
  colors,
  locations,
  start = {x: 0, y: 0},
  end = {x: 1, y: 1},
  style,
  children,
  ...rest
}) => {
  // A stable-per-mount id avoids gradient defs colliding when several
  // GradientViews render at once (each needs its own <Defs> id).
  const [id] = useState(() => `gv-grad-${++gradientIdCounter}`);
  const [size, setSize] = useState({width: 0, height: 0});

  const onLayout = (e: LayoutChangeEvent) => {
    const {width, height} = e.nativeEvent.layout;
    setSize({width, height});
  };

  return (
    <View style={style} onLayout={onLayout} {...rest}>
      {size.width > 0 && size.height > 0 && (
        <Svg
          width={size.width}
          height={size.height}
          style={StyleSheet.absoluteFill}
          pointerEvents="none">
          <Defs>
            <LinearGradient
              id={id}
              x1={`${start.x * 100}%`}
              y1={`${start.y * 100}%`}
              x2={`${end.x * 100}%`}
              y2={`${end.y * 100}%`}>
              {colors.map((c, i) => (
                <Stop
                  key={c + i}
                  offset={
                    locations && locations[i] !== undefined
                      ? locations[i]
                      : i / Math.max(colors.length - 1, 1)
                  }
                  stopColor={c}
                  stopOpacity={1}
                />
              ))}
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${id})`} />
        </Svg>
      )}
      {children}
    </View>
  );
};

export default GradientView;
