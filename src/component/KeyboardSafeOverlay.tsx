// src/component/KeyboardSafeOverlay.tsx
// Full-screen dimmed overlay for small centred dialogs with a text input
// (rename group, add guest, delete-confirm...). Lifts its content above
// the keyboard by exactly the measured overlap (useKeyboardOverlap), so a
// centred card is never hidden behind the keyboard on either platform.

import React, {useState} from 'react';
import {StyleSheet, View, ViewStyle} from 'react-native';
import {useKeyboardOverlap} from '../hooks/useKeyboardOverlap';

interface Props {
  style?: ViewStyle | ViewStyle[];
  children: React.ReactNode;
}

const KeyboardSafeOverlay: React.FC<Props> = ({style, children}) => {
  const [height, setHeight] = useState(0);
  const overlap = useKeyboardOverlap(height);
  return (
    <View
      style={[
        styles.fill,
        style,
        overlap ? {paddingBottom: overlap + 12} : null,
      ]}
      onLayout={e => setHeight(e.nativeEvent.layout.height)}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  fill: {flex: 1},
});

export default KeyboardSafeOverlay;
