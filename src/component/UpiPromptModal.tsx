// src/component/UpiPromptModal.tsx
// Inline replacement for the old "alert, then navigate to the You tab"
// UPI nudge in GroupCheck.tsx. That flow worked but cost the user two
// screens and a lost place in the app for what's really a single text
// field. This puts the field directly in the alert itself - same
// glass-modal pattern as groupNameModal - and writes straight to
// Firestore, so adding a UPI ID from here never leaves the group screen.
//
// Deliberately skippable (a "Later" button, not a hard block): forcing
// this before letting someone into a group would lock out anyone who
// genuinely doesn't have UPI yet (cash-only groups, no UPI account).
// GroupCheck.tsx re-shows this once per app session for as long as the
// user has no upiId saved - naggy, but never a dead end.

import React, {useState} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Toast from '../services/toast';
import GlassCard from './glass/GlassCard';
import {isValidUpiVpa} from '../services/ledger/upi';
import {haptics} from '../utils/haptics';
import theme from '../utils/theme';

interface UpiPromptModalProps {
  visible: boolean;
  uid: string;
  onSkip: () => void;
  onSaved: () => void;
}

const UpiPromptModal: React.FC<UpiPromptModalProps> = ({
  visible,
  uid,
  onSkip,
  onSaved,
}) => {
  const [upiId, setUpiId] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (saving || !uid) {
      return;
    }
    const trimmed = upiId.trim();
    if (!trimmed) {
      Toast.show({
        type: 'error',
        text1: 'Enter a UPI ID',
        text2: 'e.g. name@bank',
      });
      return;
    }
    if (!isValidUpiVpa(trimmed)) {
      Toast.show({
        type: 'error',
        text1: 'That doesn’t look like a UPI ID',
        text2: 'e.g. name@bank',
      });
      return;
    }
    setSaving(true);
    try {
      await firestore()
        .collection('users')
        .doc(uid)
        .set({upiId: trimmed}, {merge: true});
      haptics.success();
      Toast.show({type: 'success', text1: 'UPI ID saved'});
      setUpiId('');
      onSaved();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not save',
        text2: error?.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    if (saving) {
      return;
    }
    setUpiId('');
    onSkip();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={saving ? undefined : handleSkip}>
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}>
        <TouchableWithoutFeedback onPress={saving ? undefined : handleSkip}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        <GlassCard opaque style={styles.modalContent}>
          <Text style={styles.title}>Add your UPI ID</Text>
          <Text style={styles.subtitle}>
            Other members in this group can't pay you back over UPI until you
            add one - they'll only get a manual settle option instead.
          </Text>
          <TextInput
            placeholder="e.g. name@okhdfcbank"
            style={styles.input}
            value={upiId}
            onChangeText={setUpiId}
            placeholderTextColor={theme.color.inkFaint}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            editable={!saving}
          />
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={handleSkip}
              disabled={saving}
              style={[styles.skipButton, saving && styles.buttonDisabled]}>
              <Text style={styles.skipText}>Later</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={[styles.saveButton, saving && styles.buttonDisabled]}>
              {saving ? (
                <ActivityIndicator color={theme.color.onAccent} size="small" />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </GlassCard>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(6,5,12,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {width: '85%'},
  title: {
    fontSize: 18,
    marginBottom: 8,
    fontWeight: '700',
    textAlign: 'center',
    color: theme.color.ink,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
    color: theme.color.inkSoft,
    lineHeight: 18,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    padding: 12,
    marginBottom: 18,
    color: theme.color.ink,
  },
  buttonContainer: {flexDirection: 'row', gap: 10},
  skipButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: 12,
    borderRadius: theme.radius.md,
  },
  saveButton: {
    flex: 1,
    backgroundColor: theme.color.blue,
    padding: 12,
    borderRadius: theme.radius.md,
  },
  skipText: {
    color: theme.color.inkSoft,
    textAlign: 'center',
    fontWeight: '600',
  },
  saveText: {
    color: theme.color.onAccent,
    textAlign: 'center',
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default UpiPromptModal;
