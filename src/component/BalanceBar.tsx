// src/component/BalanceBar.tsx
// Diverging bar for one member's net balance: a neutral centre line, a
// green bar growing right when they're owed, rose growing left when they
// owe, scaled against the group's largest absolute balance. Always shown
// next to the signed amount text, so colour is never the only cue.

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
  maxAbs: number;
  delay?: number;
}

const BalanceBar: React.FC<Props> = ({value, maxAbs, delay = 0}) => {
  const ratio = maxAbs > 0 ? Math.min(Math.abs(value) / maxAbs, 1) : 0;
  const grow = useSharedValue(0);

  useEffect(() => {
    grow.value = withDelay(delay, withTiming(ratio, {duration: 700}));
  }, [ratio, delay, grow]);

  const barStyle = useAnimatedStyle(() => ({width: `${grow.value * 50}%`}));
  const positive = value >= 0;

  return (
    <View style={styles.track}>
      <View style={styles.centre} />
      {Math.abs(value) >= 0.01 && (
        <Animated.View
          style={[
            styles.bar,
            positive ? styles.right : styles.left,
            {backgroundColor: positive ? theme.color.green : theme.color.rose},
            barStyle,
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  centre: {
    position: 'absolute',
    left: '50%',
    width: 1,
    height: '100%',
    backgroundColor: theme.color.borderStrong,
  },
  bar: {position: 'absolute', height: '100%'},
  right: {left: '50%', borderTopRightRadius: 4, borderBottomRightRadius: 4},
  left: {right: '50%', borderTopLeftRadius: 4, borderBottomLeftRadius: 4},
});

export default BalanceBar;
