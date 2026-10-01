// src/component/AddGroupFab.tsx
// Floating "New group" action on the dashboard and the Groups list.
//
// UX: this used to be the SAME blue->green gradient "+" circle as the
// in-group "add expense" button (and spent most of its time collapsed to
// that bare circle), so users couldn't tell which one they were looking
// at. The app's create actions now follow one rule:
//   - filled blue->green pill  = adds money   ("Add expense", primary)
//   - outlined dark-glass pill = organises    ("New group", secondary)
// each with its own icon and an always-visible label. Creating a group is
// rare compared to adding expenses, so this one is deliberately the
// quieter of the two. Same export names/height as before, so callers
// didn't need to change.

import {UsersRound} from 'lucide-react-native';
import React from 'react';
import {StyleSheet, Text, TouchableOpacity} from 'react-native';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {haptics} from '../utils/haptics';
import {BodyFont, moderateScale} from '../utils/fonts';
import theme from '../utils/theme';

export const ADD_GROUP_FAB_HEIGHT = 50;

interface Props {
  bottom: number;
  onPress: () => void;
}

const AddGroupFab: React.FC<Props> = ({bottom, onPress}) => (
  <Animated.View
    entering={FadeInDown.duration(350)}
    style={[styles.wrap, {bottom}]}>
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.pill}
      accessibilityRole="button"
      accessibilityLabel="Create or join a group"
      onPress={() => {
        haptics.tap();
        onPress();
      }}>
      <UsersRound size={18} color={theme.color.teal} />
      <Text style={styles.label}>New group</Text>
    </TouchableOpacity>
  </Animated.View>
);

export const ADD_GROUP_FAB_RIGHT = 20;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: ADD_GROUP_FAB_RIGHT,
    height: ADD_GROUP_FAB_HEIGHT,
    borderRadius: ADD_GROUP_FAB_HEIGHT / 2,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 6},
    elevation: 5,
  },
  pill: {
    height: ADD_GROUP_FAB_HEIGHT,
    borderRadius: ADD_GROUP_FAB_HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    backgroundColor: '#111B2E',
    borderWidth: 1.5,
    borderColor: 'rgba(56,217,201,0.6)',
  },
  label: {
    color: theme.color.ink,
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(13.5),
    fontWeight: '700',
  },
});

export default AddGroupFab;
