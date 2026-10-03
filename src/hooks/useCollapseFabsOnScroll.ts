// src/hooks/useCollapseFabsOnScroll.ts
// Returns an onScroll handler for a screen's main ScrollView/FlatList
// that collapses the floating create buttons to icon-only while the user
// scrolls down and re-extends them on scroll up or near the top (the
// standard "extended FAB" behaviour). Also resets them to extended every
// time the screen comes into focus. Pair with scrollEventThrottle={16}.

import {useFocusEffect} from '@react-navigation/native';
import {useCallback, useRef} from 'react';
import {NativeScrollEvent, NativeSyntheticEvent} from 'react-native';
import {useFloatingUiStore} from '../store/useFloatingUiStore';

const TOP_ZONE = 24; // px from the top where labels always show
const DIRECTION_THRESHOLD = 6; // ignore tiny jitters

export function useCollapseFabsOnScroll() {
  const lastY = useRef(0);
  const setFabCompact = useFloatingUiStore(s => s.setFabCompact);

  useFocusEffect(
    useCallback(() => {
      lastY.current = 0;
      setFabCompact(false);
    }, [setFabCompact]),
  );

  return useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const dy = y - lastY.current;
      lastY.current = y;
      if (y < TOP_ZONE) {
        setFabCompact(false);
      } else if (dy > DIRECTION_THRESHOLD) {
        setFabCompact(true);
      } else if (dy < -DIRECTION_THRESHOLD) {
        setFabCompact(false);
      }
    },
    [setFabCompact],
  );
}
