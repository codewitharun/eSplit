// src/component/header/index.tsx
// A slim identity bar - no "Welcome back" greeting card, no waving emoji.
// The Groups screen's dashboard is the visual focus now; this just needs
// to say who you are and offer a way out, out of the way.

import React from 'react';
import {Image, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {LogOut, User} from 'lucide-react-native';
import {useAuthStore} from '../../store/useAuthStore';
import {signOut} from '../../services/auth';
import theme from '../../utils/theme';

const Header = () => {
  const user = useAuthStore(state => state.user);
  const setUser = useAuthStore(state => state.setUser);

  const handleLogout = async () => {
    try {
      await signOut();
      setUser(null);
    } catch (error) {
      console.log('Logout Error:', error);
    }
  };

  const firstName = (user?.displayName || '').split(' ')[0];

  return (
    <View style={styles.container}>
      {user?.photoURL ? (
        <Image source={{uri: user.photoURL}} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <User color={theme.color.inkSoft} size={18} />
        </View>
      )}
      <Text style={styles.name} numberOfLines={1}>
        {firstName || 'You'}
      </Text>
      <View style={{flex: 1}} />
      <TouchableOpacity
        onPress={handleLogout}
        style={styles.logoutBtn}
        hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
        <LogOut color={theme.color.inkFaint} size={17} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  avatar: {width: 30, height: 30, borderRadius: 15},
  avatarFallback: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.color.surfaceStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    color: theme.color.inkSoft,
    fontSize: 13.5,
    fontWeight: '600',
    marginLeft: 9,
  },
  logoutBtn: {padding: 4},
});

export default Header;
