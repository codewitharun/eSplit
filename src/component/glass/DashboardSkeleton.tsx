// src/component/glass/DashboardSkeleton.tsx
// Loading placeholder for the dashboard (GroupCheck screen), shown only
// during the initial groups fetch. Shaped to match the real hero card
// (kicker + mode pill, position ring + amount, the All/Groups/Personal
// toggle INSIDE the card) / collapsed quick-stats row / "Your groups"
// header (just a title + a "See All" link) / groups-list layout, so
// nothing visually "pops" once real data arrives. This used to also
// carry bones for a 3-icon header (sort/filter, search, add) and a
// separate filter-pill row - that was actually Groups.tsx's layout, not
// this screen's (GroupCheck.tsx's own header is just "See All", and its
// own All/Groups/Personal toggle is the hero card's own toggleBone, not
// a separate row) - Groups.tsx now has its own dedicated
// GroupsListSkeleton.tsx that matches its layout properly instead.

import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet, View, ViewStyle} from 'react-native';
import GlassCard from './GlassCard';
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

const DashboardSkeleton: React.FC = () => {
  const opacity = useShimmer();

  return (
    <View>
      <GlassCard style={styles.heroCard} strong>
        <View style={styles.heroTopRow}>
          <Bone opacity={opacity} style={styles.heroKickerBone} />
          <Bone opacity={opacity} style={styles.heroPillBone} />
        </View>
        <View style={styles.heroMainRow}>
          <Bone opacity={opacity} style={styles.ringBone} />
          <View style={styles.heroAmountCol}>
            <Bone opacity={opacity} style={styles.heroAmountBone} />
            <Bone opacity={opacity} style={styles.heroCaptionBone} />
          </View>
        </View>
        <Bone opacity={opacity} style={styles.toggleBone} />
      </GlassCard>

      <View style={styles.statsHeaderRow}>
        <Bone opacity={opacity} style={styles.statsHeaderTitleBone} />
        <View style={styles.statsHeaderRight}>
          <Bone opacity={opacity} style={styles.statsHeaderHintBone} />
          <Bone opacity={opacity} style={styles.statsChevronBone} />
        </View>
      </View>

      <View style={styles.groupsHeaderRow}>
        <Bone opacity={opacity} style={styles.sectionTitleBone} />
        <Bone opacity={opacity} style={styles.seeAllBone} />
      </View>

      {[0, 1, 2].map(i => (
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
  heroCard: {
    marginTop: 14,
    marginBottom: 16,
    paddingVertical: 20,
    borderRadius: theme.radius.xl,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  heroKickerBone: {width: 90, height: 11},
  heroPillBone: {width: 120, height: 22, borderRadius: theme.radius.pill},
  heroMainRow: {flexDirection: 'row', alignItems: 'center', gap: 18},
  ringBone: {width: 132, height: 132, borderRadius: 66},
  heroAmountCol: {flex: 1, gap: 10},
  heroAmountBone: {width: '70%', height: 30},
  heroCaptionBone: {width: '85%', height: 13},
  toggleBone: {height: 40, borderRadius: theme.radius.pill, marginTop: 20},
  statsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 4,
  },
  statsHeaderTitleBone: {width: 84, height: 11},
  statsHeaderRight: {flexDirection: 'row', alignItems: 'center', gap: 6},
  statsHeaderHintBone: {width: 32, height: 11},
  statsChevronBone: {width: 16, height: 16, borderRadius: theme.radius.sm},
  groupsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 14,
  },
  sectionTitleBone: {width: 120, height: 20},
  seeAllBone: {width: 46, height: 13},
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

export default DashboardSkeleton;
