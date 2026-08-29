// src/component/groupNameModal/index.tsx
// Restyled to the glass theme + wrapped in KeyboardAvoidingView so the
// keyboard never covers the single text field on smaller phones.

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
import Toast from '../../services/toast';
import GlassCard from '../glass/GlassCard';
import theme from '../../utils/theme';

interface GroupNameModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (groupName: string) => void;
  loading?: boolean;
}

const GroupNameModal: React.FC<GroupNameModalProps> = ({
  visible,
  onClose,
  onCreate,
  loading = false,
}) => {
  const [groupName, setGroupName] = useState('');

  const handleCreate = () => {
    // Guard against a second tap landing while the first Create is still
    // in flight (Firestore write) - previously nothing here disabled the
    // button or showed feedback inside the modal itself, so a user could
    // fire off a duplicate createGroup() before the modal had a chance to
    // close.
    if (loading) {
      return;
    }
    const trimmed = groupName.trim();
    if (trimmed.length < 3) {
      Toast.show({
        type: 'error',
        text1: 'Group name too short',
        text2: 'Please enter at least 3 characters.',
      });
      return;
    }
    onCreate(trimmed);
    setGroupName('');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={loading ? undefined : onClose}>
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}>
        <TouchableWithoutFeedback onPress={loading ? undefined : onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        <GlassCard opaque style={styles.modalContent}>
          <Text style={styles.title}>Name your group</Text>
          <TextInput
            placeholder="e.g. Trip to Goa"
            style={styles.input}
            value={groupName}
            onChangeText={setGroupName}
            placeholderTextColor={theme.color.inkFaint}
            autoFocus
            editable={!loading}
          />
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={onClose}
              disabled={loading}
              style={[styles.cancelButton, loading && styles.buttonDisabled]}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCreate}
              disabled={loading}
              style={[styles.createButton, loading && styles.buttonDisabled]}>
              {loading ? (
                <ActivityIndicator color={theme.color.onAccent} size="small" />
              ) : (
                <Text style={styles.createText}>Create</Text>
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
    marginBottom: 14,
    fontWeight: '700',
    textAlign: 'center',
    color: theme.color.ink,
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
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: 12,
    borderRadius: theme.radius.md,
  },
  createButton: {
    flex: 1,
    backgroundColor: theme.color.blue,
    padding: 12,
    borderRadius: theme.radius.md,
  },
  cancelText: {
    color: theme.color.inkSoft,
    textAlign: 'center',
    fontWeight: '600',
  },
  createText: {
    color: theme.color.onAccent,
    textAlign: 'center',
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default GroupNameModal;
