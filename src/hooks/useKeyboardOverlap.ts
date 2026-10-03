// src/hooks/useKeyboardOverlap.ts
// How far the on-screen keyboard overlaps a full-window container, on both
// platforms, measured rather than assumed:
//   overlap = containerBottom - keyboardTop   (never below 0)
// If Android has already resized the window for the keyboard (adjustResize),
// the container's measured height shrinks to the keyboard's top and the
// overlap comes out ~0 - so this never double-counts. If it hasn't (iOS,
// and some Android Modal windows), the overlap is the keyboard's height.
// Pass the container's current height (from onLayout of a view filling the
// window/modal from y=0).

import {useEffect, useState} from 'react';
import {Keyboard, KeyboardEvent, Platform} from 'react-native';

export function useKeyboardTop(): number | null {
  const [top, setTop] = useState<number | null>(null);
  useEffect(() => {
    const showEvt =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e: KeyboardEvent) =>
      setTop(e.endCoordinates.screenY),
    );
    const hide = Keyboard.addListener(hideEvt, () => setTop(null));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return top;
}

export function useKeyboardOverlap(containerHeight: number): number {
  const keyboardTop = useKeyboardTop();
  if (keyboardTop == null || !containerHeight) {
    return 0;
  }
  return Math.max(0, Math.round(containerHeight - keyboardTop));
}
