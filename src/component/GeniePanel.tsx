// src/component/GeniePanel.tsx
// A near-full-screen panel that opens out of (and closes back into) a
// floating button with a genie-style animation. Shared by the AI orb
// (AssistantOrb) and the "New group" button (GroupCheck/Groups), so both
// floating actions open their content the same way.
//
// The panel is laid out at full size and animated with transforms only:
// opening, it first stretches up out of the origin as a tall narrow shape
// (vertical progress leads), then widens (horizontal lags), while its
// centre travels from the origin to the panel's centre; closing runs the
// same curves backwards. Content fades in only at the end so text is never
// seen squashed. Reduced-motion users get a plain quick fade.
//
// Controlled: `open` drives it; the Modal stays mounted until the close
// animation finishes, then `onClosed` fires.

import React, {useEffect, useState} from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
  useWindowDimensions,
  ViewStyle,
} from 'react-native';
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
import theme from '../utils/theme';

export interface GenieOrigin {
  // Distance of the origin button's bottom / right edges from the screen
  // edges, and its size (height; treated as a circle).
  bottom: number;
  right: number;
  size: number;
}

interface Props {
  open: boolean;
  origin: GenieOrigin;
  onRequestClose: () => void; // backdrop tap / Android back
  onClosed?: () => void;
  accentBorder?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

const PANEL_SIDE = 12;
const PANEL_TOP_GAP = 36;
const PANEL_BOTTOM_GAP = 12;

const GeniePanel: React.FC<Props> = ({
  open,
  origin,
  onRequestClose,
  onClosed,
  accentBorder = 'rgba(56,217,201,0.35)',
  children,
  style,
}) => {
  const {width: W, height: H} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(open);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (open) {
      setMounted(true);
      progress.value = 0;
      progress.value = withTiming(1, {
        duration: reduceMotion ? 180 : 560,
        easing: Easing.bezier(0.2, 0.85, 0.25, 1),
      });
    } else if (mounted) {
      const finish = () => {
        setMounted(false);
        onClosed?.();
      };
      progress.value = withTiming(
        0,
        {
          duration: reduceMotion ? 150 : 420,
          easing: Easing.bezier(0.55, 0, 0.75, 0.2),
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

  const panelTop = insets.top + PANEL_TOP_GAP;
  const panelBottom = insets.bottom + PANEL_BOTTOM_GAP;
  const panelW = W - PANEL_SIDE * 2;
  const panelH = H - panelTop - panelBottom;
  const panelCx = W / 2;
  const panelCy = panelTop + panelH / 2;
  const orbCx = W - origin.right - origin.size / 2;
  const orbCy = H - origin.bottom - origin.size / 2;

  const panelStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return {opacity: progress.value, transform: []};
    }
    const p = progress.value;
    const pY = interpolate(p, [0, 0.55, 1], [0, 0.82, 1]);
    const pX = interpolate(p, [0, 0.4, 1], [0, 0.12, 1]);
    const minSX = origin.size / panelW;
    const minSY = origin.size / panelH;
    return {
      opacity: interpolate(p, [0, 0.12, 1], [0, 1, 1]),
      transform: [
        {translateX: (orbCx - panelCx) * (1 - pX)},
        {translateY: (orbCy - panelCy) * (1 - pY)},
        {scaleX: minSX + (1 - minSX) * pX},
        {scaleY: minSY + (1 - minSY) * pY},
      ],
    };
  });

  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.7, 1], [0, 1], 'clamp'),
  }));

  const backdropStyle = useAnimatedStyle(() => ({opacity: progress.value}));

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onRequestClose}>
      <TouchableWithoutFeedback onPress={onRequestClose}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </TouchableWithoutFeedback>
      <KeyboardAvoidingView
        style={styles.flex}
        pointerEvents="box-none"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View
          style={[
            styles.panel,
            {
              top: panelTop,
              bottom: panelBottom,
              left: PANEL_SIDE,
              right: PANEL_SIDE,
              borderColor: accentBorder,
            },
            style,
            panelStyle,
          ]}>
          <Animated.View style={[styles.flex, contentStyle]}>
            {children}
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1},
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,7,15,0.7)',
  },
  panel: {
    position: 'absolute',
    backgroundColor: theme.color.modalSurface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: {width: 0, height: 12},
    elevation: 12,
  },
});

export default GeniePanel;
