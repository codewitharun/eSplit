// src/component/glass/SwipeToConfirm.tsx
// Reusable "swipe to proceed" slider - the pattern requested for
// Add-expense and Create-group actions (and any future irreversible
// action) instead of a plain tap button, so a confirm can't happen by
// accident. Built on the same gesture-handler + reanimated foundation
// SwipeableRow.tsx already uses (both are existing dependencies), and
// wired to the app's existing haptics module: haptics.success() on a
// resolved onConfirm, haptics.warning() if it throws/rejects - so every
// screen that adopts this component automatically gets consistent
// success/fail haptic feedback without wiring it up itself.
//
// Visuals matched pixel-for-pixel against the approved web mockup's
// .swipe-track/.swipe-fill/.swipe-thumb/.swipe-label (54px track, 50px
// thumb, chevron-accented label that fades out as you drag, blue->green
// fill) instead of the earlier plain white-thumb/no-chevron version.
//
// Usage:
//   <SwipeToConfirm
//     label="Slide to add expense"
//     onConfirm={handleSubmit}   // may be async; throw/reject = failure
//     disabled={!liveCheck.valid}
//   />
//
// `onConfirm` owns the actual side effect (Firestore write, etc.) - this
// component only owns the drag interaction and the idle/pending/success/
// error visual + haptic states around it. On success the thumb stays
// parked at the end showing a check; it's up to the caller to close the
// modal/screen shortly after (matching how the existing submit buttons
// already call onClose() once their own async action resolves).

import {Check, ChevronRight, TriangleAlert} from 'lucide-react-native';
import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {BodyFont, moderateScale} from '../../utils/fonts';
import {haptics} from '../../utils/haptics';
import theme from '../../utils/theme';
import GradientView from './GradientView';

// Matches the mockup's .swipe-track (height:54px) / .swipe-thumb
// (50x50, 5px inset) exactly, rather than the previous 58/50 pairing.
const THUMB_SIZE = 50;
const TRACK_PADDING = 5;
const TRACK_HEIGHT = THUMB_SIZE + TRACK_PADDING * 3;

// Low-opacity glass values pulled straight from the mockup's
// .swipe-track (background: rgba(255,255,255,0.05), border via its
// shared --border token) - noticeably more transparent than the app's
// general `surfaceStrong` token, which is what made the old track read
// as a plain grey pill instead of a glassy slider.
const TRACK_BG = 'rgba(255,255,255,0.05)';
const TRACK_BORDER = 'rgba(255,255,255,0.09)';

type Status = 'idle' | 'pending' | 'success' | 'error';

interface Props {
  label: string;
  pendingLabel?: string;
  successLabel?: string;
  onConfirm: () => Promise<void> | void;
  disabled?: boolean;
  colors?: string[];
  style?: ViewStyle;
}

const SwipeToConfirm: React.FC<Props> = ({
  label,
  pendingLabel = 'Working…',
  successLabel = 'Done!',
  onConfirm,
  disabled,
  colors,
  style,
}) => {
  const [trackWidth, setTrackWidth] = useState(0);
  const [status, setStatus] = useState<Status>('idle');
  const translateX = useSharedValue(0);
  const fillOpacity = useSharedValue(0);

  const maxTranslate = Math.max(trackWidth - THUMB_SIZE - TRACK_PADDING * 2, 1);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const snapBack = useCallback(() => {
    translateX.value = withSpring(0, {damping: 16});
    fillOpacity.value = withTiming(0, {duration: 200});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runConfirm = useCallback(async () => {
    setStatus('pending');
    try {
      await onConfirm();
      setStatus('success');
      haptics.success();
    } catch (e) {
      haptics.warning();
      setStatus('error');
      snapBack();
      setTimeout(() => setStatus('idle'), 900);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onConfirm]);

  useEffect(() => {
    // If the parent re-disables the slider (e.g. the form became invalid
    // again, or the modal was reopened) while it was left mid-drag or in
    // an error flash, put the thumb back at rest.
    if (disabled) {
      snapBack();
    }
  }, [disabled, snapBack]);

  const pan = Gesture.Pan()
    .enabled(!disabled && status === 'idle')
    .activeOffsetX(10)
    .failOffsetY([-14, 14])
    .onUpdate(e => {
      const next = Math.min(Math.max(e.translationX, 0), maxTranslate);
      translateX.value = next;
      fillOpacity.value = maxTranslate > 0 ? next / maxTranslate : 0;
    })
    .onEnd(() => {
      const crossedThreshold = translateX.value > maxTranslate * 0.82;
      if (crossedThreshold) {
        translateX.value = withTiming(maxTranslate, {duration: 120});
        fillOpacity.value = withTiming(1, {duration: 120});
        runOnJS(runConfirm)();
      } else {
        translateX.value = withSpring(0, {damping: 16});
        fillOpacity.value = withTiming(0, {duration: 200});
      }
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{translateX: translateX.value}],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    opacity: fillOpacity.value,
  }));

  // Fades the label out as the thumb crosses ~70% of the track, matching
  // the mockup's `label.style.opacity = 1 - dx/(maxDrag*0.7)` - without
  // this the label used to just sit there, fully legible, underneath the
  // thumb once it slid past it.
  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, maxTranslate * 0.7],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const trackColors =
    status === 'error'
      ? theme.gradient.danger
      : status === 'success'
      ? theme.gradient.success
      : colors || [theme.color.blue, theme.color.green];

  const displayLabel =
    status === 'pending'
      ? pendingLabel
      : status === 'success'
      ? successLabel
      : status === 'error'
      ? 'Try again'
      : label;

  const showChevrons = status === 'idle' || status === 'error';

  const thumbBg =
    status === 'success'
      ? theme.color.green
      : status === 'error'
      ? theme.color.rose
      : theme.color.ink;
  const thumbIconColor = theme.color.ground;

  return (
    <View
      style={[styles.track, style]}
      onLayout={onTrackLayout}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityHint="Swipe right to confirm">
      <Animated.View style={[StyleSheet.absoluteFill, fillStyle]}>
        <GradientView
          colors={trackColors}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
      <Animated.View style={[styles.labelRow, labelStyle]}>
        {showChevrons && (
          <ChevronRight
            size={13}
            color={theme.color.blueBright}
            strokeWidth={3}
            style={styles.chevron1}
          />
        )}
        {showChevrons && (
          <ChevronRight
            size={13}
            color={theme.color.blueBright}
            strokeWidth={3}
            style={styles.chevron2}
          />
        )}

        <Text style={styles.label} numberOfLines={1}>
          {displayLabel}
        </Text>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[styles.thumb, {backgroundColor: thumbBg}, thumbStyle]}>
          {status === 'pending' ? (
            <ActivityIndicator color={thumbIconColor} size="small" />
          ) : status === 'success' ? (
            <Check size={22} color={thumbIconColor} strokeWidth={3} />
          ) : status === 'error' ? (
            <TriangleAlert size={20} color={thumbIconColor} strokeWidth={2.4} />
          ) : (
            <ChevronRight size={22} color={thumbIconColor} strokeWidth={3} />
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    borderRadius: theme.radius.pill,
    backgroundColor: TRACK_BG,
    borderWidth: 1,
    borderColor: TRACK_BORDER,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  labelRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron1: {marginRight: -6, opacity: 0.55},
  chevron2: {marginRight: 6, opacity: 0.85},
  label: {
    color: theme.color.inkSoft,
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(13),
    lineHeight: moderateScale(17),
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  thumb: {
    position: 'absolute',
    left: TRACK_PADDING + 2,
    top: TRACK_PADDING + 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
});

export default SwipeToConfirm;
