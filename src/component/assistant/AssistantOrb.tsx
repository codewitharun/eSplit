// src/component/assistant/AssistantOrb.tsx
// Floating entry point for the "Ask EzySplit" AI. Tapping it opens the
// chat in a GeniePanel that grows out of the orb and shrinks back into it.
//
// UX intent: this must never read as a "create" button. Create actions
// are labelled pills (filled gradient = Add expense, outlined glass = New
// group); the orb is smaller, circular, dark glass with a teal sparkle and
// a slow "alive" glow, stacked just above the primary action.

import {RotateCcw, Sparkles} from 'lucide-react-native';
import React, {useEffect, useState} from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {useAssistantStore} from '../../store/useAssistantStore';
import {haptics} from '../../utils/haptics';
import theme from '../../utils/theme';
import GeniePanel from '../GeniePanel';
import PanelHeader, {panelHeaderButtonStyle} from '../PanelHeader';
import AssistantChat from './AssistantChat';

export const ASSISTANT_ORB_SIZE = 46;

interface Props {
  // Distance of the orb's bottom / right edges from the screen edges.
  bottom: number;
  right: number;
  // When shown inside a group - tailors the suggested questions.
  groupName?: string;
}

const AssistantOrb: React.FC<Props> = ({bottom, right, groupName}) => {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const hasMessages = useAssistantStore(s => s.messages.length > 0);
  const busy = useAssistantStore(s => s.busy);
  const glow = useSharedValue(0);
  const hidden = useSharedValue(0);

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

  useEffect(() => {
    hidden.value = withTiming(open ? 1 : 0, {duration: open ? 120 : 300});
  }, [open, hidden]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.55, 0]),
    transform: [{scale: interpolate(glow.value, [0, 1], [1, 1.55])}],
  }));
  const orbStyle = useAnimatedStyle(() => ({opacity: 1 - hidden.value}));

  return (
    <>
      <Animated.View
        style={[styles.orbWrap, {bottom, right}, orbStyle]}
        pointerEvents={open ? 'none' : 'auto'}>
        <Animated.View style={[styles.glowRing, glowStyle]} />
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.orb}
          onPress={() => {
            haptics.tap();
            setOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Ask EzySplit AI about your spending">
          <Sparkles size={20} color={theme.color.teal} />
          {busy && <View style={styles.busyDot} />}
        </TouchableOpacity>
      </Animated.View>

      <GeniePanel
        open={open}
        origin={{bottom, right, size: ASSISTANT_ORB_SIZE}}
        onRequestClose={() => setOpen(false)}>
        <PanelHeader
          icon={<Sparkles size={16} color={theme.color.teal} />}
          title="Ask EzySplit"
          subtitle="AI · answers from your own expenses"
          onClose={() => setOpen(false)}
          actions={
            hasMessages ? (
              <TouchableOpacity
                style={panelHeaderButtonStyle}
                onPress={() => {
                  haptics.tap();
                  useAssistantStore.getState().reset();
                }}
                disabled={busy}
                accessibilityLabel="Start a new chat"
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                <RotateCcw size={17} color={theme.color.inkSoft} />
              </TouchableOpacity>
            ) : null
          }
        />
        <AssistantChat groupName={groupName} bottomInset={0} />
      </GeniePanel>
    </>
  );
};

const styles = StyleSheet.create({
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
});

export default AssistantOrb;
