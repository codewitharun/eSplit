// src/component/glass/ForceUpdateGate.tsx
// Mounted once at the app root (App.jsx), alongside ToastHost/AppAlertHost.
// Runs one Firestore check per app launch (see src/services/appConfig.ts)
// and reacts one of three ways: does nothing (status "ok"), shows a
// dismissible themed AppAlert suggesting an update ("nudge"), or - only for
// a version below the configured floor - renders a full-screen, genuinely
// unskippable "please update" screen that also swallows the Android
// hardware back button so it can't be bypassed.

import React, {useEffect, useState} from 'react';
import {
  BackHandler,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import GlassCard from './GlassCard';
import theme from '../../utils/theme';
import AppAlert from '../../services/appAlert';
import {checkAppConfig, openPlayStore} from '../../services/appConfig';

interface BlockedInfo {
  message?: string;
}

const ForceUpdateGate: React.FC = () => {
  const [blocked, setBlocked] = useState<BlockedInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    checkAppConfig().then(result => {
      if (cancelled) {
        return;
      }
      if (result.status === 'blocked') {
        setBlocked({message: result.message});
      } else if (result.status === 'nudge') {
        AppAlert.alert(
          'Update available',
          result.message ||
            `A newer version of EzySplit${
              result.latestVersion ? ` (${result.latestVersion})` : ''
            } is available.`,
          [
            {text: 'Later', style: 'cancel'},
            {text: 'Update now', onPress: openPlayStore},
          ],
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // While blocked, swallow Android's hardware back button too - otherwise
  // it would pop the gate's Modal (via onRequestClose) or back out of the
  // app, both of which defeat the point of a *required* update.
  useEffect(() => {
    if (!blocked) {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [blocked]);

  if (!blocked) {
    return null;
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <GlassCard opaque style={styles.card}>
          <Text style={styles.title}>Update required</Text>
          <Text style={styles.message}>
            {blocked.message ||
              'This version of EzySplit is no longer supported. Update to keep using the app.'}
          </Text>
          <TouchableOpacity style={styles.button} onPress={openPlayStore}>
            <Text style={styles.buttonText}>Update now</Text>
          </TouchableOpacity>
        </GlassCard>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.color.ground,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {width: '100%', maxWidth: 360},
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: theme.color.ink,
    marginBottom: 10,
  },
  message: {
    fontSize: 14,
    color: theme.color.inkSoft,
    lineHeight: 20,
    marginBottom: 22,
  },
  button: {
    backgroundColor: theme.color.blue,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  buttonText: {color: theme.color.onAccent, fontWeight: '700', fontSize: 15},
});

export default ForceUpdateGate;
