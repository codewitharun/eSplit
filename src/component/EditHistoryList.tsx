// src/component/EditHistoryList.tsx
// "Changes" section of the expense details sheet: every edit, newest
// first - who, when, what changed - with edits that landed after a
// settle-up (and moved money) called out in amber. Data comes straight
// from Expense.editHistory; see services/ledger/expenseAudit.ts.
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Text} from './ui/AppText';
import {
  describeChange,
  editEntries,
  isMoneyEdit,
} from '../services/ledger/expenseAudit';
import {Expense, Settlement} from '../services/ledger/types';
import {BodyFont, moderateScale} from '../utils/fonts';
import theme from '../utils/theme';

interface Props {
  expense: Expense;
  settlements?: Settlement[];
  currency?: string;
  nameOf: (uid: string) => string; // "You" for the viewer
}

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-IN', {day: 'numeric', month: 'short'})}, ${d
    .toLocaleTimeString('en-IN', {hour: 'numeric', minute: '2-digit'})
    .toLowerCase()}`;
}

const EditHistoryList: React.FC<Props> = ({
  expense,
  settlements = [],
  currency,
  nameOf,
}) => {
  const edits = editEntries(expense).reverse();
  if (!edits.length) {
    return null;
  }
  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionLabel}>
        Changes · {edits.length} edit{edits.length === 1 ? '' : 's'}
      </Text>
      {edits.map((e, i) => {
        const afterSettle =
          isMoneyEdit(e.change) &&
          settlements.some(
            s => s.createdAt > expense.createdAt && s.createdAt < e.editedAt,
          );
        return (
          <View key={`${e.editedAt}_${i}`} style={styles.row}>
            <View style={[styles.dot, afterSettle && styles.dotWarn]} />
            <View style={styles.body}>
              <Text style={styles.who}>
                {nameOf(e.editedBy)}
                <Text style={styles.when}> · {formatWhen(e.editedAt)}</Text>
              </Text>
              {describeChange(e.change, currency).map((line, j) => (
                <Text key={j} style={styles.line}>
                  {line}
                </Text>
              ))}
              {afterSettle && (
                <Text style={styles.warn}>
                  Made after a settle-up · balances reopened
                </Text>
              )}
            </View>
          </View>
        );
      })}
      <View style={styles.row}>
        <View style={styles.dot} />
        <Text style={styles.who}>
          {nameOf(expense.createdBy)}
          <Text style={styles.when}> added it · {formatWhen(expense.createdAt)}</Text>
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {marginTop: 18},
  sectionLabel: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(11),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  row: {flexDirection: 'row', gap: 10, paddingVertical: 6},
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    backgroundColor: theme.color.inkFaint,
  },
  dotWarn: {backgroundColor: theme.color.amber},
  body: {flex: 1},
  who: {
    color: theme.color.ink,
    fontFamily: BodyFont.semibold,
    fontSize: moderateScale(13),
    fontWeight: '600',
  },
  when: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.regular,
    fontWeight: '400',
  },
  line: {
    color: theme.color.inkSoft,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(12.5),
    marginTop: 2,
  },
  warn: {
    color: theme.color.amber,
    fontFamily: BodyFont.semibold,
    fontSize: moderateScale(12),
    fontWeight: '600',
    marginTop: 4,
  },
});

export default EditHistoryList;
