// src/component/MemberAvatar.tsx
// Small lettered avatar for a member/group - initials on a deterministic
// accent colour derived from the id (same palette idea as GroupCheck's
// group chips). Purely cosmetic; nothing stored.

import React from 'react';
import {StyleSheet, View, ViewStyle} from 'react-native';
import {Text} from './ui/AppText';
import {BodyFont} from '../utils/fonts';
import theme from '../utils/theme';

const PALETTE = [
  theme.color.blue,
  theme.color.teal,
  theme.color.green,
  theme.color.rose,
  theme.color.amber,
  theme.color.blueBright,
];

export function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    // eslint-disable-next-line no-bitwise
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  const first = parts[0][0] || '';
  const second = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + second).toUpperCase();
}

interface Props {
  id: string;
  name: string;
  size?: number;
  style?: ViewStyle;
  ring?: boolean; // outline in the ground colour, for overlapping stacks
}

const MemberAvatar: React.FC<Props> = ({id, name, size = 30, style, ring}) => (
  <View
    accessibilityLabel={name}
    style={[
      styles.circle,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colorForId(id),
      },
      ring && styles.ring,
      style,
    ]}>
    <Text style={[styles.text, {fontSize: size * 0.38}]}>
      {initialsOf(name)}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  circle: {alignItems: 'center', justifyContent: 'center'},
  ring: {borderWidth: 2, borderColor: theme.color.modalSurface},
  text: {
    color: theme.color.onAccent,
    fontFamily: BodyFont.bold,
    fontWeight: '800',
  },
});

export default MemberAvatar;
