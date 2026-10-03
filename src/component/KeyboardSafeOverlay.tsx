// src/component/KeyboardSafeOverlay.tsx
// Full-screen dimmed overlay for small centred dialogs with a text input
// (rename group, add guest, delete-confirm...). Lifts its content above
// the keyboard by exactly the measured overlap (useKeyboardOverlap), so a
// centred card is never hidden behind the keyboard on either platform.
// Also hosts a ToastLayer so toasts fired while the dialog is open show
// above it (the dialog lives in a native Modal).

import React, {useState} from 'react';
import {StyleSheet, View, ViewStyle} from 'react-native';
import {useKeyboardOverlap} from '../hooks/useKeyboardOverlap';
import {ToastLayer} from './glass/ToastHost';

interface Props {
  style?: ViewStyle | ViewStyle[];
  children: React.ReactNode;
}

const KeyboardSafeOverlay: React.FC<Props> = ({style, children}) => {
  const [height, setHeight] = useState(0);
  const overlap = useKeyboardOverlap(height);
  return (
    <View style={styles.fill}>
      <View
        style={[
          styles.fill,
          style,
          overlap ? {paddingBottom: overlap + 12} : null,
        ]}
        onLayout={e => setHeight(e.nativeEvent.layout.height)}>
        {children}
      </View>
      <ToastLayer />
    </View>
  );
};

const styles = StyleSheet.create({
  fill: {flex: 1},
});

export default KeyboardSafeOverlay;
