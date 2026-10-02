// src/component/assistant/TypewriterText.tsx
// Reveals a new AI answer a few characters at a time (capped at ~1.4s in
// total so long answers don't drag), with a very light haptic tick every
// few characters - the "typing" feel. Ticks are Android-only (see
// haptics.tick). Calls onDone when fully shown so the message isn't
// re-animated when the panel is reopened.

import React, {useEffect, useRef, useState} from 'react';
import {TextStyle} from 'react-native';
import {Text} from '../ui/AppText';
import {haptics} from '../../utils/haptics';

interface Props {
  text: string;
  style?: TextStyle | TextStyle[];
  onDone?: () => void;
}

const FRAME_MS = 24;
const MAX_DURATION_MS = 1400;
const MIN_TICK_GAP_MS = 70;

const TypewriterText: React.FC<Props> = ({text, style, onDone}) => {
  const [shown, setShown] = useState(0);
  const lastTick = useRef(0);

  useEffect(() => {
    const frames = Math.max(
      1,
      Math.min(text.length, MAX_DURATION_MS / FRAME_MS),
    );
    const step = Math.ceil(text.length / frames);
    let count = 0;
    const timer = setInterval(() => {
      count = Math.min(text.length, count + step);
      setShown(count);
      const now = Date.now();
      if (now - lastTick.current >= MIN_TICK_GAP_MS) {
        lastTick.current = now;
        haptics.tick();
      }
      if (count >= text.length) {
        clearInterval(timer);
        onDone?.();
      }
    }, FRAME_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <Text selectable style={style}>
      {text.slice(0, shown)}
    </Text>
  );
};

export default TypewriterText;
