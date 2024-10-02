import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Modal, FlatList, Alert } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GroupManagement = ({ navigation }) => {
    const [groupKey, setGroupKey] = useState('');
    const [groupList, setGroupList] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const user = auth().currentUser;

    useEffect(() => {
        // Fetch the user's groups from Firestore
        const fetchGroups = async () => {
            const userDoc = await firestore().collection('Esplitusers').doc(user.uid).get();
            if (userDoc.exists) {
                const userGroups = userDoc.data().groupKeys || [];
                setGroupList(userGroups);
            }
        };
        fetchGroups();
    }, []);

    const handleJoinGroup = async () => {
        const joinGroupKey = selectedGroup || groupKey;
        if (joinGroupKey) {
            // Check if the group exists in the 'Esplit/groups' collection
            const groupDoc = await firestore().collection('Esplitgroups').doc(joinGroupKey).get();
            if (groupDoc.exists) {
                // Add the group key to the user's groupKeys array
                await firestore().collection('Esplitusers').doc(user.uid).set(
                    {
                        groupKeys: firestore.FieldValue.arrayUnion(joinGroupKey)
                    },
                    { merge: true }
                );

                // Add the user to the group's members array
                await firestore().collection('Esplitgroups').doc(joinGroupKey).update({
                    members: firestore.FieldValue.arrayUnion({
                        id: user.uid,
                        displayName: user.displayName,
                        photoUrl: user.photoURL || ""
                    })
                });
                await AsyncStorage.setItem("groupKey", joinGroupKey)
                await AsyncStorage.setItem('hasCheckedGroup', "true");
                navigation.navigate('Home');
            } else {
                Alert.alert('Invalid Group Key', 'The group key you entered does not exist.');
            }
        } else {
            Alert.alert('Error', 'Please select a group or enter a valid group key.');
        }
    };

    const handleCreateGroup = async () => {
        try {
            const newGroupKey = generateGroupKey();

            // Create a new group in the 'Esplit/groups' collection
            await firestore().collection('Esplitgroups').doc(newGroupKey).set({
                createdBy: {
                    id: user.uid,
                    displayName: user.displayName,
                    photoUrl: user.photoURL || ""
                },
                members: [{
                    id: user.uid,
                    displayName: user.displayName,
                    photoUrl: user.photoURL || ""
                }],
                createdAt: firestore.FieldValue.serverTimestamp(),
            });
            await AsyncStorage.setItem("groupKey", newGroupKey)
            // Add the new group key to the user's document in the 'Esplit/users' collection
            await firestore().collection('Esplitusers').doc(user.uid).set(
                {
                    groupKeys: firestore.FieldValue.arrayUnion(newGroupKey)
                },
                { merge: true }
            );
            await AsyncStorage.setItem('hasCheckedGroup', "true");
            navigation.navigate('Home');
        } catch (error) {
            console.log("🚀 ~ handleCreateGroup ~ error:", error);
            Alert.alert('Error', 'An error occurred while creating the group. Please try again.');
        }
    };

    const generateGroupKey = () => {
        return Math.floor(100000 + Math.random() * 900000).toString();
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Join or Create a Group</Text>

            <TouchableOpacity style={styles.input} onPress={() => setModalVisible(true)}>
                <Text>{selectedGroup ? selectedGroup : "Select a group to join"}</Text>
            </TouchableOpacity>

            <TextInput
                style={styles.input}
                placeholder="Or enter 6-digit Group Key"
                keyboardType="numeric"
                maxLength={6}
                value={groupKey}
                onChangeText={setGroupKey}
            />

            <TouchableOpacity style={styles.button} onPress={handleJoinGroup}>
                <Text style={styles.buttonText}>Join Group</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={handleCreateGroup}>
                <Text style={styles.buttonText}>Create New Group</Text>
            </TouchableOpacity>

            {/* Modal for selecting a group */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalView}>
                        <Text style={styles.modalTitle}>Select Group</Text>
                        <FlatList
                            data={groupList}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.groupItem}
                                    onPress={() => {
                                        setSelectedGroup(item);
                                        setModalVisible(false);
                                    }}
                                >
                                    <Text>{item}</Text>
                                </TouchableOpacity>
                            )}
                            keyExtractor={(item) => item}
                        />
                        <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
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
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#f5f5f5',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    input: {
        width: '100%',
        padding: 10,
        borderColor: '#ccc',
        borderWidth: 1,
        borderRadius: 5,
        marginBottom: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    button: {
        width: '100%',
        backgroundColor: '#007BFF',
        borderRadius: 5,
        padding: 10,
        marginBottom: 10,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalView: {
        width: '80%',
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#333',
    },
    groupItem: {
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
        width: '100%',
        alignItems: 'center',
    },
    closeButton: {
        backgroundColor: '#FF0000',
        borderRadius: 5,
        padding: 10,
        marginTop: 10,
        width: '100%',
        alignItems: 'center',
    },
    closeButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default GroupManagement;
