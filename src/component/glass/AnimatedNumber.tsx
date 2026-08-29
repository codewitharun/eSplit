// src/component/glass/AnimatedNumber.tsx
// Counts a number up/down instead of jump-cutting when a new value lands
// from a Firestore listener - one of the small motion touches from the
// Phase 3 roadmap. Built on reanimated + a plain interval-free derived
// value (no extra dependency needed beyond what's already installed).

import React, {useEffect, useRef, useState} from 'react';
import {Text, TextStyle} from 'react-native';

interface Props {
  value: number;
  prefix?: string;
  decimals?: number;
  style?: TextStyle | TextStyle[];
  durationMs?: number;
}

const AnimatedNumber: React.FC<Props> = ({
  value,
  prefix = '',
  decimals = 0,
  style,
  durationMs = 500,
}) => {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) {
      return;
    }
    startRef.current = null;
    let frame: number;
    const step = (timestamp: number) => {
      if (startRef.current == null) {
        startRef.current = timestamp;
      }
      const elapsed = timestamp - startRef.current;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        frame = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);

  return (
    <Text style={style}>
      {prefix}
      {display.toFixed(decimals)}
    </Text>
  );
};

export default AnimatedNumber;
