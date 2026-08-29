// src/component/glass/Chip.tsx
// A single selectable pill - used for split-type pickers, category
// pickers, and filter chips throughout the redesigned screens.

import React from 'react';
import {StyleSheet, Text, TouchableOpacity} from 'react-native';
import {haptics} from '../../utils/haptics';
import theme from '../../utils/theme';

interface Props {
  label: string;
  active?: boolean;
  onPress: () => void;
}

const Chip: React.FC<Props> = ({label, active, onPress}) => (
  <TouchableOpacity
    style={[styles.chip, active && styles.chipActive]}
    onPress={() => {
      haptics.tap();
      onPress();
    }}>
    <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {
    backgroundColor: theme.color.blue,
    borderColor: theme.color.blue,
  },
  label: {
    fontSize: 12.5,
    color: theme.color.inkSoft,
    fontWeight: '600',
  },
  labelActive: {
    color: theme.color.onAccent,
  },
});

export default Chip;
