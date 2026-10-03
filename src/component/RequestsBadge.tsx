// src/component/RequestsBadge.tsx
// Red count badge for pending join requests (see useJoinRequestsStore).
//   <RequestsBadge count={n} />                -> "2" bubble, for icon corners
//   <RequestsBadge count={n} variant="pill" /> -> "2 join requests" chip, for list rows
// Renders nothing when count is 0.
import React from 'react';
import {StyleSheet, View, ViewStyle} from 'react-native';
import {Text} from './ui/AppText';
import {BodyFont, moderateScale} from '../utils/fonts';
import theme from '../utils/theme';

interface Props {
  count: number;
  variant?: 'dot' | 'pill';
  style?: ViewStyle;
}

const RequestsBadge: React.FC<Props> = ({count, variant = 'dot', style}) => {
  if (!count) {
    return null;
  }
  if (variant === 'pill') {
    return (
      <View style={[styles.pill, style]}>
        <View style={styles.pillDot} />
        <Text style={styles.pillText}>
          {count} join request{count === 1 ? '' : 's'}
        </Text>
      </View>
    );
  }
  return (
    <View
      style={[styles.bubble, style]}
      accessibilityLabel={`${count} pending join request${count === 1 ? '' : 's'}`}>
      <Text style={styles.bubbleText}>{count > 9 ? '9+' : count}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: theme.color.rose,
    borderWidth: 2,
    borderColor: theme.color.ground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleText: {
    color: theme.color.onAccent,
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(9.5),
    fontWeight: '700',
    lineHeight: moderateScale(12),
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(240,129,156,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(240,129,156,0.45)',
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.color.rose,
  },
  pillText: {
    color: theme.color.rose,
    fontFamily: BodyFont.semibold,
    fontSize: moderateScale(11),
    fontWeight: '600',
  },
});

export default RequestsBadge;
