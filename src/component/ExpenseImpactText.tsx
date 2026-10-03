// src/component/ExpenseImpactText.tsx
// The small line under an expense's amount in Activity: what it means
// for the signed-in user - "you lent ₹600" (green), "you owe ₹200"
// (rose), "not involved" (faint). Nothing when you paid only for
// yourself. Text always carries the meaning; colour only reinforces it.

import React from 'react';
import {StyleSheet} from 'react-native';
import {Text} from './ui/AppText';
import {expenseImpact} from '../services/ledger/activityFormat';
import {formatMoney} from '../services/ledger/currency';
import {Expense} from '../services/ledger/types';
import {BodyFont, moderateScale} from '../utils/fonts';
import theme from '../utils/theme';

interface Props {
  expense: Pick<Expense, 'amount' | 'paidBy' | 'shares'>;
  uid: string;
  currency?: string;
}

const ExpenseImpactText: React.FC<Props> = ({expense, uid, currency}) => {
  const impact = expenseImpact(expense, uid);
  if (impact.kind === 'self') {
    return null;
  }
  if (impact.kind === 'none') {
    return <Text style={[styles.text, styles.none]}>not involved</Text>;
  }
  return (
    <Text
      style={[
        styles.text,
        impact.kind === 'lent' ? styles.lent : styles.borrowed,
      ]}>
      {impact.kind === 'lent' ? 'you lent ' : 'you owe '}
      {formatMoney(impact.amount, currency)}
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {
    fontFamily: BodyFont.semibold,
    fontSize: moderateScale(11.5),
    fontWeight: '600',
    marginTop: 2,
  },
  lent: {color: theme.color.green},
  borrowed: {color: theme.color.rose},
  none: {color: theme.color.inkFaint, fontWeight: '400'},
});

export default ExpenseImpactText;
