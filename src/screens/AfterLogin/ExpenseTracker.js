import React, {useState, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Share,
  Button,
  ToastAndroid,
} from 'react-native';
import Toast from 'react-native-toast-message';
import RNFS from 'react-native-fs';
import firestore from '@react-native-firebase/firestore';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import moment from 'moment';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DatePicker from './DatePicker';
import {useIsFocused} from '@react-navigation/native';
import {useExpenseState} from '../../store/useExpenseStore';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import notifee from '@notifee/react-native';
import Notifications from '../Notifications';
import {Download} from 'lucide-react-native';

const ExpenseTracker = ({navigation}) => {
  const user = auth().currentUser;
  const [description, setDescription] = useState('');
  const [totalExpense, setTotalExpense] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [userExpenses, setUserExpenses] = useState({});
  const [showTotal, setShowTotal] = useState(false);
  const [totalUsers, setTotalUsers] = useState([]);
  const [hasTransactions, setHasTransactions] = useState(false);
  const groupKey = useExpenseState(state => state.groupKey);
  const [loader, setLoader] = useState(false);
  const focused = useIsFocused();

  useEffect(() => {
    console.log('🚀 ~ useEffect ~ groupKey:', groupKey);
    fetchGroupData();

    const unsubscribe = firestore()
      .collection('Esplitgroups')
      .doc(groupKey)
      .collection('expenses')
      .orderBy('timestamp', 'desc')
      .onSnapshot(
        querySnapshot => {
          const expensess = [];
          const userExpensess = {};
          let total = 0;

          querySnapshot.forEach(documentSnapshot => {
            const expense = documentSnapshot.data();
            expense.id = documentSnapshot.id;
            expensess.push(expense);
            total += expense.totalExpense;

            if (!userExpensess[expense.paidBy]) {
              userExpensess[expense.paidBy] = 0;
            }
            userExpensess[expense.paidBy] += expense.totalExpense;
          });
          setHasTransactions(expensess.length > 0);
          setExpenses(expensess);
          setTotalAmount(total);
          setUserExpenses(userExpensess);
        },
        error => {
          console.error('Error fetching expenses', error);
        },
      );

    return () => unsubscribe();
  }, [focused]);
  // const url = `ezysplit://Group-Check/${groupKey}`;
  const url = `https://ezysplit.appaura.xyz/app/Group-Check/${groupKey}`;
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
      console.log('🚀 ~ getAllTokens ~ error:', error);
      return [];
    }
  };

  const onSavePress = async () => {
    try {
      if (!description || !totalExpense) {
        Toast.show({
          type: 'info',
          text1: 'Field Incomplete',
          text2: 'Please fill all fields',
        });
        return;
      }

      if (!totalUsers.some(u => u.displayName === user.displayName)) {
        Toast.show({
          type: 'error',
          text1: 'Unauthorize Member',
          text2: 'You are not authorized to add expenses',
        });
        return;
      }
      setLoader(true);
      // Check if it's the first transaction in the group
      const expensesSnapshot = await firestore()
        .collection('Esplitgroups')
        .doc(groupKey)
        .collection('expenses')
        .limit(1)
        .get();

      const proceedWithTransaction = async () => {
        try {
          const currentUser = totalUsers.find(
            u => u.displayName === user.displayName,
          );
          const totalExpenseValue = parseFloat(totalExpense);
          const perHead = totalExpenseValue / totalUsers.length;

          const userShares = totalUsers.reduce((acc, u) => {
            if (
              u.displayName === currentUser.displayName ||
              (u.joinDate && u.joinDate > new Date().toISOString())
            ) {
              acc[u.displayName] = 0;
            } else {
              acc[u.displayName] = perHead;
            }
            return acc;
          }, {});

          console.log(userShares);

          // Add expense record to Firestore
          await firestore()
            .collection('Esplitgroups')
            .doc(groupKey)
            .collection('expenses')
            .add({
              description,
              totalExpense: totalExpenseValue,
              paidBy: user.displayName,
              ...userShares,
              timestamp: new Date().toISOString(),
            });

          // Lock the group if it's the first transaction
          if (expensesSnapshot.empty) {
            await firestore()
              .collection('Esplitgroups')
              .doc(groupKey)
              .update({isLocked: true});
          }

          // Reset input fields
          setDescription('');
          setTotalExpense('');

          // Send notifications
          const tokens = await getAllTokens();
          const data = {
            title: 'Expense added',
            body: `New expense of ${totalExpenseValue} added by ${user.displayName}`,
            tokens,
          };

          try {
            const response = await axios.post(
              'https://ezysplit.appaura.xyz/send-notification',
              data,
            );
            console.log('Notification sent successfully:', response.data);
          } catch (error) {
            setLoader(false);
            console.error(
              'Error sending notification:',
              error.response ? error.response.data : error.message,
            );
          }
        } catch (error) {
          setLoader(false);
          Toast.show({
            type: 'error',
            text1: 'Error ',
            text2: 'Error processing the transaction. Please try again.',
          });
          console.log('Error during the transaction process:', error);
        }
      };

      // First transaction — alert before proceeding
      if (expensesSnapshot.empty) {
        Alert.alert(
          'Confirm First Transaction',
          'Before initiating the first transaction, make sure all group members have joined. After this, no new member can join.\n\nDo you want to proceed?',
          [
            {text: 'Cancel', style: 'cancel'},
            {text: 'Proceed', onPress: proceedWithTransaction},
          ],
        );
      } else {
        // Not the first transaction — proceed directly
        proceedWithTransaction();
      }
    } catch (error) {
      setLoader(false);
      console.log('Error in onSavePress:', error);
    }
  };

  const fetchGroupData = async () => {
    try {
      const snapshot = await firestore()
        .collection('Esplitgroups')
        .doc(groupKey)
        .get();
      if (snapshot.exists) {
        const groupData = snapshot.data();

        const members = groupData.members || [];
        setTotalUsers(members);
      } else {
        await AsyncStorage.removeItem('groupKey');
        await AsyncStorage.removeItem('lastJoinedGroup');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error retrieving group data:', error);
    }
  };

  const calculateBalance = () => {
    const totalPerUser = totalAmount / totalUsers.length; // Equal share per user
    const userBalances = {};

    totalUsers.forEach(u => {
      let userTotalExpenses = 0;

      expenses.forEach(expense => {
        if (expense.paidBy === u.displayName) {
          userTotalExpenses += expense.totalExpense; // Summing up the expenses paid by the user
        }
      });

      // Balance: How much the user has paid vs how much they should have paid
      const owes = userTotalExpenses - totalPerUser;
      userBalances[u.displayName] = owes;
    });

    return userBalances;
  };
  const userBalances = calculateBalance();

  const onShare = async groupID => {
    try {
      const result = await Share.share({
        message: `🎉 Join me on Esplit!\n\nManage & split expenses easily.\n\n🔗 Tap to join my group: ${url}\n\nOr use this group key: ${groupID}\n\nLet’s make splitting simple! 💰`,
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
      Toast.show({
        type: 'error',
        text1: 'Sharing failed',
        text2: error.message,
      });
    }
  };

  const generatePDF = async () => {
    try {
      const currentDate = new Date();
      const monthYear = `${currentDate.toLocaleString('default', {
        month: 'long',
      })}-${currentDate.getFullYear()}`;
      const fileName = `ezysplit-${monthYear}`;

      const perPerson = totalAmount / totalUsers.length;

      const htmlContent = `
    <h1 style="text-align:center;">Your Monthly Expenses</h1>
    <p><strong>Total Amount:</strong> ₹${totalAmount}</p>
    <p><strong>Per Person:</strong> ₹${perPerson.toFixed(2)}</p>
    
    <h2>User Contributions:</h2>
    <table border="1" cellspacing="0" cellpadding="5" style="width:100%;">
      <tr><th>Name</th><th>Total Paid</th></tr>
      ${totalUsers
        .map(
          u =>
            `<tr><td>${u.displayName}</td><td>₹${
              userExpenses[u.displayName] || 0
            }</td></tr>`,
        )
        .join('')}
    </table>

    <h2>User Balances:</h2>
    <table border="1" cellspacing="0" cellpadding="5" style="width:100%;">
      <tr><th>Name</th><th>Owes</th></tr>
      ${Object.keys(userBalances)
        .map(
          key =>
            `<tr><td>${key}</td><td>₹${userBalances[key].toFixed(2)}</td></tr>`,
        )
        .join('')}
    </table>
        <h3 style="text-align:center;">Created with ❤️ by Arun</h3>

  `;

      const options = {
        html: htmlContent,
        fileName: fileName,
        directory: 'Download',
      };

      const file = await RNHTMLtoPDF.convert(options);
      Notifications.displayExportedNotification({
        title: 'PDF Exported',
        body: 'Tap to view',
        filePath: file.filePath,
        channelId: 'Export',
      });

      Toast.show({
        text2Style: {
          height: 30,
          flexWrap: 'wrap',
        },
        type: 'success',
        text1: 'PDF Exported Successfully!',
        text2: `Your File is saved at ${file.filePath}`,
        onPress: () => {
          Toast.show({
            type: 'info',
            text1: 'Coming Soon!',
            text2: 'Click to open the PDF feature coming soon.',
          });
        },
      });
      console.log('PDF saved at:', file.filePath);
    } catch (error) {
      console.log('🚀 ~ generatePDF ~ error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Expense Tracker</Text>

        <View style={styles.userInfoContainer}>
          <Text style={styles.userCountText}>Users: {totalUsers.length}</Text>
          {!hasTransactions && (
            <TouchableOpacity
              onPress={() => onShare(groupKey)}
              style={styles.shareButton}>
              <Text style={styles.shareButtonText}>Invite</Text>
              <Icon name="share" size={20} color="black" />
            </TouchableOpacity>
          )}
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
        keyboardType="decimal-pad"
        value={totalExpense}
        onChangeText={text => {
          const decimalValue = text
            .replace(/[^0-9.]/g, '')
            .replace(/(\..*)\./g, '$1');
          setTotalExpense(decimalValue);
        }}
      />

      <TouchableOpacity style={styles.saveButton} onPress={onSavePress}>
        <Text style={styles.saveButtonText}>Add New</Text>
      </TouchableOpacity>

      <View style={{display: showTotal ? 'flex' : 'none'}}>
        <TouchableOpacity
          onPress={() => generatePDF()}
          style={styles.shareButton}>
          <Text style={styles.shareButtonText}>Export as PDF</Text>
          <Download />
        </TouchableOpacity>
        <Text style={styles.totalText}>Total Amount: {totalAmount}</Text>
        <Text style={styles.totalText}>
          Per Person: {totalAmount / totalUsers.length}
        </Text>
        {totalUsers.map((u, index) => (
          <Text key={index} style={styles.totalText}>
            {u.displayName}'s Total: {userExpenses[u.displayName]}
          </Text>
        ))}
        {Object.keys(userBalances).map((key, index) => (
          <Text key={index} style={styles.totalText}>
            {key} Owes: {userBalances[key].toFixed(2)}
          </Text>
        ))}
      </View>

      <FlatList
        data={expenses}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <View style={styles.expenseItem}>
            <Text style={styles.expenseText}>
              Description: {item.description}
            </Text>
            <Text style={styles.expenseText}>
              Total Expense: {item.totalExpense}
            </Text>
            <Text style={styles.expenseText}>
              Paid By: {item.paidBy === user.displayName ? 'You' : item.paidBy}{' '}
              on {moment(item.timestamp).format('DD MMM  YY [at] h:mm a')}
            </Text>
            {Object.keys(item).map((key, index) => {
              if (
                key !== 'description' &&
                key !== 'totalExpense' &&
                key !== 'paidBy' &&
                key !== 'timestamp' &&
                key !== 'id'
              ) {
                return (
                  <Text key={index} style={styles.expenseText}>
                    {key}'s Share: {item[key].toFixed(2)}
                  </Text>
                );
              }
              return null;
            })}
          </View>
        )}
      />

      <TouchableOpacity
        style={styles.toggleButton}
        onPress={() => setShowTotal(!showTotal)}>
        <Text style={styles.toggleButtonText}>
          {showTotal ? 'Hide Total' : 'Show Total'}
        </Text>
      </TouchableOpacity>
    </View>
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
    color: '#333',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
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
    shadowOffset: {width: 0, height: 1},
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
    shadowOffset: {width: 0, height: 2},
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
    width: '100%',
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
