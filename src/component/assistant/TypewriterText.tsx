// src/component/assistant/TypewriterText.tsx
// Reveals a new AI answer a few characters at a time (capped at ~1.4s in
// total so long answers don't drag). No haptics here - the chat gives one
// light tick when the answer arrives (AssistantChat). Calls onDone when
// fully shown so the message isn't re-animated when the panel is reopened.

import React, {useEffect, useState} from 'react';
import {TextStyle} from 'react-native';
import {Text} from '../ui/AppText';

interface Props {
  text: string;
  style?: TextStyle | TextStyle[];
  onDone?: () => void;
}

const FRAME_MS = 24;
const MAX_DURATION_MS = 1400;

const TypewriterText: React.FC<Props> = ({text, style, onDone}) => {
  const [shown, setShown] = useState(0);

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
