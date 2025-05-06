import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  FlatList,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useIsFocused, useRoute} from '@react-navigation/native';
import {useExpenseState} from '../../store/useExpenseStore';
import Loader from '../../component/loader';
import GroupNameModal from '../../component/groupNameModal';
import Header from '../../component/header';
import Icon from 'react-native-vector-icons/FontAwesome';
import DashedDividerWithText from '../../component/dividerwithdash';
import DashedDivider from '../../component/divider';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import Toast from 'react-native-toast-message';

const GroupManagement = ({navigation}) => {
  const groupKey = useExpenseState(state => state.groupKey);
  const setGroupKey = useExpenseState(state => state.setGroupKey);
  const [loader, setLoader] = useState(false);
  const [lastGroupKey, setLastGroupKey] = useState(null);
  const incomingDeeplink = useExpenseState(state => state.incomingDeeplink);
  const setincomingDeeplink = useExpenseState(
    state => state.setincomingDeeplink,
  );
  const [groupNameModal, setGroupNameModal] = useState(false);
  const [groupKeyLocal, setgroupKeyLocal] = useState('');
  const [groupList, setGroupList] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const user = auth().currentUser;
  const focused = useIsFocused();

  const route = useRoute();
  const {groupId} = route.params || {};
  console.log('🚀 ~ GroupManagement ~ groupId:', groupId);

  useEffect(() => {
    if (groupId) {
      handleJoinGroup(groupId);
      AsyncStorage.setItem('groupHandled', JSON.stringify(true));
      setincomingDeeplink(false);
    }
  }, [incomingDeeplink]);

  useEffect(() => {
    fetchGroups();
    lastgroup();
  }, [focused]);

  const fetchGroups = async () => {
    try {
      const userDoc = await firestore()
        .collection('Esplitusers')
        .doc(user?.uid)
        .get();

      if (userDoc.exists) {
        const groupKeys = userDoc.data().groupKeys || [];

        const groupPromises = groupKeys.map(async key => {
          const doc = await firestore()
            .collection('Esplitgroups')
            .doc(key)
            .get();
          if (doc.exists) {
            return {
              key,
              name: doc.data()?.groupName || key, // fallback if groupName is missing
            };
          }
          return null;
        });

        const groups = (await Promise.all(groupPromises)).filter(Boolean);
        setGroupList(groups);
      }
    } catch (error) {
      console.log('🚀 ~ fetchGroups ~ error:', error);
    }
  };

  const handleJoinGroup = async joinGroupKey => {
    try {
      if (!user || !user.uid) {
        Toast.show({
          type: 'error',
          text1: 'error',
          text2: 'User not logged in properly.',
        });
        return;
      }

      if (!joinGroupKey) {
        Toast.show({
          type: 'error',
          text1: 'error',
          text2: 'Please select a group or enter a valid group key.',
        });
        return;
      }
      const groupDoc = await firestore()
        .collection('Esplitgroups')
        .doc(joinGroupKey)
        .get();

      if (!groupDoc.exists) {
        Toast.show({
          type: 'error',
          text1: 'error',
          text2: 'The group key you entered does not exist.',
        });

        return;
      }
      setLoader(true);
      const groupData = groupDoc.data();
      const members = Array.isArray(groupData?.members)
        ? groupData.members
        : [];

      const isUserAlreadyMember = members.some(
        member => member.id === user.uid,
      );

      if (!isUserAlreadyMember) {
        if (groupData?.isLocked) {
          Toast.show({
            type: 'error',
            text1: 'Group Locked',
            text2:
              'This group has already recorded its first expense. No new members can join.',
          });

          setLoader(false);
          return;
        }

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
      }

      setGroupKey(joinGroupKey);
      await AsyncStorage.setItem('groupKey', joinGroupKey);
      await AsyncStorage.setItem('lastJoinedGroup', joinGroupKey);
      navigation.navigate('Home');
      setLoader(false);
    } catch (error) {
      setLoader(false);
      console.log('🚀 ~ handleJoinGroup ~ error:', error);
    }
  };

  const handleCreateGroup = async groupName => {
    try {
      setLoader(true);
      const newGroupKey = await generateGroupKey(groupName);

      await firestore()
        .collection('Esplitgroups')
        .doc(newGroupKey)
        .set({
          groupName: groupName,
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
      setGroupKey(newGroupKey);
      await AsyncStorage.setItem('groupKey', newGroupKey);
      await AsyncStorage.setItem('lastJoinedGroup', newGroupKey);
      navigation.navigate('Home');
      setLoader(false);
    } catch (error) {
      setLoader(false);
      console.log('Error:', error);
      Toast.show({
        type: 'error',
        text1: 'Group Locked',
        text2: 'An error occurred while creating the group. Please try again.',
      });
    }
  };

  const generateGroupKey = async groupName => {
    const slug = groupName.trim().toLowerCase().replace(/\s+/g, '-');
    const shortId = Math.floor(100 + Math.random() * 900); // 3-digit
    return `${slug}-${shortId}`;
  };

  const lastgroup = async () => {
    const group = await AsyncStorage.getItem('lastJoinedGroup');
    if (group) {
      setLastGroupKey(group);
    }
  };
  return (
    <View style={styles.container}>
      {/* header view */}
      <Header />
      <KeyboardAwareScrollView>
        <View style={{flex: 0.9, justifyContent: 'center'}}>
          <Text style={styles.title}>Let’s get you into a group!</Text>
          <Text style={styles.subtitle}>
            You can create a new group or join one with a code.
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>🔑 Join an Existing Group</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setModalVisible(true)}>
              <Text style={{color: selectedGroup ? '#000' : '#888'}}>
                <Icon name="chevron-down" size={20} color="#888" /> Select a
                group to join
              </Text>
            </TouchableOpacity>
            <DashedDivider />
            <Text style={styles.cardTitle}>
              📩 Enter the group code below to join an existing one.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter Group Key to Join"
              value={groupKeyLocal}
              onFocus={() => setSelectedGroup('')}
              onChangeText={text => {
                setgroupKeyLocal(text);
              }}
              placeholderTextColor="#888"
            />
            <TouchableOpacity
              style={styles.button}
              onPress={() => handleJoinGroup(groupKeyLocal)}>
              <Text style={styles.buttonText}>Join Group</Text>
            </TouchableOpacity>
          </View>
          <DashedDividerWithText />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>🎯 Create a New Group</Text>

            <TouchableOpacity
              style={[styles.button, styles.createButton]}
              onPress={() => setGroupNameModal(true)}>
              <Text style={styles.buttonText}>Create New Group</Text>
            </TouchableOpacity>
          </View>
        </View>
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
                      setSelectedGroup(item?.key);
                      setgroupKeyLocal('');
                      setModalVisible(false);
                      handleJoinGroup(item?.key); // Use the group key for joining
                    }}>
                    <Text style={styles.groupText}>{item.name}</Text>
                    {/* Display group name */}
                  </TouchableOpacity>
                )}
                keyExtractor={item => item.key}
              />
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}>
                <Text style={styles.closeButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <GroupNameModal
          visible={groupNameModal}
          onClose={() => setGroupNameModal(false)}
          onCreate={handleCreateGroup}
        />
      </KeyboardAwareScrollView>
      {lastGroupKey && (
        <TouchableOpacity
          onPress={() => handleJoinGroup(lastGroupKey)}
          style={styles.shareButton}>
          <Text style={styles.shareButtonText}>
            Last Joined Group: {lastGroupKey}
          </Text>
          {/* <Icon name="share" size={20} color="black" /> */}
        </TouchableOpacity>
      )}
      <Loader loader={loader} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    // backgroundColor: 'red',
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 14,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: {width: 0, height: 2},
    shadowRadius: 6,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: '#777',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 36,
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
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    position: 'absolute',
    bottom: 10,
    width: '100%',
    alignSelf: 'center',
  },
  shareButtonText: {
    fontSize: 16,
    color: '#000',
    marginRight: 5,
  },
});

export default GroupManagement;
