import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, Alert } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import axios from 'axios';



const ExpenseTracker = ({ user, onLogoutPress }) => {

    const [description, setDescription] = useState('');
    const [totalExpense, setTotalExpense] = useState('');
    const [expenses, setExpenses] = useState([]);
    const [totalAmount, setTotalAmount] = useState(0);
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
        if (!description || !totalExpense) {
            Alert.alert('Please fill all fields');
            return;
        }

        const isArun = user.displayName === 'Arun Kumar';
        const myShare = isArun ? 0 : parseFloat(totalExpense) / 2;
        const otherShare = isArun ? parseFloat(totalExpense) / 2 : 0;

        await firestore().collection('expenses').add({

            description,
            totalExpense: parseFloat(totalExpense),
            paidBy: user.displayName,
            ArunShare: isArun ? 0 : otherShare,
            DheerajShare: isArun ? otherShare : 0,
            timestamp: firestore.FieldValue.serverTimestamp(),
        });

        setDescription('');
        setTotalExpense('');
        const tokens = await getAllTokens();
        console.log("🚀 ~ onSavePress ~ tokens:", tokens)
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
                    querySnapshot.forEach((documentSnapshot) => {
                        const expense = documentSnapshot.data();
                        expense.id = documentSnapshot.id;
                        expenses.push(expense);
                        total += expense.totalExpense;
                    });
                    setExpenses(expenses);
                    setTotalAmount(total);
                });

            return () => unsubscribe();
        }
    }, [user]);
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Expense Tracker</Text>
            <TextInput
                style={styles.input}
                placeholder="Description"
                value={description}
                onChangeText={setDescription}
            />
            <TextInput
                style={styles.input}
                placeholder="Total Expense"
                keyboardType="numeric"
                value={totalExpense}
                onChangeText={setTotalExpense}
            />
            <Button title="Save" onPress={onSavePress} />


            <Text style={styles.totalText}>Total Amount: {totalAmount}</Text>
            <Text style={styles.totalText}>Per Person Amount: {(totalAmount / 2).toFixed(2)}</Text>

            <FlatList
                data={expenses}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <View style={styles.expenseItem}>
                        <Text>Description: {item.description}</Text>
                        <Text>Total Expense: {item.totalExpense}</Text>
                        <Text>Paid By: {item.paidBy}</Text>
                        <Text>Arun's Share: {item.ArunShare}</Text>
                        <Text>Dheeraj's Share: {item.DheerajShare}</Text>
                    </View>
                )}
            />
            <Button title="Logout" onPress={() => { onLogoutPress() }} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 16,
    },
    title: {
        fontSize: 24,
        textAlign: 'center',
        marginBottom: 16,
    },
    input: {
        height: 40,
        borderColor: 'gray',
        borderWidth: 1,
        marginBottom: 12,
        paddingHorizontal: 8,
    },
    totalText: {
        fontSize: 20,
        textAlign: 'center',
        marginVertical: 16,
    },
    expenseItem: {
        borderWidth: 1,
        borderColor: 'gray',
        padding: 8,
        marginVertical: 4,
    },
});

export default ExpenseTracker;
