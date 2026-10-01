// src/component/assistant/AssistantOrb.tsx
// Floating entry point for the "Ask EzySplit" AI, plus the chat panel it
// opens with a genie-style animation.
//
// UX intent: this must never read as a "create" button. The app's create
// actions are pills with a label (filled gradient = Add expense, outlined
// glass = New group). The orb is deliberately different on every axis -
// smaller, circular, dark glass with a teal sparkle and a slow "alive"
// glow - and sits stacked just above the primary action.
//
// Genie: the panel is laid out at full size and animated with transforms
// only. Opening, it first stretches up out of the orb as a tall narrow
// shape (vertical progress leads), then widens to full size (horizontal
// progress lags), while its centre travels from the orb to the panel's
// centre. Closing runs the same curves backwards into the orb. Content
// fades in only at the end so text is never seen squashed. Reduced-motion
// users get a plain quick fade.

import {RotateCcw, Sparkles, X} from 'lucide-react-native';
import React, {useCallback, useEffect, useState} from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAssistantStore} from '../../store/useAssistantStore';
import {BodyFont, DisplayFont, moderateScale} from '../../utils/fonts';
import {haptics} from '../../utils/haptics';
import theme from '../../utils/theme';
import AssistantChat from './AssistantChat';

export const ASSISTANT_ORB_SIZE = 46;
const PANEL_SIDE = 12;
const PANEL_TOP_GAP = 36;
const PANEL_BOTTOM_GAP = 12;

interface Props {
  // Distance of the orb's bottom / right edges from the screen edges.
  bottom: number;
  right: number;
  // When shown inside a group - tailors the suggested questions.
  groupName?: string;
}

const AssistantOrb: React.FC<Props> = ({bottom, right, groupName}) => {
  const {width: W, height: H} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const hasMessages = useAssistantStore(s => s.messages.length > 0);
  const busy = useAssistantStore(s => s.busy);

  const progress = useSharedValue(0);
  const glow = useSharedValue(0);

  // Slow breathing glow ring - a calm "this is alive / smart" cue that
  // none of the create buttons have.
  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    glow.value = withRepeat(
      withSequence(
        withTiming(1, {duration: 1600, easing: Easing.out(Easing.quad)}),
        withTiming(0, {duration: 0}),
        withTiming(0, {duration: 1800}),
      ),
      -1,
      false,
    );
  }, [glow, reduceMotion]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.55, 0]),
    transform: [{scale: interpolate(glow.value, [0, 1], [1, 1.55])}],
  }));

  // Panel geometry (full size) and the orb's centre, in screen coords.
  const panelTop = insets.top + PANEL_TOP_GAP;
  const panelBottom = insets.bottom + PANEL_BOTTOM_GAP;
  const panelW = W - PANEL_SIDE * 2;
  const panelH = H - panelTop - panelBottom;
  const panelCx = W / 2;
  const panelCy = panelTop + panelH / 2;
  const orbCx = W - right - ASSISTANT_ORB_SIZE / 2;
  const orbCy = H - bottom - ASSISTANT_ORB_SIZE / 2;

  const openPanel = () => {
    haptics.tap();
    setOpen(true);
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: reduceMotion ? 180 : 560,
      easing: Easing.bezier(0.2, 0.85, 0.25, 1),
    });
  };

  const closePanel = useCallback(() => {
    progress.value = withTiming(
      0,
      {
        duration: reduceMotion ? 150 : 420,
        easing: Easing.bezier(0.55, 0, 0.75, 0.2),
      },
      finished => {
        if (finished) {
          runOnJS(setOpen)(false);
        }
      },
    );
  }, [progress, reduceMotion]);

  const panelStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return {opacity: progress.value, transform: []};
    }
    const p = progress.value;
    // Vertical leads, horizontal lags - the genie stretch.
    const pY = interpolate(p, [0, 0.55, 1], [0, 0.82, 1]);
    const pX = interpolate(p, [0, 0.4, 1], [0, 0.12, 1]);
    const minSX = ASSISTANT_ORB_SIZE / panelW;
    const minSY = ASSISTANT_ORB_SIZE / panelH;
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

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const orbStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.2], [1, 0], 'clamp'),
  }));

  return (
    <>
      <Animated.View
        style={[styles.orbWrap, {bottom, right}, orbStyle]}
        pointerEvents={open ? 'none' : 'auto'}>
        <Animated.View style={[styles.glowRing, glowStyle]} />
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.orb}
          onPress={openPanel}
          accessibilityRole="button"
          accessibilityLabel="Ask EzySplit AI about your spending">
          <Sparkles size={20} color={theme.color.teal} />
          {busy && <View style={styles.busyDot} />}
        </TouchableOpacity>
      </Animated.View>

      <Modal
        visible={open}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closePanel}>
        <TouchableWithoutFeedback onPress={closePanel}>
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
              },
              panelStyle,
            ]}>
            <Animated.View style={[styles.flex, contentStyle]}>
              <View style={styles.header}>
                <View style={styles.headerIcon}>
                  <Sparkles size={16} color={theme.color.teal} />
                </View>
                <View style={styles.headerMid}>
                  <Text style={styles.title}>Ask EzySplit</Text>
                  <Text style={styles.subtitle} numberOfLines={1}>
                    AI · answers from your own expenses
                  </Text>
                </View>
                {hasMessages && (
                  <TouchableOpacity
                    style={styles.headerBtn}
                    onPress={() => {
                      haptics.tap();
                      useAssistantStore.getState().reset();
                    }}
                    disabled={busy}
                    accessibilityLabel="Start a new chat"
                    hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                    <RotateCcw size={17} color={theme.color.inkSoft} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.headerBtn}
                  onPress={closePanel}
                  accessibilityLabel="Close"
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                  <X size={19} color={theme.color.ink} />
                </TouchableOpacity>
              </View>
              <AssistantChat groupName={groupName} bottomInset={0} />
            </Animated.View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1},
  orbWrap: {
    position: 'absolute',
    width: ASSISTANT_ORB_SIZE,
    height: ASSISTANT_ORB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: ASSISTANT_ORB_SIZE,
    height: ASSISTANT_ORB_SIZE,
    borderRadius: ASSISTANT_ORB_SIZE / 2,
    borderWidth: 2,
    borderColor: theme.color.teal,
  },
  orb: {
    width: ASSISTANT_ORB_SIZE,
    height: ASSISTANT_ORB_SIZE,
    borderRadius: ASSISTANT_ORB_SIZE / 2,
    backgroundColor: '#0F1A2E',
    borderWidth: 1,
    borderColor: 'rgba(56,217,201,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.color.teal,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
    elevation: 5,
  },
  busyDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.color.amber,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,7,15,0.7)',
  },
  panel: {
    position: 'absolute',
    backgroundColor: theme.color.modalSurface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(56,217,201,0.35)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: {width: 0, height: 12},
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56,217,201,0.12)',
  },
  headerMid: {flex: 1},
  title: {
    fontFamily: DisplayFont.bold,
    color: theme.color.ink,
    fontSize: moderateScale(15.5),
    fontWeight: '700',
  },
  subtitle: {
    fontFamily: BodyFont.regular,
    color: theme.color.inkFaint,
    fontSize: moderateScale(11.5),
    marginTop: 1,
  },
  headerBtn: {padding: 6},
});

export default AssistantOrb;
