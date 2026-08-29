// src/screens/AfterLogin/Activity.tsx
// Replaces the expense list + add-expense form half of the old
// ExpenseTracker.js: search, category filters, swipe-to-delete, a
// recurring-expense due banner, and the new AddExpenseModal.

import auth from '@react-native-firebase/auth';
import React, {useState} from 'react';
import {
  FlatList,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import AddExpenseModal from '../../component/AddExpenseModal';
import GroupSwitcherPill from '../../component/GroupSwitcherPill';
import Chip from '../../component/glass/Chip';
import GlassCard from '../../component/glass/GlassCard';
import GradientMesh from '../../component/glass/GradientMesh';
import SwipeableRow from '../../component/glass/SwipeableRow';
import {useGroupLedger} from '../../hooks/useGroupLedger';
import {addExpense, deleteExpense} from '../../services/ledger/firestoreLedger';
import {
  EXPENSE_CATEGORIES,
  Expense,
  ExpenseCategory,
} from '../../services/ledger/types';
import {useExpenseState} from '../../store/useExpenseStore';
import {haptics} from '../../utils/haptics';
import theme from '../../utils/theme';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const ActivityScreen: React.FC = () => {
  const user = auth().currentUser;
  const groupKey = useExpenseState(state => state.groupKey);
  const ledger = useGroupLedger(groupKey);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const addExpenseSignal = useExpenseState(state => state.addExpenseSignal);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | null>(
    null,
  );

  React.useEffect(() => {
    if (addExpenseSignal > 0 && groupKey) {
      setEditingExpense(null);
      setModalVisible(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addExpenseSignal]);

  const openEditExpense = (expense: Expense) => {
    haptics.tap();
    setEditingExpense(expense);
    setModalVisible(true);
  };

  const closeExpenseModal = () => {
    setModalVisible(false);
    setEditingExpense(null);
  };

  const filteredExpenses = ledger.expenses.filter(e => {
    if (categoryFilter && e.category !== categoryFilter) {
      return false;
    }
    if (
      search.trim() &&
      !e.description.toLowerCase().includes(search.trim().toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const overdueRecurring = ledger.expenses.filter(
    e =>
      e.isRecurring &&
      e.recurrenceIntervalDays &&
      Date.now() - new Date(e.createdAt).getTime() >
        e.recurrenceIntervalDays * ONE_DAY_MS,
  );

  const reAddRecurring = async (expenseId: string) => {
    const source = ledger.expenses.find(e => e.id === expenseId);
    if (!source || !groupKey) {
      return;
    }
    try {
      await addExpense({
        groupId: groupKey,
        description: source.description,
        amount: source.amount,
        currency: source.currency,
        category: source.category,
        paidBy: source.paidBy,
        createdBy: user!.uid,
        splitType: source.splitType,
        participantUids: Object.keys(source.shares),
        splitParams: source.splitParams,
        isRecurring: true,
        recurrenceIntervalDays: source.recurrenceIntervalDays,
      });
      haptics.success();
      Toast.show({type: 'success', text1: 'Recurring expense re-added'});
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not re-add',
        text2: error?.message,
      });
    }
  };

  const onShareInvite = async () => {
    if (!groupKey) {
      return;
    }
    try {
      await Share.share({
        message: `🎉 Join me on EzySplit!\n\nManage & split expenses easily.\n\n🔗 https://ezysplit.arun.codes/app/Group-Check/${groupKey}`,
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Sharing failed',
        text2: error?.message,
      });
    }
  };

  const onDelete = (expenseId: string) => {
    if (!groupKey) {
      return;
    }
    deleteExpense(groupKey, expenseId).catch(error =>
      Toast.show({
        type: 'error',
        text1: 'Could not delete',
        text2: error?.message,
      }),
    );
  };

  if (!groupKey) {
    return (
      <View style={styles.flex}>
        <GradientMesh />
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            Pick or create a group from the You tab to get started.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <GradientMesh />
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>ACTIVITY</Text>
          <Text style={styles.title}>{ledger.group?.name || 'Loading…'}</Text>
          <GroupSwitcherPill />
          <Text style={styles.subtitle}>
            ₹{ledger.totalSpent.toFixed(2)} spent · {ledger.members.length}{' '}
            people
          </Text>
        </View>
        {/* This used to be gated on "no expenses yet", back when a group
            auto-locked itself on the first expense - at that point "no
            expenses" and "still open to new members" were the same thing.
            Locking is now a separate, explicit admin toggle (see
            Profile.tsx), so the Invite button needs to follow that flag
            directly instead - otherwise it silently disappears the moment
            someone logs an expense, and toggling the lock does nothing to
            it either way, which is the bug being fixed here. */}
        {!ledger.group?.isLocked && (
          <TouchableOpacity onPress={onShareInvite} style={styles.inviteBtn}>
            <Text style={styles.inviteText}>Invite</Text>
          </TouchableOpacity>
        )}
      </View>

      {overdueRecurring.map(e => (
        <GlassCard key={e.id} style={styles.recurringBanner}>
          <Text style={styles.recurringText}>
            🔁 “{e.description}” looks due again
          </Text>
          <TouchableOpacity onPress={() => reAddRecurring(e.id!)}>
            <Text style={styles.recurringAction}>Add again</Text>
          </TouchableOpacity>
        </GlassCard>
      ))}

      <TextInput
        style={styles.search}
        placeholder="Search expenses"
        placeholderTextColor={theme.color.inkFaint}
        value={search}
        onChangeText={setSearch}
      />
      <View style={styles.filterRow}>
        <Chip
          label="All"
          active={!categoryFilter}
          onPress={() => setCategoryFilter(null)}
        />
        {EXPENSE_CATEGORIES.map(c => (
          <Chip
            key={c.key}
            label={`${c.icon} ${c.label}`}
            active={categoryFilter === c.key}
            onPress={() =>
              setCategoryFilter(categoryFilter === c.key ? null : c.key)
            }
          />
        ))}
      </View>

      <Text style={styles.hint}>Tap an expense to edit, swipe to delete.</Text>
      <FlatList
        data={filteredExpenses}
        keyExtractor={item => item.id!}
        contentContainerStyle={styles.listContent}
        renderItem={({item}) => (
          <SwipeableRow
            actionLabel="Delete"
            actionColor={theme.color.rose}
            onAction={() => onDelete(item.id!)}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => openEditExpense(item)}>
              <GlassCard style={styles.expenseRow}>
                <View style={styles.expenseIcon}>
                  <Text style={{fontSize: 18}}>
                    {EXPENSE_CATEGORIES.find(c => c.key === item.category)
                      ?.icon || '🧾'}
                  </Text>
                </View>
                <View style={styles.expenseMid}>
                  <Text style={styles.expenseTitle}>{item.description}</Text>
                  <Text style={styles.expenseSub}>
                    Paid by{' '}
                    {item.paidBy === user?.uid
                      ? 'You'
                      : ledger.memberName(item.paidBy)}{' '}
                    ·{' '}
                    {new Date(item.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </Text>
                </View>
                <Text style={styles.expenseAmount}>
                  ₹{item.amount.toFixed(2)}
                </Text>
              </GlassCard>
            </TouchableOpacity>
          </SwipeableRow>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No expenses yet — tap + to add the first one.
          </Text>
        }
      />
      {/*
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          haptics.tap();
          setModalVisible(true);
        }}>
        <Text style={styles.fabPlus}>+</Text>
      </TouchableOpacity> */}

      {groupKey && (
        <AddExpenseModal
          visible={modalVisible}
          onClose={closeExpenseModal}
          groupId={groupKey}
          members={ledger.members}
          currentUid={user!.uid}
          editingExpense={editingExpense}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1, backgroundColor: theme.color.ground},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  eyebrow: {
    color: theme.color.inkFaint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  title: {
    color: theme.color.ink,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 2,
  },
  subtitle: {color: theme.color.inkSoft, fontSize: 13, marginTop: 4},
  inviteBtn: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  inviteText: {color: theme.color.ink, fontWeight: '600', fontSize: 13},
  recurringBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  recurringText: {color: theme.color.ink, fontSize: 13, flex: 1},
  recurringAction: {color: theme.color.teal, fontWeight: '700', fontSize: 13},
  search: {
    marginHorizontal: 20,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: theme.color.ink,
    marginBottom: 10,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  hint: {
    color: theme.color.inkFaint,
    fontSize: 11.5,
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  listContent: {paddingHorizontal: 20, paddingBottom: 120},
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    padding: 14,
  },
  expenseIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  expenseMid: {flex: 1},
  expenseTitle: {color: theme.color.ink, fontWeight: '600', fontSize: 14.5},
  expenseSub: {color: theme.color.inkFaint, fontSize: 12, marginTop: 2},
  expenseAmount: {
    color: theme.color.ink,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: theme.color.inkSoft,
    textAlign: 'center',
    marginTop: 24,
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    right: 22,
    bottom: 28,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: theme.color.blue,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.color.blue,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: {width: 0, height: 8},
    elevation: 8,
  },
  fabPlus: {
    color: theme.color.onAccent,
    fontSize: 30,
    fontWeight: '700',
    marginTop: -2,
  },
});

export default ActivityScreen;
