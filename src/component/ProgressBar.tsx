// src/component/ProgressBar.tsx
// Thin animated fill bar (0-1), used for "settle-up progress" on Balances.

import React, {useEffect} from 'react';
import {StyleSheet, View} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import theme from '../utils/theme';

interface Props {
  value: number;
  color?: string;
  delay?: number;
}

const ProgressBar: React.FC<Props> = ({
  value,
  color = theme.color.teal,
  delay = 150,
}) => {
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withDelay(
      delay,
      withTiming(Math.max(0, Math.min(value, 1)), {duration: 800}),
    );
  }, [value, delay, fill]);
  const style = useAnimatedStyle(() => ({width: `${fill.value * 100}%`}));
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, {backgroundColor: color}, style]} />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  fill: {height: '100%', borderRadius: 3},
});

export default ProgressBar;
