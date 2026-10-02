// src/component/header/index.tsx
// Redesigned for the 2026 dashboard refresh: a gradient-ring avatar, a
// time-of-day greeting + name (replacing the old flat "name only" bar),
// and a bell icon action.
//
// The avatar is now the entry point to the standalone Profile screen
// (identity, logout, delete account) instead of logging out directly -
// this header used to carry its own bare logout icon, but that duplicated
// what Profile now owns, so it's gone in favor of one clear place for
// account actions: tap the avatar.
//
// The bell opens the standalone Notifications screen (join requests,
// announcements, admin-sent personal messages) - it used to be a
// placeholder toast before that screen existed.

import React from 'react';
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Image, StyleSheet, TouchableOpacity, View} from 'react-native';
import {Text} from '../ui/AppText';
import {Bell, User} from 'lucide-react-native';
import {useAuthStore} from '../../store/useAuthStore';
import GradientView from '../glass/GradientView';
import theme from '../../utils/theme';
import {Typography} from '../../utils/fonts';

const AVATAR_OUTER = 46;
const AVATAR_INNER = 39;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) {
    return 'Still up?';
  }
  if (hour < 12) {
    return 'Good morning';
  }
  if (hour < 17) {
    return 'Good afternoon';
  }
  if (hour < 21) {
    return 'Good evening';
  }
  return 'Good night';
}

const Header = () => {
  const user = useAuthStore(state => state.user);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const handleAvatarPress = () => {
    navigation.navigate('Profile');
  };

  const handleBellPress = () => {
    navigation.navigate('Notifications');
  };

  const firstName = (user?.displayName || '').split(' ')[0];

  return (
    <View style={[styles.container, {paddingTop: insets.top + 14}]}>
      <TouchableOpacity
        onPress={handleAvatarPress}
        style={styles.avatarRingOuter}
        hitSlop={{top: 6, bottom: 6, left: 6, right: 6}}>
        <GradientView
          colors={theme.gradient.hero}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.avatarRingInner}>
          {user?.photoURL ? (
            <Image source={{uri: user.photoURL}} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <User color={theme.color.inkSoft} size={17} />
            </View>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.greetingWrap}
        onPress={handleAvatarPress}
        activeOpacity={0.7}>
        <Text style={styles.greetingCaption} numberOfLines={1}>
          {getGreeting()}
        </Text>
        <Text style={styles.greetingName} numberOfLines={1}>
          {firstName || 'there'}
        </Text>
      </TouchableOpacity>

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={handleBellPress}
          style={styles.iconBtn}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          <Bell color={theme.color.inkSoft} size={17} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    // paddingTop comes from the safe-area inset above, computed at render
    // time - it used to be a flat 56 here, which happened to clear the
    // status bar on devices where the OS forces the app to draw behind it
    // (Android 15+) but left too little room, or the wrong amount, on
    // devices/OS versions where it doesn't.
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  avatarRingOuter: {
    width: AVATAR_OUTER,
    height: AVATAR_OUTER,
    borderRadius: AVATAR_OUTER / 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarRingInner: {
    width: AVATAR_INNER,
    height: AVATAR_INNER,
    borderRadius: AVATAR_INNER / 2,
    backgroundColor: theme.color.ground,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatar: {width: AVATAR_INNER, height: AVATAR_INNER},
  avatarFallback: {
    width: AVATAR_INNER,
    height: AVATAR_INNER,
    backgroundColor: theme.color.surfaceStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  greetingWrap: {
    marginLeft: 11,
    flexShrink: 1,
  },
  greetingCaption: {
    color: theme.color.inkFaint,
    ...Typography.caption,
    letterSpacing: 0,
    textTransform: 'none',
  },
  greetingName: {
    color: theme.color.ink,
    ...Typography.subtitle,
    marginTop: 1,
  },
  actions: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.color.surfaceStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default Header;
