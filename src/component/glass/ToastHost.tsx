// src/component/glass/ToastHost.tsx
// The visual half of the in-house toast (see src/services/toast.ts) -
// mounted once at the app root (App.jsx), same as react-native-toast-
// message's own <Toast /> used to be. Slides down from the top, themed to
// match the rest of the app's dark glass cards instead of the library's
// default white banner.

import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {CircleCheck, CircleX, Info} from 'lucide-react-native';
import {useToastStore} from '../../services/toast';
import theme from '../../utils/theme';

const ICONS = {
  success: CircleCheck,
  error: CircleX,
  info: Info,
};

const ACCENTS = {
  success: theme.color.green,
  error: theme.color.rose,
  info: theme.color.blue,
};

const ToastHost: React.FC = () => {
  const toast = useToastStore(s => s.toast);
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-40)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (toast) {
      translateY.setValue(-40);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 16,
          mass: 0.9,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -40,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [toast, translateY, opacity]);

  if (!toast) {
    return null;
  }

  const Icon = ICONS[toast.type];
  const accent = ACCENTS[toast.type];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + 8,
          opacity,
          transform: [{translateY}],
        },
      ]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => useToastStore.setState({toast: null})}
        style={[styles.card, {borderLeftColor: accent}]}>
        <Icon size={20} color={accent} />
        <View style={styles.textCol}>
          {!!toast.text1 && <Text style={styles.text1}>{toast.text1}</Text>}
          {!!toast.text2 && <Text style={styles.text2}>{toast.text2}</Text>}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 9999,
    elevation: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    width: '100%',
    maxWidth: 480,
    backgroundColor: theme.color.modalSurface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderLeftWidth: 4,
    borderRadius: theme.radius.md,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowOffset: {width: 0, height: 8},
    shadowRadius: 16,
    elevation: 8,
  },
  textCol: {flex: 1},
  text1: {color: theme.color.ink, fontWeight: '700', fontSize: 14},
  text2: {color: theme.color.inkSoft, fontSize: 12.5, marginTop: 2},
});

export default ToastHost;
