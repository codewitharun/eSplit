// src/component/glass/AppAlertHost.tsx
// The visual half of the themed alert (see src/services/appAlert.ts) -
// mounted once at the app root (App.jsx). Button styling mirrors
// GroupNameModal's Cancel/Create pattern (bordered vs filled) so
// confirmation dialogs look consistent with the rest of the app instead
// of the OS's native Alert chrome.

import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import GlassCard from './GlassCard';
import {AppAlertButton, useAppAlertStore} from '../../services/appAlert';
import theme from '../../utils/theme';

const AppAlertHost: React.FC = () => {
  const alert = useAppAlertStore(s => s.alert);

  if (!alert) {
    return null;
  }

  const close = () => useAppAlertStore.setState({alert: null});

  const handlePress = (button: AppAlertButton) => {
    close();
    // Match Alert.alert's own timing convention: the dialog closes first,
    // then the button's action runs, so an onPress that itself shows
    // another alert (or a toast) doesn't race the dismiss animation.
    button.onPress?.();
  };

  const stacked = alert.buttons.length > 2;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={close}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        <GlassCard opaque style={styles.card}>
          <Text style={styles.title}>{alert.title}</Text>
          {!!alert.message && (
            <Text style={styles.message}>{alert.message}</Text>
          )}
          <View style={[styles.buttonRow, stacked && styles.buttonColumn]}>
            {alert.buttons.map((button, index) => (
              <TouchableOpacity
                key={`${button.text}-${index}`}
                style={[
                  styles.button,
                  stacked && styles.buttonFullWidth,
                  button.style === 'destructive' && styles.destructiveButton,
                  button.style !== 'destructive' &&
                    button.style !== 'cancel' &&
                    styles.primaryButton,
                ]}
                onPress={() => handlePress(button)}>
                <Text
                  style={[
                    styles.buttonText,
                    button.style === 'cancel' && styles.cancelText,
                    button.style === 'destructive' && styles.destructiveText,
                    button.style !== 'destructive' &&
                      button.style !== 'cancel' &&
                      styles.primaryText,
                  ]}>
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </GlassCard>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(6,5,12,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {width: '100%', maxWidth: 360},
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.color.ink,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: theme.color.inkSoft,
    lineHeight: 20,
    marginBottom: 18,
  },
  buttonRow: {flexDirection: 'row', gap: 10},
  buttonColumn: {flexDirection: 'column'},
  button: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.color.border,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  buttonFullWidth: {flex: undefined, width: '100%'},
  primaryButton: {backgroundColor: theme.color.blue, borderWidth: 0},
  destructiveButton: {
    backgroundColor: 'transparent',
    borderColor: theme.color.rose,
  },
  buttonText: {fontWeight: '700', fontSize: 14, color: theme.color.inkSoft},
  primaryText: {color: theme.color.onAccent},
  cancelText: {color: theme.color.inkSoft},
  destructiveText: {color: theme.color.rose},
});

export default AppAlertHost;
