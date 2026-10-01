// src/screens/AfterLogin/Activity.tsx
// Replaces the expense list + add-expense form half of the old
// ExpenseTracker.js: search, category filters, swipe-to-delete, a
// recurring-expense due banner, and the new AddExpenseModal.
//
// Redesign pass: the plain "spent" line + invite/join-code column moved
// out of the header into a GlassCard mini-hero (matching the approved
// mockup's summary card), and the always-visible search box + category
// row now collapse behind Search/Filter icon buttons - mirroring the
// same collapse pattern GroupCheck.tsx already uses for its own group
// search - with a new date-range filter dimension (This week/This
// month/All time/Custom range, same client-side logic as
// PersonalExpenses.tsx) added alongside the existing category filter.

import auth from '@react-native-firebase/auth';
import {useBottomTabBarHeight} from '@react-navigation/bottom-tabs';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {Search, SlidersHorizontal, X} from 'lucide-react-native';
import React, {useCallback, useMemo, useRef, useState} from 'react';
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
import {Calendar} from 'react-native-calendars';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import AddExpenseModal from '../../component/AddExpenseModal';
import ExpenseItemsSheet from '../../component/ExpenseItemsSheet';
import GroupInsightsCard from '../../component/GroupInsightsCard';
import GroupSwitcherPill from '../../component/GroupSwitcherPill';
import HomeIconChip from '../../component/HomeIconChip';
import Chip from '../../component/glass/Chip';
import GlassCard from '../../component/glass/GlassCard';
import SwipeableRow from '../../component/glass/SwipeableRow';
import {useGroupLedger} from '../../hooks/useGroupLedger';
import {useModalOpenGuard} from '../../hooks/useModalOpenGuard';
import {formatMoney} from '../../services/ledger/currency';
import {visibleItems} from '../../services/ledger/expenseItems';
import {computeGroupInsights} from '../../services/ledger/groupInsights';
import {addExpense, deleteExpense} from '../../services/ledger/firestoreLedger';
import {
  EXPENSE_CATEGORIES,
  Expense,
  ExpenseCategory,
} from '../../services/ledger/types';
import Toast from '../../services/toast';
import {useExpenseState} from '../../store/useExpenseStore';
import {BodyFont, DisplayFont, moderateScale} from '../../utils/fonts';
import {haptics} from '../../utils/haptics';
import {FLOATING_ACTIONS_CLEARANCE} from '../../navigator/constants';
import theme from '../../utils/theme';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type DateFilter = 'week' | 'month' | 'all' | 'custom';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Inclusive day-range check against an expense's ISO createdAt - every
// filter here (week/month/custom) resolves to a [from, to] pair so the
// actual matching logic only has to live in one place. Same shape as the
// one in PersonalExpenses.tsx; kept local rather than shared since the two
// screens filter different lists and the app already tolerates this kind
// of small, screen-local duplication (see GroupCheck's own inline
// enter-group logic).
function inRange(iso: string, from: Date | null, to: Date | null): boolean {
  const t = new Date(iso).getTime();
  if (from && t < from.getTime()) {
    return false;
  }
  if (to && t > to.getTime()) {
    return false;
  }
  return true;
}

const ActivityScreen: React.FC = () => {
  const user = auth().currentUser;
  const groupKey = useExpenseState(state => state.groupKey);
  const ledger = useGroupLedger(groupKey);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  // Multi-item expense opened by someone who didn't add it - shown as a
  // read-only breakdown (ExpenseItemsSheet) instead of the edit modal.
  const [viewingItemsOf, setViewingItemsOf] = useState<Expense | null>(null);
  // Header analytics card - all-time numbers for the whole group (not the
  // list's search/date filters), from data this screen already loaded.
  const insights = useMemo(
    () =>
      computeGroupInsights(
        ledger.expenses,
        user?.uid || '',
        ledger.netBalances[user?.uid || ''] || 0,
      ),
    [ledger.expenses, ledger.netBalances, user?.uid],
  );
  const [showPastMembers, setShowPastMembers] = useState(false);
  const addExpenseSignal = useExpenseState(state => state.addExpenseSignal);
  const [search, setSearch] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | null>(
    null,
  );
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customRange, setCustomRange] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  // See useModalOpenGuard.ts - both modals below can be opened
  // synchronously from a chip/button press, which is exactly the
  // shape of bug that hits AddExpenseModal without this guard.
  const canCloseShowPastMembers = useModalOpenGuard(showPastMembers);
  const canClosePicker = useModalOpenGuard(pickerVisible);
  const [pickerStart, setPickerStart] = useState<string | null>(null);

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
  // Real height of the floating tab bar (it overlays content now
  // instead of reserving its own row - see BottomTabNavigator.tsx),
  // so scrollable content here can pad exactly enough to clear it at
  // rest while still scrolling underneath it past that point.
  const tabBarHeight = useBottomTabBarHeight();

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
      if (visibleItems(expense)) {
        haptics.tap();
        setViewingItemsOf(expense);
        return;
      }
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

  const {from, to} = useMemo(() => {
    if (dateFilter === 'week') {
      const start = startOfToday();
      start.setDate(start.getDate() - 6);
      return {from: start, to: null as Date | null};
    }
    if (dateFilter === 'month') {
      const start = startOfToday();
      start.setDate(start.getDate() - 29);
      return {from: start, to: null as Date | null};
    }
    if (dateFilter === 'custom' && customRange) {
      const end = new Date(customRange.end);
      end.setHours(23, 59, 59, 999);
      return {from: new Date(customRange.start), to: end};
    }
    return {from: null as Date | null, to: null as Date | null};
  }, [dateFilter, customRange]);

  const selectDateFilter = (next: DateFilter) => {
    if (next === 'custom') {
      setPickerStart(null);
      setPickerVisible(true);
      return;
    }
    setDateFilter(next);
  };

  const onDayPress = (day: {dateString: string}) => {
    if (!pickerStart) {
      setPickerStart(day.dateString);
      return;
    }
    const start = pickerStart <= day.dateString ? pickerStart : day.dateString;
    const end = pickerStart <= day.dateString ? day.dateString : pickerStart;
    setCustomRange({start, end});
    setDateFilter('custom');
    setPickerVisible(false);
    setPickerStart(null);
  };

  const markedDates = useMemo(() => {
    if (!pickerStart) {
      return {};
    }
    return {
      [pickerStart]: {
        startingDay: true,
        endingDay: true,
        color: theme.color.blue,
        textColor: theme.color.onAccent,
      },
    };
  }, [pickerStart]);

  const customRangeLabel =
    customRange &&
    `${new Date(customRange.start).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
    })} - ${new Date(customRange.end).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
    })}`;

  const filteredExpenses = ledger.expenses.filter(e => {
    if (categoryFilter && e.category !== categoryFilter) {
      return false;
    }
    if (!inRange(e.createdAt, from, to)) {
      return false;
    }
    if (
      search.trim() &&
      !e.description.toLowerCase().includes(search.trim().toLowerCase()) &&
      !(visibleItems(e) || []).some(i =>
        i.name.toLowerCase().includes(search.trim().toLowerCase()),
      )
    ) {
      return false;
    }
    return true;
  });

  const filtersActive = !!categoryFilter || dateFilter !== 'all';

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
        items: visibleItems(source) || undefined,
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
      <View style={[styles.header, {paddingTop: insets.top + 24}]}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>{ledger.group?.name || 'Loading…'}</Text>
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
        <View style={styles.headerRightGroup}>
          <HomeIconChip />
          <GroupSwitcherPill iconOnly />
        </View>
      </View>

      <GroupInsightsCard
        insights={insights}
        currency={ledger.group?.currency}
        isPersonal={ledger.group?.type === 'personal'}>
        {/* This used to be gated on "no expenses yet", back when a group
            auto-locked itself on the first expense - at that point "no
            expenses" and "still open to new members" were the same thing.
            Locking is now a separate, explicit admin toggle (see
            GroupSettings.tsx), so the Invite row needs to follow that flag
            directly instead - otherwise it silently disappears the moment
            someone logs an expense, and toggling the lock does nothing to
            it either way, which is the bug being fixed here. */}
        {!ledger.group?.isLocked && (
          <View style={styles.heroInviteRow}>
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
            <TouchableOpacity onPress={onShareInvite} style={styles.inviteBtn}>
              <Text style={styles.inviteText}>Invite</Text>
            </TouchableOpacity>
          </View>
        )}
      </GroupInsightsCard>

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

      <View style={styles.expensesHeaderRow}>
        <Text style={styles.expensesTitle}>Expenses</Text>
        <View style={styles.expensesHeaderActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
            onPress={() => {
              setSearchVisible(v => !v);
              if (searchVisible) {
                setSearch('');
              }
            }}>
            {searchVisible ? (
              <X size={17} color={theme.color.ink} />
            ) : (
              <Search size={17} color={theme.color.ink} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, filtersActive && styles.iconBtnActive]}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
            onPress={() => setFiltersVisible(v => !v)}>
            <SlidersHorizontal
              size={17}
              color={filtersActive ? theme.color.blueBright : theme.color.ink}
            />
          </TouchableOpacity>
        </View>
      </View>

      {searchVisible && (
        <TextInput
          style={styles.search}
          placeholder="Search expenses"
          placeholderTextColor={theme.color.inkFaint}
          value={search}
          onChangeText={setSearch}
          autoFocus
        />
      )}

      {filtersVisible && (
        <>
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
          <View style={styles.filterRow}>
            <Chip
              label="This week"
              active={dateFilter === 'week'}
              onPress={() => selectDateFilter('week')}
            />
            <Chip
              label="This month"
              active={dateFilter === 'month'}
              onPress={() => selectDateFilter('month')}
            />
            <Chip
              label="All time"
              active={dateFilter === 'all'}
              onPress={() => selectDateFilter('all')}
            />
            <Chip
              label={
                dateFilter === 'custom' && customRangeLabel
                  ? `📅 ${customRangeLabel}`
                  : '📅 Custom range'
              }
              active={dateFilter === 'custom'}
              onPress={() => selectDateFilter('custom')}
            />
          </View>
        </>
      )}

      <Text style={styles.hint}>Tap an expense to edit, swipe to delete.</Text>
      <FlatList
        data={filteredExpenses}
        keyExtractor={item => item.id!}
        contentContainerStyle={[
          styles.listContent,
          // The tab bar now floats over the content (see
          // BottomTabNavigator.tsx) instead of reserving its own row, so
          // the list needs real bottom padding for its own height or the
          // last rows would render hidden underneath it at rest.
          {paddingBottom: tabBarHeight + FLOATING_ACTIONS_CLEARANCE},
        ]}
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
                  <Text style={{fontSize: moderateScale(18)}}>
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
                  {formatMoney(item.amount, ledger.group?.currency)}
                </Text>
              </GlassCard>
            </TouchableOpacity>
          </SwipeableRow>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {ledger.expenses.length === 0
              ? 'No expenses yet — tap “Add expense” to log the first one.'
              : 'No expenses match this filter.'}
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
          groupCurrency={ledger.group?.currency}
          editingExpense={editingExpense}
        />
      )}

      <ExpenseItemsSheet
        expense={viewingItemsOf}
        onClose={() => setViewingItemsOf(null)}
        currency={ledger.group?.currency}
        paidByLabel={
          viewingItemsOf?.paidBy === user?.uid
            ? 'You'
            : ledger.memberName(viewingItemsOf?.paidBy || '')
        }
        createdByLabel={ledger.memberName(viewingItemsOf?.createdBy || '')}
      />

      <Modal
        visible={showPastMembers}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPastMembers(false)}>
        <TouchableOpacity
          style={styles.pastMembersOverlay}
          activeOpacity={1}
          onPress={() => {
            if (canCloseShowPastMembers()) {
              setShowPastMembers(false);
            }
          }}>
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

      <Modal
        visible={pickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}>
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => {
            if (canClosePicker()) {
              setPickerVisible(false);
            }
          }}>
          <GlassCard opaque style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>
                {pickerStart ? 'Pick the end date' : 'Pick the start date'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (canClosePicker()) {
                    setPickerVisible(false);
                  }
                }}>
                <X size={18} color={theme.color.inkSoft} />
              </TouchableOpacity>
            </View>
            <Calendar
              onDayPress={onDayPress}
              maxDate={new Date().toISOString().split('T')[0]}
              markedDates={markedDates}
              theme={{
                calendarBackground: 'transparent',
                dayTextColor: theme.color.ink,
                monthTextColor: theme.color.ink,
                textDisabledColor: theme.color.inkFaint,
                todayTextColor: theme.color.blueBright,
                arrowColor: theme.color.ink,
              }}
            />
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
  headerLeft: {flex: 1, paddingRight: 12},
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
  },
  eyebrow: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(11),
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  title: {
    color: theme.color.ink,
    fontFamily: DisplayFont.extrabold,
    fontSize: moderateScale(24),
    fontWeight: '800',
    marginTop: 2,
  },
  subtitle: {
    color: theme.color.inkSoft,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(13),
    marginTop: 4,
  },
  subtitleSecondLine: {marginTop: 2},
  pastMembersLink: {
    color: theme.color.rose,
    fontFamily: BodyFont.bold,
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
    fontFamily: DisplayFont.bold,
    fontSize: moderateScale(16),
    fontWeight: '700',
    marginBottom: 10,
  },
  pastMembersName: {
    color: theme.color.inkSoft,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(14),
    marginTop: 6,
  },
  heroInviteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  inviteBtn: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  inviteText: {
    color: theme.color.ink,
    fontFamily: BodyFont.semibold,
    fontWeight: '600',
    fontSize: moderateScale(13),
  },
  joinCodeText: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.semibold,
    fontSize: moderateScale(11.5),
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
  recurringText: {
    color: theme.color.ink,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(13),
    flex: 1,
  },
  recurringAction: {
    color: theme.color.teal,
    fontFamily: BodyFont.bold,
    fontWeight: '700',
    fontSize: moderateScale(13),
  },
  expensesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  expensesTitle: {
    color: theme.color.ink,
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(15),
    fontWeight: '700',
  },
  expensesHeaderActions: {flexDirection: 'row', alignItems: 'center', gap: 8},
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.groundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnActive: {borderColor: theme.color.blueBright},
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
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(11.5),
    paddingHorizontal: 20,
    marginBottom: 6,
    marginTop: 6,
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
  expenseTitle: {
    color: theme.color.ink,
    fontFamily: BodyFont.semibold,
    fontWeight: '600',
    fontSize: moderateScale(14.5),
  },
  expenseSub: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(12),
    marginTop: 2,
  },
  expenseAmount: {
    color: theme.color.ink,
    fontFamily: BodyFont.bold,
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
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(14),
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
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(30),
    fontWeight: '700',
    marginTop: -2,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6,5,12,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pickerCard: {width: '100%', maxWidth: 360},
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  pickerTitle: {
    color: theme.color.ink,
    fontFamily: DisplayFont.bold,
    fontSize: moderateScale(14.5),
    fontWeight: '700',
  },
});

export default ActivityScreen;
