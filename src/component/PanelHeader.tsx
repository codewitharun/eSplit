// src/component/PanelHeader.tsx
// Header row for GeniePanel content: tinted icon badge, title + subtitle,
// optional extra action(s), and a close button. Shared by the AI chat and
// the New group panel so both look like one family.

import {X} from 'lucide-react-native';
import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {BodyFont, DisplayFont, moderateScale} from '../utils/fonts';
import theme from '../utils/theme';

interface Props {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  onClose: () => void;
}

const PanelHeader: React.FC<Props> = ({
  icon,
  title,
  subtitle,
  actions,
  onClose,
}) => (
  <View style={styles.header}>
    <View style={styles.iconBadge}>{icon}</View>
    <View style={styles.mid}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {!!subtitle && (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      )}
    </View>
    {actions}
    <TouchableOpacity
      style={styles.btn}
      onPress={onClose}
      accessibilityLabel="Close"
      hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
      <X size={19} color={theme.color.ink} />
    </TouchableOpacity>
  </View>
);

export const panelHeaderButtonStyle = {padding: 6};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56,217,201,0.12)',
  },
  mid: {flex: 1},
  title: {
    fontFamily: DisplayFont.bold,
    color: theme.color.ink,
    fontSize: moderateScale(15.5),
    fontWeight: '700',
  },
  subtitle: {
    fontFamily: BodyFont.regular,
    color: theme.color.inkFaint,
    fontSize: moderateScale(11.5),
    marginTop: 1,
  },
  btn: panelHeaderButtonStyle,
});

export default PanelHeader;
