// src/component/KeyboardSafeScrollView.tsx
// A ScrollView that keeps the focused TextInput visible. Meant for content
// inside containers that already shrink above the keyboard (GeniePanel,
// KeyboardSafeOverlay, adjustResize screens) - so unlike
// KeyboardAwareScrollView it never adds its own keyboard-sized padding
// (that double-counted inside our panels). It only scrolls:
//   - when the keyboard appears,
//   - when its own viewport shrinks (the panel got shorter), and
//   - when focus moves to another field while the keyboard is up.

import React, {useCallback, useEffect, useImperativeHandle, useRef} from 'react';
import {Keyboard, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, Platform, ScrollView, ScrollViewProps, TextInput, View} from 'react-native';

const MARGIN = 24;

// React 19: `ref` is a normal prop. Callers get the underlying ScrollView
// (scrollTo, scrollToEnd, ...).
const KeyboardSafeScrollView = ({
  children,
  onLayout,
  onScroll,
  ref,
  ...rest
}: ScrollViewProps & {ref?: React.Ref<ScrollView | null>}) => {
  const scrollRef = useRef<ScrollView>(null);
  useImperativeHandle(ref, () => scrollRef.current as ScrollView, []);
  const contentRef = useRef<View>(null);
  const scrollY = useRef(0);
  const viewportH = useRef(0);
  const lastFocused = useRef<unknown>(null);

  const ensureVisible = useCallback(() => {
    const input: any = (TextInput.State as any).currentlyFocusedInput?.();
    if (!input || !contentRef.current || !scrollRef.current) {
      return;
    }
    lastFocused.current = input;
    try {
      input.measureLayout(
        contentRef.current as any,
        (_x: number, y: number, _w: number, h: number) => {
          const top = scrollY.current;
          const bottom = top + viewportH.current;
          if (y + h + MARGIN > bottom) {
            scrollRef.current?.scrollTo({
              y: y + h + MARGIN - viewportH.current,
              animated: true,
            });
          } else if (y - MARGIN < top) {
            scrollRef.current?.scrollTo({
              y: Math.max(0, y - MARGIN),
              animated: true,
            });
          }
        },
        () => {},
      );
    } catch {
      // measuring is best-effort only
    }
  }, []);

  useEffect(() => {
    const showEvt =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    let poll: ReturnType<typeof setInterval> | null = null;
    const show = Keyboard.addListener(showEvt, () => {
      setTimeout(ensureVisible, Platform.OS === 'ios' ? 280 : 80);
      // Focus moving between fields doesn't fire another keyboard event -
      // check cheaply while the keyboard is up.
      if (!poll) {
        poll = setInterval(() => {
          const now = (TextInput.State as any).currentlyFocusedInput?.();
          if (now && now !== lastFocused.current) {
            ensureVisible();
          }
        }, 300);
      }
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      if (poll) {
        clearInterval(poll);
        poll = null;
      }
      lastFocused.current = null;
    });
    return () => {
      show.remove();
      hide.remove();
      if (poll) {
        clearInterval(poll);
      }
    };
  }, [ensureVisible]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    const shrank = viewportH.current && h < viewportH.current;
    viewportH.current = h;
    if (shrank) {
      setTimeout(ensureVisible, 30);
    }
    onLayout?.(e);
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
    onScroll?.(e);
  };

  return (
    <ScrollView
      ref={scrollRef}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      {...rest}
      onLayout={handleLayout}
      onScroll={handleScroll}>
      <View ref={contentRef} collapsable={false}>
        {children}
      </View>
    </ScrollView>
  );
};

export default KeyboardSafeScrollView;
