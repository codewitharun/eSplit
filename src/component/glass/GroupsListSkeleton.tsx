// src/component/glass/GroupsListSkeleton.tsx
// Loading placeholder for the Groups screen (the "See All" list reached
// from GroupCheck.tsx or the outer Groups tab), shown only during the
// initial groups fetch. This screen has no hero card or quick stats -
// it's a title + 3 icon buttons (sort/filter, search, add group), an
// All/Groups/Personal filter-pill row, a hint line, then the group rows
// - a plain list screen, not a dashboard. It used to reuse
// DashboardSkeleton (built for GroupCheck.tsx's very different, hero-card
// layout), which happened to get this screen's header/filter bones right
// by coincidence but never matched its own lack of a hero card. This one
// mirrors this screen's actual shape instead.

import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet, View, ViewStyle} from 'react-native';
import theme from '../../utils/theme';

function useShimmer() {
  const value = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value]);
  return value;
}

interface BoneProps {
  style?: ViewStyle | ViewStyle[];
  opacity: Animated.Value;
}

const Bone: React.FC<BoneProps> = ({style, opacity}) => (
  <Animated.View style={[styles.bone, style, {opacity}]} />
);

const GroupsListSkeleton: React.FC = () => {
  const opacity = useShimmer();

  return (
    <View>
      <View style={styles.headerRow}>
        <Bone opacity={opacity} style={styles.titleBone} />
        <View style={styles.headerActionsBone}>
          <Bone opacity={opacity} style={styles.iconBtnBone} />
          <Bone opacity={opacity} style={styles.iconBtnBone} />
          <Bone opacity={opacity} style={styles.iconBtnBone} />
        </View>
      </View>

      <View style={styles.listFilterRow}>
        {[0, 1, 2].map(i => (
          <Bone key={i} opacity={opacity} style={styles.listFilterPillBone} />
        ))}
      </View>

      <Bone opacity={opacity} style={styles.hintBone} />

      {[0, 1, 2, 3].map(i => (
        <View key={i} style={styles.groupRow}>
          <Bone opacity={opacity} style={styles.avatarBone} />
          <View style={styles.groupRowText}>
            <Bone opacity={opacity} style={styles.groupNameBone} />
            <Bone opacity={opacity} style={styles.groupMetaBone} />
          </View>
        </View>
      ))}
    </View>
  );
};

const BONE_COLOR = 'rgba(255,255,255,0.10)';

const styles = StyleSheet.create({
  bone: {
    backgroundColor: BONE_COLOR,
    borderRadius: theme.radius.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  titleBone: {width: 130, height: 22},
  headerActionsBone: {flexDirection: 'row', alignItems: 'center', gap: 8},
  iconBtnBone: {width: 34, height: 34, borderRadius: 17},
  listFilterRow: {flexDirection: 'row', gap: 8, marginTop: 14},
  listFilterPillBone: {width: 64, height: 28, borderRadius: theme.radius.pill},
  hintBone: {width: '70%', height: 12, marginTop: 12, marginBottom: 16},
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.lg,
    padding: 16,
  },
  avatarBone: {width: 40, height: 40, borderRadius: 14},
  groupRowText: {flex: 1, gap: 8},
  groupNameBone: {width: '60%', height: 15},
  groupMetaBone: {width: '40%', height: 11},
});

export default GroupsListSkeleton;
