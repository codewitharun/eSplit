// src/component/GroupSwitcherPill.tsx
// A plain "switch group" action - the screen's own title already shows
// the current group's name, so this doesn't repeat it.

import {useNavigation} from '@react-navigation/native';
import {ArrowLeftRight} from 'lucide-react-native';
import React from 'react';
import {StyleSheet, Text, TouchableOpacity, ViewStyle} from 'react-native';
import theme from '../utils/theme';
import {haptics} from '../utils/haptics';

interface Props {
  // Lets a caller override layout-only props (e.g. zero out the default
  // marginTop when this sits inline next to other text instead of alone
  // below a title).
  style?: ViewStyle;
}

const GroupSwitcherPill: React.FC<Props> = ({style}) => {
  const navigation = useNavigation<any>();

  return (
    <TouchableOpacity
      style={[styles.pill, style]}
      onPress={() => {
        haptics.tap();
        navigation.getParent()?.navigate('Group-Check');
      }}>
      <ArrowLeftRight size={12} color={theme.color.inkSoft} />
      <Text style={styles.text}>Switch group</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 5,
    marginTop: 6,
    gap: 6,
  },
  text: {color: theme.color.inkSoft, fontSize: 11.5, fontWeight: '600'},
});

export default GroupSwitcherPill;
