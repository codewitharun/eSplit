// src/component/ExpenseItemsSheet.tsx
// Read-only item breakdown of a multi-item expense ("Bread + 2 items"),
// shown when a member who did NOT add the expense taps it in Activity.
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
import {EXPENSE_CATEGORIES, Expense} from '../services/ledger/types';
import {BodyFont, DisplayFont, moderateScale} from '../utils/fonts';
import theme from '../utils/theme';
import GlassCard from './glass/GlassCard';

interface Props {
  expense: Expense | null;
  onClose: () => void;
  currency?: string;
  paidByLabel: string; // "You" or the payer's name
  createdByLabel: string; // name of the member who added it
}

const ExpenseItemsSheet: React.FC<Props> = ({
  expense,
  onClose,
  currency,
  paidByLabel,
  createdByLabel,
}) => {
  const insets = useSafeAreaInsets();
  const visible = !!expense;
  const canClose = useModalOpenGuard(visible);
  const items = expense ? visibleItems(expense) : null;
  const category = EXPENSE_CATEGORIES.find(c => c.key === expense?.category);

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
                {(items || []).map((item, i) => (
                  <View key={`${item.name}_${i}`} style={styles.itemRow}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.itemPrice}>
                      {formatMoney(item.price, currency)}
                    </Text>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  Total · {items?.length || 1} items
                </Text>
                <Text style={styles.totalValue}>
                  {formatMoney(expense.amount, currency)}
                </Text>
              </View>

              <Text style={styles.footnote}>
                Only {createdByLabel} can edit this expense.
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
