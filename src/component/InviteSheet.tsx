// src/component/InviteSheet.tsx
// Dark, in-app invite sheet (Activity's Invite button, Settings' Invite).
// Replaces jumping straight to Android's system share sheet, which is
// light/dark per the phone's system theme and headed "Sharing text" -
// neither of which an app can change. Here: the join code (copy), and
// one-tap WhatsApp / Copy link / More (system sheet as the fallback).

import {Copy, Link2, MessageCircle, Share2, X} from 'lucide-react-native';
import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {groupInviteUrl} from '../config/urls';
import {useModalOpenGuard} from '../hooks/useModalOpenGuard';
import {
  buildInviteMessage,
  copyToClipboard,
  shareInviteOnWhatsApp,
  shareInviteViaSystem,
} from '../services/invite';
import {BodyFont, DisplayFont, MonoFont, moderateScale} from '../utils/fonts';
import {haptics} from '../utils/haptics';
import theme from '../utils/theme';
import GlassCard from './glass/GlassCard';
import {ToastLayer} from './glass/ToastHost';

interface Props {
  visible: boolean;
  onClose: () => void;
  groupId: string;
  groupName?: string;
  joinCode?: string;
}

const InviteSheet: React.FC<Props> = ({
  visible,
  onClose,
  groupId,
  groupName,
  joinCode,
}) => {
  const insets = useSafeAreaInsets();
  const canClose = useModalOpenGuard(visible);
  const message = buildInviteMessage(groupId, groupName, joinCode);
  const close = () => {
    if (canClose()) {
      onClose();
    }
  };

  const actions = [
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      icon: <MessageCircle size={20} color={theme.color.green} />,
      onPress: () => {
        haptics.tap();
        shareInviteOnWhatsApp(message);
      },
    },
    {
      key: 'link',
      label: 'Copy link',
      icon: <Link2 size={20} color={theme.color.teal} />,
      onPress: () => copyToClipboard(groupInviteUrl(groupId), 'Invite link'),
    },
    {
      key: 'more',
      label: 'More',
      icon: <Share2 size={20} color={theme.color.inkSoft} />,
      onPress: () => {
        haptics.tap();
        shareInviteViaSystem(message);
      },
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableWithoutFeedback onPress={close}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        <GlassCard
          opaque
          style={StyleSheet.flatten([
            styles.sheet,
            {paddingBottom: Math.max(insets.bottom, 16) + 10},
          ])}>
          <View style={styles.headerRow}>
            <View style={styles.flex}>
              <Text style={styles.title} numberOfLines={1}>
                Invite to {groupName || 'this group'}
              </Text>
              <Text style={styles.subtitle}>
                They'll send a request - an admin approves it.
              </Text>
            </View>
            <TouchableOpacity
              onPress={close}
              accessibilityLabel="Close"
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <X size={20} color={theme.color.ink} />
            </TouchableOpacity>
          </View>

          {!!joinCode && (
            <View style={styles.codeBox}>
              <View style={styles.flex}>
                <Text style={styles.codeLabel}>Join code</Text>
                <Text style={styles.code} selectable>
                  {joinCode}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={() => copyToClipboard(joinCode, 'Join code')}
                accessibilityLabel="Copy join code">
                <Copy size={15} color={theme.color.ink} />
                <Text style={styles.copyText}>Copy</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.actions}>
            {actions.map(a => (
              <TouchableOpacity
                key={a.key}
                style={styles.action}
                activeOpacity={0.8}
                onPress={a.onPress}
                accessibilityLabel={a.label}>
                <View style={styles.actionIcon}>{a.icon}</View>
                <Text style={styles.actionText}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </GlassCard>
      </View>
      <ToastLayer />
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1},
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6,5,12,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  headerRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 12},
  title: {
    color: theme.color.ink,
    fontFamily: DisplayFont.bold,
    fontSize: moderateScale(17),
    fontWeight: '700',
  },
  subtitle: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(12.5),
    marginTop: 3,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  codeLabel: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(11.5),
  },
  code: {
    color: theme.color.ink,
    fontFamily: MonoFont,
    fontSize: moderateScale(24),
    letterSpacing: 4,
    marginTop: 2,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.surfaceStrong,
  },
  copyText: {
    color: theme.color.ink,
    fontFamily: BodyFont.semibold,
    fontSize: moderateScale(13),
    fontWeight: '600',
  },
  actions: {flexDirection: 'row', gap: 10, marginTop: 16},
  action: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  actionText: {
    color: theme.color.ink,
    fontFamily: BodyFont.semibold,
    fontSize: moderateScale(12.5),
    fontWeight: '600',
  },
});

export default InviteSheet;
