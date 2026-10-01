// src/component/AddGroupFab.tsx
// Dashboard's (and now the Groups list's) floating "add group" action.
// Originally a small "+" button crammed next to "See All"/the header
// icons, which read as cluttered - now a single floating pill, reachable
// with a thumb from anywhere on either screen, that spends most of its
// time collapsed to a plain icon circle but periodically expands to
// spell out "Add Group" as a label before retracting again - a
// self-reintroducing hint rather than a one-time tooltip. The label is
// laid out immediately after the icon inside a container whose WIDTH is
// what animates (with overflow hidden), so growing/shrinking that width
// reads as the label wiping in/out from behind the icon rather than a
// separate fade - the icon itself never moves.
//
// Originally lived only in GroupCheck.tsx; pulled out into its own file
// once Groups.tsx wanted the same floating button for easier reach,
// rather than a second copy drifting out of sync (timing, sizing) from
// the first one.

import {Plus} from 'lucide-react-native';
import React, {useEffect} from 'react';
import {StyleSheet, TouchableOpacity} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import GradientView from './glass/GradientView';
import {haptics} from '../utils/haptics';
import {BodyFont, moderateScale} from '../utils/fonts';
import theme from '../utils/theme';

export const ADD_GROUP_FAB_HEIGHT = 52;
const ADD_GROUP_FAB_ICON_SIZE = 20;
const ADD_GROUP_FAB_PAD = 16;
const ADD_GROUP_FAB_COLLAPSED_WIDTH =
  ADD_GROUP_FAB_ICON_SIZE + ADD_GROUP_FAB_PAD * 2;
const ADD_GROUP_FAB_EXPANDED_WIDTH = 156;

// How long each state holds and how long the wipe between them takes.
// The first pass (2.6s hold / 320ms wipe / 3.2s hold) read as too fast -
// it kept catching the eye rather than sitting quietly until it's meant
// to remind you it's there. Slower holds and a gentler wipe make it read
// as a calm, periodic breath instead of a flicker.
const HOLD_EXPANDED_MS = 4000;
const COLLAPSE_DURATION_MS = 450;
const HOLD_COLLAPSED_MS = 5000;
const EXPAND_DURATION_MS = 450;

interface Props {
  bottom: number;
  onPress: () => void;
}

const AddGroupFab: React.FC<Props> = ({bottom, onPress}) => {
  // 0 = collapsed (icon only), 1 = expanded (icon + "Add Group" label).
  // Starts expanded so the label is the first thing shown, then cycles
  // collapse -> hold -> expand -> hold, forever.
  const expandProgress = useSharedValue(1);

  useEffect(() => {
    expandProgress.value = withRepeat(
      withSequence(
        withDelay(
          HOLD_EXPANDED_MS,
          withTiming(0, {duration: COLLAPSE_DURATION_MS}),
        ),
        withDelay(
          HOLD_COLLAPSED_MS,
          withTiming(1, {duration: EXPAND_DURATION_MS}),
        ),
      ),
      -1,
      false,
    );
  }, [expandProgress]);

  const widthStyle = useAnimatedStyle(() => ({
    width: interpolate(
      expandProgress.value,
      [0, 1],
      [ADD_GROUP_FAB_COLLAPSED_WIDTH, ADD_GROUP_FAB_EXPANDED_WIDTH],
    ),
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: expandProgress.value,
  }));

  return (
    <Animated.View style={[styles.shadow, {bottom}, widthStyle]}>
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.touchable}
        onPress={() => {
          haptics.tap();
          onPress();
        }}>
        <GradientView
          colors={[theme.color.blueBright, theme.color.green]}
          style={styles.gradient}>
          <Plus size={ADD_GROUP_FAB_ICON_SIZE} color={theme.color.onAccent} />
          <Animated.Text numberOfLines={1} style={[styles.label, labelStyle]}>
            Add Group
          </Animated.Text>
        </GradientView>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  shadow: {
    position: 'absolute',
    right: 20,
    height: ADD_GROUP_FAB_HEIGHT,
    borderRadius: ADD_GROUP_FAB_HEIGHT / 2,
    shadowColor: theme.color.greenBright,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: {width: 0, height: 8},
    elevation: 6,
    overflow: 'hidden',
  },
  touchable: {flex: 1},
  gradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: ADD_GROUP_FAB_PAD,
  },
  label: {
    color: theme.color.onAccent,
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(13.5),
    fontWeight: '700',
    marginLeft: 8,
  },
});

export default AddGroupFab;
