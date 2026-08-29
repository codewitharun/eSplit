// src/component/glass/SwipeableRow.tsx
// Swipe-left-to-reveal-an-action row, built on gesture-handler + reanimated
// (both already project dependencies). Used for "settle" on a balance row
// and "edit/delete" on an expense row.

import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {haptics} from '../../utils/haptics';
import theme from '../../utils/theme';

const ACTION_WIDTH = 84;

interface Props {
  children: React.ReactNode;
  actionLabel: string;
  actionColor?: string;
  onAction: () => void;
}

const SwipeableRow: React.FC<Props> = ({
  children,
  actionLabel,
  actionColor,
  onAction,
}) => {
  const translateX = useSharedValue(0);
  const revealed = useSharedValue(false);

  const triggerHaptic = () => haptics.tap();

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate(e => {
      const next = Math.min(
        0,
        Math.max(
          -ACTION_WIDTH,
          e.translationX + (revealed.value ? -ACTION_WIDTH : 0),
        ),
      );
      translateX.value = next;
    })
    .onEnd(() => {
      const shouldReveal = translateX.value < -ACTION_WIDTH / 2;
      revealed.value = shouldReveal;
      translateX.value = withSpring(shouldReveal ? -ACTION_WIDTH : 0, {
        damping: 18,
      });
      if (shouldReveal) {
        runOnJS(triggerHaptic)();
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{translateX: translateX.value}],
  }));

  const actionStyle = useAnimatedStyle(() => ({
    opacity: withTiming(translateX.value < -8 ? 1 : 0, {duration: 120}),
  }));

  const handlePress = () => {
    translateX.value = withSpring(0, {damping: 18});
    revealed.value = false;
    onAction();
  };

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.actionContainer, actionStyle]}>
        <TouchableOpacity
          style={[
            styles.action,
            {backgroundColor: actionColor || theme.color.green},
          ]}
          onPress={handlePress}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {position: 'relative'},
  actionContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  action: {
    width: ACTION_WIDTH - 12,
    height: '82%',
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    color: theme.color.onAccent,
    fontWeight: '700',
    fontSize: 12.5,
  },
});

export default SwipeableRow;
