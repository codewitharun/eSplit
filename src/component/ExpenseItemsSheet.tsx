// src/component/ExpenseItemsSheet.tsx
// Read-only details of an expense, shown when a member who did NOT add it
// taps it in Activity: what it was, who paid, the item list (multi-item
// expenses) and how it's split between members (every expense).
// The person who added it gets the normal editable AddExpenseModal
// instead (only the creator may edit an expense - see openEditExpense in
// Activity.tsx). Same Modal pattern as SwitchGroupSheet.tsx.

import {X} from 'lucide-react-native';
import React from 'react';
import {Modal, ScrollView, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, View} from 'react-native';
import {Text} from './ui/AppText';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useModalOpenGuard} from '../hooks/useModalOpenGuard';
import {formatMoney} from '../services/ledger/currency';
import {visibleItems} from '../services/ledger/expenseItems';
import {EXPENSE_CATEGORIES, Expense, Settlement} from '../services/ledger/types';
import {BodyFont, DisplayFont, moderateScale} from '../utils/fonts';
import theme from '../utils/theme';
import GlassCard from './glass/GlassCard';
import EditHistoryList from './EditHistoryList';

interface Props {
  expense: Expense | null;
  onClose: () => void;
  currency?: string;
  paidByLabel: string; // "You" or the payer's name
  createdByLabel: string; // name of the member who added it
  // For the "How it's split" section. Optional so older call sites still
  // render (they just won't show the per-member breakdown).
  memberName?: (uid: string) => string;
  currentUid?: string;
  // For the "Changes" section (edit log, settle-up warnings).
  settlements?: Settlement[];
}

const SPLIT_LABEL: Record<string, string> = {
  equal: 'Split equally',
  exact: 'Split by exact amounts',
  percentage: 'Split by percentage',
  shares: 'Split by shares',
};

const ExpenseItemsSheet: React.FC<Props> = ({
  expense,
  onClose,
  currency,
  paidByLabel,
  createdByLabel,
  memberName,
  currentUid,
  settlements,
}) => {
  const insets = useSafeAreaInsets();
  const visible = !!expense;
  const canClose = useModalOpenGuard(visible);
  const items = expense ? visibleItems(expense) : null;
  const category = EXPENSE_CATEGORIES.find(c => c.key === expense?.category);
  // Who owes what for this expense, biggest share first, you on top.
  const shares = Object.entries(expense?.shares || {})
    .filter(([, amount]) => amount > 0.004)
    .sort(([a, x], [b, y]) =>
      a === currentUid ? -1 : b === currentUid ? 1 : y - x,
    );
  const shareCount = expense?.splitParams?.shares;
  const percentages = expense?.splitParams?.percentages;

  const close = () => {
    if (canClose()) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.backdrop} pointerEvents="box-none">
        <TouchableWithoutFeedback onPress={close}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={close}
          accessibilityLabel="Close"
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <X size={20} color={theme.color.ink} />
        </TouchableOpacity>
        <GlassCard
          opaque
          style={StyleSheet.flatten([
            styles.sheet,
            {paddingBottom: Math.max(insets.bottom, 16) + 8},
          ])}>
          {expense && (
            <>
              <Text style={styles.title}>
                {category?.icon || '🧾'} {expense.description}
              </Text>
              <Text style={styles.meta}>
                Paid by {paidByLabel} ·{' '}
                {new Date(expense.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>

              <ScrollView style={styles.list}>
                {!!items && (
                  <>
                    <Text style={styles.sectionLabel}>Items</Text>
                    {items.map((item, i) => (
                      <View key={`${item.name}_${i}`} style={styles.itemRow}>
                        <Text style={styles.itemName} numberOfLines={2}>
                          {item.name}
                        </Text>
                        <Text style={styles.itemPrice}>
                          {formatMoney(item.price, currency)}
                        </Text>
                      </View>
                    ))}
                  </>
                )}

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>
                    {items ? `Total · ${items.length} items` : 'Total'}
                  </Text>
                  <Text style={styles.totalValue}>
                    {formatMoney(expense.amount, currency)}
                  </Text>
                </View>

                {!!memberName && shares.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, styles.splitLabel]}>
                      {SPLIT_LABEL[expense.splitType] || 'How it\'s split'}
                    </Text>
                    {shares.map(([uid, amount]) => {
                      const isYou = uid === currentUid;
                      const detail =
                        expense.splitType === 'shares' && shareCount?.[uid]
                          ? `${shareCount[uid]} share${shareCount[uid] === 1 ? '' : 's'}`
                          : expense.splitType === 'percentage' &&
                            percentages?.[uid] != null
                          ? `${percentages[uid]}%`
                          : null;
                      return (
                        <View
                          key={uid}
                          style={[styles.shareRow, isYou && styles.shareRowYou]}>
                          <Text style={styles.shareName} numberOfLines={1}>
                            {isYou ? 'You' : memberName(uid)}
                            {detail ? (
                              <Text style={styles.shareDetail}> · {detail}</Text>
                            ) : null}
                          </Text>
                          <Text
                            style={[
                              styles.shareAmount,
                              isYou && styles.shareAmountYou,
                            ]}>
                            {formatMoney(amount, currency)}
                          </Text>
                        </View>
                      );
                    })}
                  </>
                )}
                {!!memberName && (
                  <EditHistoryList
                    expense={expense}
                    settlements={settlements}
                    currency={currency}
                    nameOf={uid => (uid === currentUid ? 'You' : memberName(uid))}
                  />
                )}
              </ScrollView>

              <Text style={styles.footnote}>
                {expense.createdBy === currentUid
                  ? 'You added this. Tap the expense to edit it.'
                  : `Added by ${createdByLabel}. Only they can edit it.`}
              </Text>
            </>
          )}
        </GlassCard>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6,5,12,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    paddingTop: 18,
    paddingHorizontal: 20,
  },
  title: {
    fontFamily: DisplayFont.bold,
    fontSize: moderateScale(17),
    fontWeight: '700',
    color: theme.color.ink,
  },
  meta: {
    marginTop: 4,
    marginBottom: 14,
    color: theme.color.inkSoft,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(12.5),
  },
  list: {flexGrow: 0},
  sectionLabel: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(11),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  splitLabel: {marginTop: 18},
  shareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: theme.radius.sm,
  },
  shareRowYou: {backgroundColor: 'rgba(56,217,201,0.08)'},
  shareName: {
    flex: 1,
    color: theme.color.ink,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(14),
  },
  shareDetail: {color: theme.color.inkFaint, fontSize: moderateScale(12.5)},
  shareAmount: {
    color: theme.color.inkSoft,
    fontFamily: BodyFont.semibold,
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  shareAmountYou: {color: theme.color.ink},
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
    gap: 12,
  },
  itemName: {
    flex: 1,
    color: theme.color.ink,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(14.5),
  },
  itemPrice: {
    color: theme.color.ink,
    fontFamily: BodyFont.semibold,
    fontSize: moderateScale(14.5),
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
  },
  totalLabel: {
    color: theme.color.inkSoft,
    fontFamily: BodyFont.semibold,
    fontSize: moderateScale(13),
    fontWeight: '600',
  },
  totalValue: {
    color: theme.color.ink,
    fontFamily: DisplayFont.bold,
    fontSize: moderateScale(18),
    fontWeight: '700',
  },
  footnote: {
    marginTop: 12,
    color: theme.color.inkFaint,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(12),
  },
  closeBtn: {
    alignSelf: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.color.surfaceStrong,
    borderWidth: 1,
    borderColor: theme.color.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
});

export default ExpenseItemsSheet;
