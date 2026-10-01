// src/component/ExtendedFab.tsx
// Shared floating create button: icon + label that collapses to an
// icon-only circle while the user scrolls down (useFloatingUiStore /
// useCollapseFabsOnScroll) and extends again on scroll up or at the top.
//
// Two variants carry the app's create-button rule:
//   primary   = filled blue->green gradient - adds money ("Add expense")
//   secondary = outlined dark glass, teal border - organises ("New group")
// Icon and fill differ too, so the compact (icon-only) forms are still
// told apart at a glance without the label.
//
// The label's natural width is measured once off-screen; the visible
// label wrapper animates between 0 and that width (overflow hidden), so
// the label wipes in/out from behind the icon and the button's right
// edge stays anchored.

import React, {useEffect, useState} from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {useFloatingUiStore} from '../store/useFloatingUiStore';
import {haptics} from '../utils/haptics';
import {BodyFont, moderateScale} from '../utils/fonts';
import theme from '../utils/theme';
import GradientView from './glass/GradientView';

interface Props {
  icon: React.ReactNode;
  iconSize: number;
  label: string;
  accessibilityLabel: string;
  variant: 'primary' | 'secondary';
  size: number; // button height (= diameter when compact)
  bottom: number;
  right: number;
  onPress: () => void;
}

const LABEL_GAP = 8;
const EXTENDED_PAD = 18;

const ExtendedFab: React.FC<Props> = ({
  icon,
  iconSize,
  label,
  accessibilityLabel,
  variant,
  size,
  bottom,
  right,
  onPress,
}) => {
  const compact = useFloatingUiStore(s => s.fabCompact);
  const [labelWidth, setLabelWidth] = useState(0);
  const progress = useSharedValue(compact ? 1 : 0); // 1 = compact

  useEffect(() => {
    progress.value = withTiming(compact ? 1 : 0, {duration: 260});
  }, [compact, progress]);

  const compactPad = (size - iconSize) / 2;

  const innerStyle = useAnimatedStyle(() => ({
    paddingHorizontal: interpolate(
      progress.value,
      [0, 1],
      [EXTENDED_PAD, compactPad],
    ),
  }));
  const labelWrapStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], [labelWidth + LABEL_GAP, 0]),
    opacity: interpolate(progress.value, [0, 0.6], [1, 0], 'clamp'),
  }));

  const onMeasure = (e: LayoutChangeEvent) => {
    const w = Math.ceil(e.nativeEvent.layout.width);
    if (w && w !== labelWidth) {
      setLabelWidth(w);
    }
  };

  const labelStyle = [
    styles.label,
    variant === 'primary' ? styles.labelPrimary : styles.labelSecondary,
  ];

  const content = (
    <Animated.View style={[styles.inner, {height: size}, innerStyle]}>
      {icon}
      <Animated.View style={[styles.labelWrap, labelWrapStyle]}>
        <Text numberOfLines={1} style={[labelStyle, {marginLeft: LABEL_GAP}]}>
          {label}
        </Text>
      </Animated.View>
    </Animated.View>
  );

  return (
    <Animated.View
      entering={FadeInDown.duration(350)}
      style={[
        styles.wrap,
        variant === 'primary' ? styles.wrapPrimary : styles.wrapSecondary,
        {bottom, right, height: size, borderRadius: size / 2},
      ]}>
      {/* Off-screen copy, only to measure the label's natural width. */}
      <View style={styles.measurer} pointerEvents="none">
        <Text onLayout={onMeasure} numberOfLines={1} style={labelStyle}>
          {label}
        </Text>
      </View>
      <TouchableOpacity
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={() => {
          haptics.tap();
          onPress();
        }}>
        {variant === 'primary' ? (
          <GradientView
            colors={[theme.color.blueBright, theme.color.green]}
            style={[styles.fill, {borderRadius: size / 2}]}>
            {content}
          </GradientView>
        ) : (
          <View
            style={[
              styles.fill,
              styles.secondaryFill,
              {borderRadius: size / 2},
            ]}>
            {content}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: {width: 0, height: 7},
    elevation: 6,
  },
  wrapPrimary: {shadowColor: theme.color.greenBright},
  wrapSecondary: {shadowColor: '#000'},
  fill: {overflow: 'hidden'},
  secondaryFill: {
    backgroundColor: '#111B2E',
    borderWidth: 1.5,
    borderColor: 'rgba(56,217,201,0.6)',
  },
  inner: {flexDirection: 'row', alignItems: 'center'},
  labelWrap: {overflow: 'hidden'},
  measurer: {position: 'absolute', opacity: 0, left: -1000, top: 0},
  label: {
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(13.5),
    fontWeight: '800',
  },
  labelPrimary: {color: theme.color.onAccent},
  labelSecondary: {color: theme.color.ink},
});

export default ExtendedFab;
