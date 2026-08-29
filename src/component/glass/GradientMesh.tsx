// src/component/glass/GradientMesh.tsx
// The soft multi-color glow behind every glass surface - now tuned to the
// app icon's blue-ground/green-mascot palette instead of the earlier
// violet placeholder. Built with react-native-svg (already a project
// dependency) instead of react-native-linear-gradient, so this needs no
// new native module.

import React from 'react';
import {StyleSheet, View, ViewStyle} from 'react-native';
import Svg, {Defs, RadialGradient, Rect, Stop} from 'react-native-svg';
import theme from '../../utils/theme';

interface Props {
  style?: ViewStyle;
}

const GradientMesh: React.FC<Props> = ({style}) => (
  <View style={[styles.container, style]} pointerEvents="none">
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="blueGlow" cx="10%" cy="0%" r="72%">
          <Stop
            offset="0"
            stopColor={theme.color.blueStrong}
            stopOpacity={0.5}
          />
          <Stop offset="1" stopColor={theme.color.blueStrong} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="greenGlow" cx="100%" cy="8%" r="60%">
          <Stop offset="0" stopColor={theme.color.green} stopOpacity={0.3} />
          <Stop offset="1" stopColor={theme.color.green} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="deepGlow" cx="50%" cy="115%" r="70%">
          <Stop offset="0" stopColor={theme.color.blue} stopOpacity={0.18} />
          <Stop offset="1" stopColor={theme.color.blue} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={theme.color.ground} />
      <Rect width="100%" height="100%" fill="url(#blueGlow)" />
      <Rect width="100%" height="100%" fill="url(#greenGlow)" />
      <Rect width="100%" height="100%" fill="url(#deepGlow)" />
    </Svg>
  </View>
);

const styles = StyleSheet.create({
  container: {...StyleSheet.absoluteFillObject},
});

export default GradientMesh;
