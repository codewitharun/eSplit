import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useFocusEffect} from '@react-navigation/native';

const GroupManagement = ({navigation}) => {
  const [groupKey, setGroupKey] = useState('');
  const [groupList, setGroupList] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const user = auth().currentUser;

  useFocusEffect(
    useCallback(() => {
      const fetchGroups = async () => {
        const userDoc = await firestore()
          .collection('Esplitusers')
          .doc(user.uid)
          .get();
        if (userDoc.exists) {
          const userGroups = userDoc.data().groupKeys || [];
          setGroupList(userGroups);
        }
      };

      fetchGroups();
    }, [user.uid]),
  );

  const handleJoinGroup = async () => {
    const joinGroupKey = selectedGroup || groupKey;
    if (joinGroupKey) {
      const groupDoc = await firestore()
        .collection('Esplitgroups')
        .doc(joinGroupKey)
        .get();
      if (groupDoc.exists) {
        const groupData = groupDoc.data();
        const members = groupData.members || [];
        const isUserAlreadyMember = members.some(
          member => member.id === user.uid,
        );

        if (!isUserAlreadyMember) {
          await firestore()
            .collection('Esplitusers')
            .doc(user.uid)
            .set(
              {groupKeys: firestore.FieldValue.arrayUnion(joinGroupKey)},
              {merge: true},
            );

          await firestore()
            .collection('Esplitgroups')
            .doc(joinGroupKey)
            .update({
              members: firestore.FieldValue.arrayUnion({
                id: user.uid,
                displayName: user.displayName,
                photoUrl: user.photoURL || '',
                joinDate: new Date().toISOString(),
              }),
            });

          await AsyncStorage.setItem('groupKey', joinGroupKey);
          await AsyncStorage.setItem('hasCheckedGroup', 'true');
          navigation.navigate('Home');
        } else {
          console.log('You are already a member of this group.');
          await AsyncStorage.setItem('groupKey', joinGroupKey);
          await AsyncStorage.setItem('hasCheckedGroup', 'true');
          navigation.navigate('Home');
        }
      } else {
        Alert.alert(
          'Invalid Group Key',
          'The group key you entered does not exist.',
        );
      }
    } else {
      Alert.alert('Error', 'Please select a group or enter a valid group key.');
    }
  };

  const handleCreateGroup = async () => {
    try {
      const newGroupKey = generateGroupKey();

      await firestore()
        .collection('Esplitgroups')
        .doc(newGroupKey)
        .set({
          createdBy: {
            id: user.uid,
            displayName: user.displayName,
            photoUrl: user.photoURL || '',
          },
          members: [
            {
              id: user.uid,
              displayName: user.displayName,
              photoUrl: user.photoURL || '',
              joinDate: new Date().toISOString(),
            },
          ],
          createdAt: new Date().toISOString(),
        });

      await firestore()
        .collection('Esplitusers')
        .doc(user.uid)
        .set(
          {groupKeys: firestore.FieldValue.arrayUnion(newGroupKey)},
          {merge: true},
        );

      await AsyncStorage.setItem('groupKey', newGroupKey);
      await AsyncStorage.setItem('hasCheckedGroup', 'true');
      navigation.navigate('Home');
    } catch (error) {
      console.log('Error:', error);
      Alert.alert(
        'Error',
        'An error occurred while creating the group. Please try again.',
      );
    }
  };

  const generateGroupKey = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join or Create a Group</Text>

      <TouchableOpacity
        style={styles.input}
        onPress={() => setModalVisible(true)}>
        <Text style={{color: selectedGroup ? '#000' : '#888'}}>
          {selectedGroup ? selectedGroup : 'Select a group to join'}
        </Text>
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="Enter 6-digit Group Key"
        keyboardType="numeric"
        maxLength={6}
        value={groupKey}
        onChangeText={setGroupKey}
        placeholderTextColor="#888"
      />

      <TouchableOpacity style={styles.button} onPress={handleJoinGroup}>
        <Text style={styles.buttonText}>Join Group</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.createButton]}
        onPress={handleCreateGroup}>
        <Text style={styles.buttonText}>Create New Group</Text>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Select Group</Text>
            <FlatList
              data={groupList}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={styles.groupItem}
                  onPress={() => {
                    setSelectedGroup(item);
                    setModalVisible(false);
                  }}>
                  <Text style={styles.groupText}>{item}</Text>
                </TouchableOpacity>
              )}
              keyExtractor={item => item}
            />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
    backgroundColor: '#f7f8fa',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#2c3e50',
    textAlign: 'center',
  },
  input: {
    width: '100%',
    padding: 12,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: '#fff',
    marginBottom: 20,
    justifyContent: 'center',
    color: '#000',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: {width: 0, height: 1},
    shadowRadius: 4,
    elevation: 2,
  },
  button: {
    width: '100%',
    backgroundColor: '#3498db',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: {width: 0, height: 2},
    shadowRadius: 5,
    elevation: 5,
  },
  createButton: {
    backgroundColor: '#2ecc71',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalView: {
    backgroundColor: '#fff',
    padding: 20,
    marginHorizontal: 30,
    borderRadius: 10,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#2c3e50',
  },
  groupItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    alignItems: 'center',
  },
  groupText: {
    fontSize: 16,
    color: '#34495e',
  },
  closeButton: {
    backgroundColor: '#e74c3c',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default GroupManagement;
