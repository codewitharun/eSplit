// src/component/GeniePanel.tsx
// A near-full-screen panel that grows out of the thing that opened it - a
// floating button, or the exact spot the user tapped - and shrinks back
// into it. Used by the AI orb, New group, and Add/Edit expense.
//
// Motion ("container transform" with a genie lead): the panel's real
// bounds animate from the origin circle to the final card - height leads
// width slightly, corners relax from a circle to the card radius. The
// content inside is laid out once at its final size and pinned in place
// on screen, so the growing card *reveals* it rather than squashing it
// (the earlier version scaled the whole panel, which read as being
// pinched from the left and right). Content fades in at the end and out
// first on close. Reduced-motion users get a plain fade.
//
// Keyboard: the card's bottom edge sits above the keyboard on both
// platforms, using the measured overlap (useKeyboardOverlap) so it works
// whether or not Android resized the modal window. When the keyboard
// opens/closes while the panel is open, the card's height animates to
// match; put scrolling content in KeyboardSafeScrollView so the focused
// field stays visible.
//
// Controlled: `open` drives it; the Modal stays mounted until the close
// animation finishes, then `onClosed` fires.

import React, {useEffect, useState} from 'react';
import {
  LayoutChangeEvent,
  Modal,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useKeyboardOverlap} from '../hooks/useKeyboardOverlap';
import theme from '../utils/theme';
import {ToastLayer} from './glass/ToastHost';

// Either a floating button's corner placement, or a point (e.g. the tap
// position, from a press event's pageX/pageY) - both with a size.
export type GenieOrigin =
  | {bottom: number; right: number; size: number}
  | {x: number; y: number; size: number};

interface Props {
  open: boolean;
  origin: GenieOrigin;
  onRequestClose: () => void; // backdrop tap / Android back
  onClosed?: () => void;
  accentBorder?: string;
  children: React.ReactNode;
}

const SIDE = 12;
const TOP_GAP = 36;
const BOTTOM_GAP = 12;
const KEYBOARD_GAP = 8;
const CARD_RADIUS = theme.radius.xl;

const GeniePanel: React.FC<Props> = ({
  open,
  origin,
  onRequestClose,
  onClosed,
  accentBorder = 'rgba(56,217,201,0.35)',
  children,
}) => {
  const {width: W, height: H} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(open);
  const [rootH, setRootH] = useState(H);
  const overlap = useKeyboardOverlap(rootH);

  // Final card rect. Height follows the keyboard.
  const finalX = SIDE;
  const finalY = insets.top + TOP_GAP;
  const finalW = W - SIDE * 2;
  const bottomGap =
    overlap > 0 ? overlap + KEYBOARD_GAP : insets.bottom + BOTTOM_GAP;
  const finalH = Math.max(rootH - finalY - bottomGap, 200);

  // Origin circle (centre + size).
  const size = origin.size;
  const ox = 'x' in origin ? origin.x : W - origin.right - size / 2;
  const oy = 'y' in origin ? origin.y : H - origin.bottom - size / 2;

  const progress = useSharedValue(0);
  const cardH = useSharedValue(finalH);

  useEffect(() => {
    cardH.value = mounted ? withTiming(finalH, {duration: 220}) : finalH;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalH]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      cardH.value = finalH;
      progress.value = 0;
      progress.value = withTiming(1, {
        duration: reduceMotion ? 180 : 520,
        easing: Easing.bezier(0.2, 0.9, 0.25, 1),
      });
    } else if (mounted) {
      const finish = () => {
        setMounted(false);
        onClosed?.();
      };
      progress.value = withTiming(
        0,
        {
          duration: reduceMotion ? 150 : 380,
          easing: Easing.bezier(0.45, 0, 0.85, 0.35),
        },
        finished => {
          if (finished) {
            runOnJS(finish)();
          }
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const cardStyle = useAnimatedStyle(() => {
    const p = progress.value;
    if (reduceMotion) {
      return {
        left: finalX,
        top: finalY,
        width: finalW,
        height: cardH.value,
        borderRadius: CARD_RADIUS,
        opacity: p,
      };
    }
    // Height leads, width follows a beat later - a soft genie stretch
    // anchored on the origin rather than a symmetric pinch.
    const pY = p;
    const pX = interpolate(p, [0, 0.1, 1], [0, 0, 1], 'clamp');
    const x0 = ox - size / 2;
    const y0 = oy - size / 2;
    return {
      left: x0 + (finalX - x0) * pX,
      top: y0 + (finalY - y0) * pY,
      width: size + (finalW - size) * pX,
      height: size + (cardH.value - size) * pY,
      borderRadius: interpolate(p, [0, 0.6], [size / 2, CARD_RADIUS], 'clamp'),
      opacity: interpolate(p, [0, 0.08], [0, 1], 'clamp'),
    };
  });

  // Content keeps its final size and screen position while the card grows
  // around it.
  const contentStyle = useAnimatedStyle(() => {
    const p = progress.value;
    if (reduceMotion) {
      return {left: 0, top: 0, width: finalW, height: cardH.value, opacity: 1};
    }
    const pX = interpolate(p, [0, 0.1, 1], [0, 0, 1], 'clamp');
    const x0 = ox - size / 2;
    const y0 = oy - size / 2;
    const left = x0 + (finalX - x0) * pX;
    const top = y0 + (finalY - y0) * p;
    return {
      left: finalX - left,
      top: finalY - top,
      width: finalW,
      height: cardH.value,
      opacity: interpolate(p, [0.55, 1], [0, 1], 'clamp'),
    };
  });

  const backdropStyle = useAnimatedStyle(() => ({opacity: progress.value}));

  const onRootLayout = (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h && h !== rootH) {
      setRootH(h);
    }
  };

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onRequestClose}>
      <GestureHandlerRootView style={styles.flex}>
        <View style={styles.flex} onLayout={onRootLayout}>
          <TouchableWithoutFeedback onPress={onRequestClose}>
            <Animated.View style={[styles.backdrop, backdropStyle]} />
          </TouchableWithoutFeedback>
          <Animated.View
            style={[styles.card, {borderColor: accentBorder}, cardStyle]}>
            <Animated.View style={[styles.content, contentStyle]}>
              {children}
            </Animated.View>
          </Animated.View>
          {/* Toasts fired while this panel is open show above it. */}
          <ToastLayer />
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1},
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,7,15,0.7)',
  },
  card: {
    position: 'absolute',
    backgroundColor: theme.color.modalSurface,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: {width: 0, height: 12},
    elevation: 12,
  },
  content: {position: 'absolute'},
});

export default GeniePanel;
