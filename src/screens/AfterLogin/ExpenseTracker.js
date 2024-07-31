import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import axios from 'axios';

const ExpenseTracker = ({ user, onLogoutPress }) => {

    const [description, setDescription] = useState('');
    const [totalExpense, setTotalExpense] = useState('');
    const [expenses, setExpenses] = useState([]);
    const [totalAmount, setTotalAmount] = useState(0);
    const [totalArun, setTotalArun] = useState(0);
    const [totalDheeraj, setTotalDheeraj] = useState(0);
    const [showTotal, setShowTotal] = useState(false)

    const getAllTokens = async () => {
        const snapshot = await firestore().collection('mobileUser').get();
        const tokens = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.token) {
                tokens.push(data.token);
            }
        });
        return tokens;
    };

    const onSavePress = async () => {
        console.log(user.displayName)
        if (!description || !totalExpense) {
            Alert.alert('Please fill all fields');
            return;
        }
        const authorizedUsers = ["Arun Kumar", "Arun Singh", "Dheeraj Tripathi"];
        if (!authorizedUsers.includes(user.displayName)) {
            Alert.alert('You are not authorized to add expenses');
            return;
        }


        const isArun = user.displayName === 'Arun Kumar';
        const totalExpenseValue = parseFloat(totalExpense);

        const arunShare = isArun ? 0 : totalExpenseValue / 2;
        const dheerajShare = isArun ? totalExpenseValue / 2 : 0;

        await firestore().collection('expenses').add({
            description,
            totalExpense: totalExpenseValue,
            paidBy: user.displayName,
            ArunShare: arunShare,
            DheerajShare: dheerajShare,
            timestamp: firestore.FieldValue.serverTimestamp(),
        });

        setDescription('');
        setTotalExpense('');

        const tokens = await getAllTokens();
        let data = {
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
    };

    useEffect(() => {
        if (user) {
            const unsubscribe = firestore()
                .collection('expenses')
                .orderBy('timestamp', 'desc')
                .onSnapshot((querySnapshot) => {
                    const expenses = [];
                    let total = 0;
                    let totalArun = 0;
                    let totalDheeraj = 0;
                    querySnapshot.forEach((documentSnapshot) => {
                        const expense = documentSnapshot.data();
                        expense.id = documentSnapshot.id;
                        expenses.push(expense);
                        total += expense.totalExpense;
                        if (expense.paidBy === 'Arun Kumar') {
                            totalArun += expense.totalExpense;
                        } else if (expense.paidBy === 'Dheeraj Tripathi') {
                            totalDheeraj += expense.totalExpense;
                        }
                    });
                    setExpenses(expenses);
                    setTotalAmount(total);
                    setTotalArun(totalArun);
                    setTotalDheeraj(totalDheeraj);
                });

            return () => unsubscribe();
        }
    }, [user]);

    const calculateBalance = () => {
        const total = totalAmount / 2;
        const arunOwes = totalArun - total;
        const dheerajOwes = totalDheeraj - total;
        return {
            arunOwes,
            dheerajOwes
        };
    };

    const formatDate = (timestamp) => {
        if (timestamp) {

            const date = timestamp.toDate();
            return date.toLocaleDateString(); // Format the date only
        }
    };

    const { arunOwes, dheerajOwes } = calculateBalance();

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Expense Tracker</Text>
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
                <Text style={styles.saveButtonText}>Add New </Text>
            </TouchableOpacity>

            <View style={{ display: showTotal ? 'flex' : "none" }}>
                <Text style={styles.totalText}>Total Amount:  {totalAmount}</Text>
                <Text style={styles.totalText}>Per Person:  {totalAmount / 2}</Text>
                <Text style={styles.totalText}>Arun's Total:  {totalArun}</Text>
                <Text style={styles.totalText}>Dheeraj's Total:  {totalDheeraj}</Text>
                <Text style={styles.totalText}>Arun Owes:  {arunOwes.toFixed(2)}</Text>
                <Text style={styles.totalText}>Dheeraj Owes:  {dheerajOwes.toFixed(2)}</Text>
            </View>


            <FlatList
                data={expenses}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <View style={styles.expenseItem}>
                        <Text style={styles.expenseText}>Description: {item.description}</Text>
                        <Text style={styles.expenseText}>Total Expense: {item.totalExpense}</Text>
                        <Text style={styles.expenseText}>Paid By: {item.paidBy} on {item && item.timestamp ? formatDate(item.timestamp) : null}</Text>
                        <Text style={styles.expenseText}>Arun's Share: {item.ArunShare}</Text>
                        <Text style={styles.expenseText}>Dheeraj's Share: {item.DheerajShare}</Text>

                    </View>
                )}
            />
            <TouchableOpacity style={styles.logoutButton} onPress={() => setShowTotal(!showTotal)}>
                <Text style={styles.logoutButtonText}>{showTotal ? "Hide Totol" : "Show Total"}</Text>
            </TouchableOpacity>
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
    title: {
        fontSize: 28,
        textAlign: 'center',
        marginBottom: 16,
        color: '#333',
        fontWeight: 'bold',
    },
    input: {
        height: 48,
        borderColor: '#ddd',
        borderWidth: 1,
        marginBottom: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: '#fff',
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
    totalText1: {
        fontSize: 20,
        textAlign: 'center',
        marginVertical: 16,
        color: '#333',
        fontWeight: 'bold',
    },
    totalText: {
        fontSize: 16,
        textAlign: 'center',
        marginVertical: 5,
        color: '#333',
        fontWeight: 'bold',
    },
    expenseItem: {
        borderWidth: 1,
        borderColor: '#ddd',
        padding: 16,
        marginVertical: 4,
        borderRadius: 8,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    expenseText: {
        fontSize: 16,
        color: '#333',
    },
    logoutButton: {
        backgroundColor: '#FF6347',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    logoutButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});

export default ExpenseTracker;
