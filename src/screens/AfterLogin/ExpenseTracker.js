import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Alert, FlatList, StyleSheet, TouchableOpacity, Share } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import moment from 'moment';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DatePicker from './DatePicker';

const ExpenseTracker = ({ navigation }) => {
    const user = auth().currentUser;
    const [description, setDescription] = useState('');
    const [totalExpense, setTotalExpense] = useState('');
    const [expenses, setExpenses] = useState([]);
    const [totalAmount, setTotalAmount] = useState(0);
    const [userExpenses, setUserExpenses] = useState({});
    const [showTotal, setShowTotal] = useState(false);
    const [totalUsers, setTotalUsers] = useState([]);
    const [groupKey, setGroupKey] = useState("");
    const [selectedDate, setSelectedDate] = useState('');

    const url = "https://install.appcenter.ms/users/arun4appcenter/apps/esplit/distribution_groups/public"
    const getAllTokens = async () => {
        try {
            const snapshot = await firestore().collection('Esplitusers').get();
            const tokens = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                const groupKeys = data.groupKeys || [];

                if (groupKeys.includes(groupKey) && data.tokens) {
                    tokens.push(data.tokens);
                }
            });

            return tokens;
        } catch (error) {
            console.log("🚀 ~ getAllTokens ~ error:", error);
            return [];
        }
    };

    const onSavePress = async () => {
        try {
            if (!description || !totalExpense) {
                Alert.alert('Please fill all fields');
                return;
            }

            if (!totalUsers.some(u => u.displayName === user.displayName)) {
                Alert.alert('You are not authorized to add expenses');
                return;
            }

            const currentUser = totalUsers.find(u => u.displayName === user.displayName);
            const totalExpenseValue = parseFloat(totalExpense);
            const userShares = totalUsers.reduce((acc, u) => {
                if (u.displayName === currentUser.displayName || (u.joinDate && u.joinDate > new Date().toISOString())) {
                    // User either paid for the expense or joined after the expense was added
                    acc[u.displayName] = 0;
                } else {
                    acc[u.displayName] = totalExpenseValue / (totalUsers.length - 1); // Exclude the current user from splitting
                }
                return acc;
            }, {});

            console.log(userShares);
            await firestore().collection('Esplitgroups').doc(groupKey).collection("expenses").add({
                description,
                totalExpense: totalExpenseValue,
                paidBy: user.displayName,
                ...userShares,
                timestamp: new Date().toISOString() // Store as ISO string
            });

            setDescription('');
            setTotalExpense('');

            const tokens = await getAllTokens();
            const data = {
                title: "Expense added",
                body: `New expense added by ${user.displayName}`,
                tokens: tokens
            };

            try {
                const response = await axios.post("https://esplit-backend.vercel.app/send-notification", data);
                console.log('Notification sent successfully:', response.data);
            } catch (error) {
                console.error('Error sending notification:', error.response ? error.response.data : error.message);
            }
        } catch (error) {
            console.log("🚀 ~ onSavePress ~ error:", error);
        }
    };
    const fetchGroupKey = async () => {
        try {
            const key = await AsyncStorage.getItem("groupKey");
            if (key) {
                console.log("🚀 ~ fetchGroupKey ~ key:", key)
                setGroupKey(key);
            }
        } catch (error) {
            console.error('Error fetching group key:', error);
        }
    };
    const fetchGroupData = async () => {
        try {
            const snapshot = await firestore().collection('Esplitgroups').doc(groupKey).get();
            if (snapshot.exists) {
                const groupData = snapshot.data();
                console.log("🚀 ~ useEffect ~ groupData:", groupData);

                const members = groupData.members || [];
                setTotalUsers(members);
            } else {
                console.log('Group document does not exist.');
                await AsyncStorage.removeItem("groupKey");
                await AsyncStorage.removeItem('hasCheckedGroup');
                navigation.goBack();
            }
        } catch (error) {
            console.error('Error retrieving group data:', error);
        }
    };


    useEffect(() => {
        fetchGroupKey()
        if (!groupKey) return;
        fetchGroupData();

        const unsubscribe = firestore().collection('Esplitgroups').doc(groupKey).collection('expenses')
            .orderBy('timestamp', 'desc')
            .onSnapshot(querySnapshot => {
                const expenses = [];
                const userExpenses = {};
                let total = 0;

                querySnapshot.forEach(documentSnapshot => {
                    const expense = documentSnapshot.data();
                    expense.id = documentSnapshot.id;
                    expenses.push(expense);
                    total += expense.totalExpense;

                    if (!userExpenses[expense.paidBy]) {
                        userExpenses[expense.paidBy] = 0;
                    }
                    userExpenses[expense.paidBy] += expense.totalExpense;
                });

                setExpenses(expenses);
                setTotalAmount(total);
                setUserExpenses(userExpenses);
            }, error => {
                console.error('Error fetching expenses:', error);
            });



        return () => unsubscribe();
    }, [groupKey, navigation]);

    const calculateBalance = () => {
        const totalPerUser = totalAmount / totalUsers.length;
        const userBalances = {};

        totalUsers.forEach(u => {
            let userTotalExpenses = 0;

            // Sum up expenses after the user joined the group
            expenses.forEach(expense => {
                if (u.joinDate && expense.timestamp > u.joinDate) { // Compare as ISO strings
                    if (expense.paidBy === u.displayName) {
                        userTotalExpenses += expense.totalExpense;
                    }
                }
            });

            // Calculate how much the user owes or is owed
            const owes = userTotalExpenses - totalPerUser;
            userBalances[u.displayName] = owes;
        });

        return userBalances;
    };

    const userBalances = calculateBalance();
    const onShare = async (groupKey) => {
        try {
            const result = await Share.share({
                message:
                    `🎉 You're invited to join Esplit! 🎉\n\nManage your expenses and split bills with ease.\n\n🔗 Join Esplit using this link: ${url}\n\nOr, if you're joining my group, use this group key: ${groupKey} to be part of our group. Let's simplify splitting expenses together! 💰`,
            });

            if (result.action === Share.sharedAction) {
                if (result.activityType) {
                    console.log(`Shared with activity type: ${result.activityType}`);
                } else {
                    console.log('Shared successfully');
                }
            } else if (result.action === Share.dismissedAction) {
                console.log('Share dismissed');
            }
        } catch (error) {
            Alert.alert('Sharing failed', error.message);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.headerContainer}>
                <Text style={styles.title}>Expense Tracker</Text>

                <View style={styles.userInfoContainer}>
                    <Text style={styles.userCountText}>Users: {totalUsers.length}</Text>

                    <TouchableOpacity onPress={() => onShare(groupKey)} style={styles.shareButton}>
                        <Text style={styles.shareButtonText}>Invite</Text>
                        <Icon name="share" size={20} color="black" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* <DatePicker selectedDate={selectedDate} setSelectedDate={setSelectedDate} /> */}
            <TextInput
                style={styles.input}
                placeholder="Description"
                value={description}
                onChangeText={setDescription}
                placeholderTextColor={'#333'}
            />
            <TextInput
                style={styles.input}
                placeholder="Total Expense"
                placeholderTextColor={'#333'}
                keyboardType="numeric"
                value={totalExpense}
                onChangeText={setTotalExpense}
            />


            <TouchableOpacity style={styles.saveButton} onPress={onSavePress}>
                <Text style={styles.saveButtonText}>Add New</Text>
            </TouchableOpacity>

            <View style={{ display: showTotal ? 'flex' : 'none' }}>
                <Text style={styles.totalText}>Total Amount: {totalAmount}</Text>
                <Text style={styles.totalText}>Per Person: {totalAmount / totalUsers.length}</Text>
                {totalUsers.map((u, index) => (
                    <Text key={index} style={styles.totalText}>{u.displayName}'s Total: {userExpenses[u.displayName]}</Text>
                ))}
                {Object.keys(userBalances).map((key, index) => (
                    <Text key={index} style={styles.totalText}>{key} Owes: {userBalances[key].toFixed(2)}</Text>
                ))}
            </View>

            <FlatList
                data={expenses}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (

                    <View View style={styles.expenseItem}>
                        {console.log(item)}
                        <Text style={styles.expenseText}>Description: {item.description}</Text>
                        <Text style={styles.expenseText}>Total Expense: {item.totalExpense}</Text>
                        <Text style={styles.expenseText}>Paid By: {item.paidBy} on {moment(item.timestamp).format('DD MMM  YY [at] h:mm a')}</Text>
                        {Object.keys(item).map((key, index) => {
                            if (key !== 'description' && key !== 'totalExpense' && key !== 'paidBy' && key !== 'timestamp' && key !== 'id') {
                                return <Text key={index} style={styles.expenseText}>{key}'s Share: {item[key]}</Text>
                            }
                            return null;
                        })}
                    </View>
                )
                }
            />
            < TouchableOpacity style={styles.toggleButton} onPress={() => setShowTotal(!showTotal)}>
                <Text style={styles.toggleButtonText}>{showTotal ? 'Hide Total' : 'Show Total'}</Text>
            </TouchableOpacity >
        </View >
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 16,
        backgroundColor: '#f7f7f7',
    },

    input: {
        height: 48,
        borderColor: '#ddd',
        borderWidth: 1,
        marginBottom: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: '#fff',
        color: '#333'
    },
    saveButton: {
        backgroundColor: '#4CAF50',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginVertical: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },

    totalText: {
        fontSize: 16,
        textAlign: 'center',
        marginVertical: 5,
        color: '#333',
        fontWeight: '600',
    },

    expenseItem: {
        padding: 16,
        marginVertical: 8,
        backgroundColor: '#fff',
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    expenseText: {
        fontSize: 16,
        color: '#333',
    },
    toggleButton: {
        backgroundColor: '#2196F3',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginVertical: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    toggleButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    headerContainer: {
        justifyContent: 'space-between',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: '#F5F5F5',
        width: "100%"
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2D2D2D',
    },
    userInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    userCountText: {
        fontSize: 16,
        marginRight: 15,
        color: '#2D2D2D',
    },
    shareButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E0E0E0',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 5,
    },
    shareButtonText: {
        fontSize: 16,
        color: '#000',
        marginRight: 5,
    },

});

export default ExpenseTracker;
