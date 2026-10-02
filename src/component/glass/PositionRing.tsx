// src/component/glass/PositionRing.tsx
// Replaces the old two-arc "owed vs owe" BalanceDonut with a single
// progress ring for the dashboard's "Your position" hero card: how much
// of your groups are actually settled up, as one clear percentage,
// instead of two competing arcs.
//
// `settledFraction` is caller-computed as (settled groups / total groups)
// - see GroupCheck.tsx - deliberately a real, honest metric rather than
// anything derived from the owed/owe amounts themselves, which don't
// combine into a meaningful "percent" (owing ₹500 in one group and being
// owed ₹500 in another isn't "50% settled" in any real sense).
//
// `indeterminate` covers the one scope where "settled %" genuinely does
// not apply: Personal-only. Personal expenses are never shared, so there
// is no debt and nothing to "settle" - rather than showing a fabricated
// percentage, the ring shows a plain "-" and a faint neutral arc, same
// idea as the approved web mockup's own Personal-mode ring state.

import React, {useEffect} from 'react';
import {StyleSheet, View} from 'react-native';
import {Text} from '../ui/AppText';
import Svg, {Circle, G} from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import theme from '../../utils/theme';
import {BodyFont, DisplayFont, moderateScale} from '../../utils/fonts';
import {useCountUp} from '../../utils/animation';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// How long the arc takes to animate to its new length, and the percent
// label to count up to match - shared so both finish together.
const RING_ANIM_DURATION = 700;

interface Props {
  settledFraction: number; // 0..1
  size?: number;
  // Ring/amount color context - green when you're net owed, rose when
  // you owe (matches the hero amount's own color logic in GroupCheck).
  color?: string;
  indeterminate?: boolean;
  indeterminateLabel?: string;
}

const PositionRing: React.FC<Props> = ({
  settledFraction,
  size = 132,
  color,
  indeterminate = false,
  indeterminateLabel = 'no split',
}) => {
  const strokeWidth = 13;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, settledFraction));
  // Honest empty ring when there's genuinely nothing to show a percent
  // for (Personal-only has no debt to settle) - this used to draw a
  // fixed ~28% arc as a "faint placeholder" regardless of the real
  // value, which read as an actual (wrong) percentage rather than as
  // "not applicable", and was reported as "showing ~30% filled even for
  // 0".
  const targetFraction = indeterminate ? 0 : clamped;
  const percent = Math.round(clamped * 100);
  const animatedPercent = Math.round(
    useCountUp(indeterminate ? 0 : percent, RING_ANIM_DURATION),
  );
  const strokeColor = indeterminate
    ? theme.color.blueBright
    : color || theme.color.rose;

  // Animates the arc's own length whenever the target changes (initial
  // load, or the All/Groups/Personal toggle swapping in a new fraction)
  // instead of snapping straight to it.
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(targetFraction, {
      duration: RING_ANIM_DURATION,
      easing: Easing.out(Easing.cubic),
    });
  }, [targetFraction, progress]);

  // Reanimated's useAnimatedProps updates react-native-svg's
  // strokeDasharray reliably as a NUMBER ARRAY - a template-string value
  // (e.g. "42, 100"), which is what the old static (non-animated) prop
  // used, silently fails to apply through this particular update path
  // and the shape falls back to its default: a solid, fully-drawn
  // stroke. That's exactly what showed up as "always full for any %".
  const animatedCircleProps = useAnimatedProps(() => ({
    strokeDasharray: [circumference * progress.value, circumference],
  }));

  return (
    <View style={{width: size, height: size}}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255,255,255,0.14)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            animatedProps={animatedCircleProps}
          />
        </G>
      </Svg>
      <View style={[styles.center, {width: size, height: size}]}>
        <Text style={styles.percent}>
          {indeterminate ? '—' : `${animatedPercent}%`}
        </Text>
        <Text style={styles.caption}>
          {indeterminate ? indeterminateLabel : 'settled'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  percent: {
    color: theme.color.ink,
    fontSize: moderateScale(24),
    fontWeight: '800',
    fontFamily: DisplayFont.extrabold,
  },
  caption: {
    color: 'rgba(255,255,255,0.65)',
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(11.5),
    marginTop: 2,
  },
});

export default PositionRing;
