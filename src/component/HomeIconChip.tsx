// src/component/HomeIconChip.tsx
// A compact, icon-only chip that jumps straight back to the dashboard
// (navigation.getParent()?.navigate('Group-Check')). This used to be a
// real Tab.Screen in BottomTabNavigator.tsx's bottom bar, positioned
// first in the row - but a same-row "tab" that actually EXITS the group
// (rather than switching to a peer view like Activity/Balances/Settings
// do) broke the bottom bar's own convention and sat right next to the
// most-tapped tab, making it too easy to hit by accident. Before that it
// was a separate floating circle overlapping the tab pill's edge.
//
// Living in the header instead - paired visually with GroupSwitcherPill
// on the header's other side - keeps it a single deliberate tap, away
// from the tab-switching gesture entirely, without resorting to a plain
// "back" arrow (this app already uses a back button for literal
// backwards navigation elsewhere; this is a distinct "go to dashboard"
// action, so it gets its own glyph and its own chip).

import {Home as HomeIcon} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import React from 'react';
import {StyleSheet, TouchableOpacity, ViewStyle} from 'react-native';
import {haptics} from '../utils/haptics';
import theme from '../utils/theme';

interface Props {
  // Lets a caller override layout-only props (e.g. spacing/alignment
  // when this sits inline in a header row next to a title or pill).
  style?: ViewStyle;
}

const HomeIconChip: React.FC<Props> = ({style}) => {
  const navigation = useNavigation<any>();
  return (
    <TouchableOpacity
      style={[styles.chip, style]}
      hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
      onPress={() => {
        haptics.tap();
        navigation.getParent()?.navigate('Group-Check');
      }}>
      <HomeIcon size={18} color={theme.color.ink} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.surfaceStrong,
    borderWidth: 1,
    borderColor: theme.color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default HomeIconChip;
