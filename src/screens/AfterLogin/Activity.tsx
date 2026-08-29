// src/screens/AfterLogin/Activity.tsx
// Replaces the expense list + add-expense form half of the old
// ExpenseTracker.js: search, category filters, swipe-to-delete, a
// recurring-expense due banner, and the new AddExpenseModal.

import auth from '@react-native-firebase/auth';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import React, {useCallback, useRef, useState} from 'react';
import {
  BackHandler,
  FlatList,
  Modal,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from '../../services/toast';
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
  const [showPastMembers, setShowPastMembers] = useState(false);
  const addExpenseSignal = useExpenseState(state => state.addExpenseSignal);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | null>(
    null,
  );

  // `addExpenseSignal` is a persistent counter bumped by the floating "+"
  // above the tab bar - it never resets. Reacting to "is it > 0" meant
  // this fired on every mount of this screen too (switching tabs and
  // back, changing groups, anything that remounts Activity), reopening
  // the modal even though nobody tapped "+" this time. A ref seeded from
  // the value at mount only reacts to a genuine *change* afterwards.
  const lastAddSignalRef = useRef(addExpenseSignal);
  React.useEffect(() => {
    if (addExpenseSignal !== lastAddSignalRef.current) {
      lastAddSignalRef.current = addExpenseSignal;
      if (groupKey) {
        setEditingExpense(null);
        setModalVisible(true);
      }
    }
  }, [addExpenseSignal, groupKey]);

  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  // Activity is the first/home tab, so it's the natural floor for the
  // Android hardware back button - without this, pressing back here fell
  // straight through react-navigation's default handling (bottom-tabs
  // nested inside a native-stack screen doesn't reliably bubble an
  // unhandled back press up to the stack) and closed the app entirely,
  // even though Group-Check is sitting right there underneath on the
  // stack. Send it there explicitly instead, and only fall back to the
  // OS default (exit) if there's genuinely nowhere to go back to.
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        const parent = navigation.getParent();
        if (parent?.canGoBack()) {
          parent.goBack();
          return true;
        }
        return false;
      };
      const sub = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress,
      );
      return () => sub.remove();
    }, [navigation]),
  );

  const openEditExpense = (expense: Expense) => {
    // Firestore rules only allow the member who created an expense to
    // update or delete it (previously any group member could edit/delete
    // any expense - tightened alongside this). Mirror that here so tapping
    // someone else's expense gives a clear reason instead of a silent
    // permission-denied write once they hit Save.
    if (expense.createdBy !== user?.uid) {
      Toast.show({
        type: 'info',
        text1: 'Only the person who added this can edit it',
        text2: `Ask ${ledger.memberName(
          expense.createdBy,
        )} to make the change.`,
      });
      return;
    }
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
      const groupName = ledger.group?.name || 'my group';
      const joinCode = ledger.group?.joinCode;
      // The link alone used to be the whole message. Bring back the
      // typeable join code alongside it (like the old share format did,
      // just with the new 6-character code instead of exposing the raw
      // Firestore doc ID) so someone can still get in by hand from
      // "Join with a code" on Group-Check if the link itself doesn't
      // redirect cleanly for them.
      const message = joinCode
        ? `🎉 Join me on EzySplit!

Manage & split expenses easily on "${groupName}".

🔗 Tap to join: https://ezysplit.arun.codes/app/Group-Check/${groupKey}

Or open EzySplit and use this join code: ${joinCode}

Let's make splitting simple! 💰`
        : `🎉 Join me on EzySplit!

Manage & split expenses easily.

🔗 https://ezysplit.arun.codes/app/Group-Check/${groupKey}`;
      await Share.share({message});
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
    const expense = ledger.expenses.find(e => e.id === expenseId);
    if (expense && expense.createdBy !== user?.uid) {
      Toast.show({
        type: 'info',
        text1: 'Only the person who added this can delete it',
        text2: `Ask ${ledger.memberName(expense.createdBy)} to remove it.`,
      });
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
      <View style={[styles.header, {paddingTop: insets.top + 24}]}>
        <View style={styles.headerLeft}>
          <Text style={styles.eyebrow}>ACTIVITY</Text>
          <Text style={styles.title}>{ledger.group?.name || 'Loading…'}</Text>
          <View style={styles.switchRow}>
            <GroupSwitcherPill style={styles.switchPillInline} />
            <Text style={styles.spentInline}>
              ₹{ledger.totalSpent.toFixed(2)} spent
            </Text>
          </View>
          <Text style={[styles.subtitle, styles.subtitleSecondLine]}>
            {ledger.members.length} people
            {ledger.pastMembers.length > 0 && (
              <Text>
                ,{' '}
                <Text
                  style={styles.pastMembersLink}
                  onPress={() => setShowPastMembers(true)}>
                  {ledger.pastMembers.length} left
                </Text>
              </Text>
            )}
            {'  ·  Created by '}
            {ledger.group?.createdBy === user?.uid
              ? 'you'
              : ledger.memberName(ledger.group?.createdBy || '')}
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
          <View style={styles.inviteColumn}>
            <TouchableOpacity onPress={onShareInvite} style={styles.inviteBtn}>
              <Text style={styles.inviteText}>Invite</Text>
            </TouchableOpacity>
            {!!ledger.group?.joinCode && (
              // Plain, selectable text rather than a copy icon + clipboard
              // library - `selectable` still gives a native long-press
              // "Copy" on both platforms with no new native dependency,
              // and the code is readable at a glance for anyone typing it
              // in manually.
              <Text style={styles.joinCodeText} selectable>
                Code: {ledger.group.joinCode}
              </Text>
            )}
          </View>
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

      <Modal
        visible={showPastMembers}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPastMembers(false)}>
        <TouchableOpacity
          style={styles.pastMembersOverlay}
          activeOpacity={1}
          onPress={() => setShowPastMembers(false)}>
          <GlassCard opaque style={styles.pastMembersCard}>
            <Text style={styles.pastMembersTitle}>Left the group</Text>
            {ledger.pastMembers.map(m => (
              <Text key={m.uid} style={styles.pastMembersName}>
                {m.displayName}
              </Text>
            ))}
          </GlassCard>
        </TouchableOpacity>
      </Modal>
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
    // paddingTop comes from the safe-area inset above, computed at render
    // time - a flat 60 here only happened to clear the status bar on
    // devices where the OS forces edge-to-edge (Android 15+).
    paddingBottom: 16,
  },
  // The left column used to have no width constraint, so the subtitle
  // line just grew as long as its content needed - fine for "₹X spent · Y
  // people", but adding "· Created by NAME" (and, before that, the past-
  // members note) made it long enough to push the Invite button/join-code
  // column straight off the right edge of the screen instead of wrapping.
  // `flex: 1` bounds it to the space actually left after that column, so
  // the text wraps onto a second line instead.
  headerLeft: {flex: 1, paddingRight: 12},
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
  subtitleSecondLine: {marginTop: 2},
  switchRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  // GroupSwitcherPill normally sits alone below a title, where its default
  // marginTop gives it breathing room - inline next to text in a row, that
  // same margin just pushed it down and off-center. Zeroed here; the
  // row's own `alignItems: 'center'` does the vertical centering instead.
  switchPillInline: {marginTop: 0},
  spentInline: {color: theme.color.inkSoft, fontSize: 13},
  pastMembersLink: {
    color: theme.color.rose,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  pastMembersOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6,5,12,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pastMembersCard: {width: '100%', maxWidth: 340},
  pastMembersTitle: {
    color: theme.color.ink,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  pastMembersName: {color: theme.color.inkSoft, fontSize: 14, marginTop: 6},
  inviteBtn: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  inviteText: {color: theme.color.ink, fontWeight: '600', fontSize: 13},
  inviteColumn: {alignItems: 'flex-end', gap: 6, flexShrink: 0},
  joinCodeText: {
    color: theme.color.inkFaint,
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
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
