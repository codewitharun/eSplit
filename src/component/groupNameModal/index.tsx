import React, {useState} from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Toast from 'react-native-toast-message';

interface GroupNameModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (groupName: string) => void;
}

const GroupNameModal: React.FC<GroupNameModalProps> = ({
  visible,
  onClose,
  onCreate,
}) => {
  const [groupName, setGroupName] = useState('');

  const handleCreate = () => {
    const trimmed = groupName.trim();
    if (trimmed.length < 3) {
      Toast.show({
        type: 'error',
        text1: 'Group name too short',
        text2: 'Please enter at least 3 characters.',
      });
      setGroupName('');
      return;
    }
    onCreate(trimmed);
    setGroupName('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Enter Group Name</Text>
          <TextInput
            placeholder="e.g. Trip to Goa"
            style={styles.input}
            value={groupName}
            onChangeText={setGroupName}
          />
          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCreate}
              style={styles.createButton}>
              <Text style={styles.createText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default GroupNameModal;

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#00000099',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    elevation: 5,
  },
  title: {
    fontSize: 18,
    marginBottom: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    color: 'black',
  },
  input: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    backgroundColor: '#ccc',
    padding: 10,
    borderRadius: 8,
    flex: 1,
    marginRight: 5,
  },
  createButton: {
    backgroundColor: '#2ecc71',
    padding: 10,
    borderRadius: 8,
    flex: 1,
    marginLeft: 5,
  },
  cancelText: {
    color: '#333',
    textAlign: 'center',
  },
  createText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});
