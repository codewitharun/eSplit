// src/component/BalanceChangesCard.tsx
// Balances screen: "Changes since settle-up". Lists money-changing edits
// and deletions to expenses that an earlier settle-up already covered
// (last 30 days), so nobody is left wondering why a settled group owes
// money again. Hidden when there's nothing to show. Logic lives in
// services/ledger/expenseAudit.ts (changesSinceSettlement).
import {AlertTriangle, ChevronDown} from 'lucide-react-native';
import React, {useState} from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {Text} from './ui/AppText';
import GlassCard from './glass/GlassCard';
import {formatWhen} from './EditHistoryList';
import {formatMoneyShort} from '../services/ledger/currency';
import {BalanceChange} from '../services/ledger/expenseAudit';
import {BodyFont, moderateScale} from '../utils/fonts';
import theme from '../utils/theme';

interface Props {
  changes: BalanceChange[];
  currency?: string;
  nameOf: (uid: string) => string; // "You" for the viewer
}

// Collapsed by default: just a one-line amber header with the count, so
// Balances isn't cluttered. Tap to expand the full list.
const BalanceChangesCard: React.FC<Props> = ({changes, currency, nameOf}) => {
  const [expanded, setExpanded] = useState(false);
  if (!changes.length) {
    return null;
  }
  return (
    <GlassCard style={styles.card}>
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.header}
        onPress={() => setExpanded(v => !v)}
        accessibilityRole="button"
        accessibilityState={{expanded}}>
        <AlertTriangle size={15} color={theme.color.amber} />
        <Text style={styles.title}>Changes since settle-up</Text>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{changes.length}</Text>
        </View>
        <ChevronDown
          size={16}
          color={theme.color.inkSoft}
          style={expanded ? styles.flip : undefined}
        />
      </TouchableOpacity>
      {expanded && (
        <>
          <Text style={styles.sub}>
            These changed expenses your group had already settled, so the
            balances below include them.
          </Text>
          {changes.map((c, i) => (
            <View
              key={`${c.kind}_${c.expenseId}_${c.at}_${i}`}
              style={styles.row}>
              <Text style={styles.line}>
                <Text style={styles.strong}>{nameOf(c.by)}</Text>{' '}
                {c.kind === 'deleted' ? 'deleted' : 'edited'}{' '}
                <Text style={styles.strong}>{`\u201c${c.description}\u201d`}</Text>
              </Text>
              <Text style={styles.detail}>
                {formatWhen(c.at)}
                {c.kind === 'deleted'
                  ? ` · was ${formatMoneyShort(-(c.amountDelta || 0), currency)}`
                  : c.lines.length
                  ? ` · ${c.lines.join(' · ')}`
                  : ''}
              </Text>
              {c.yourImpact != null && Math.abs(c.yourImpact) > 0.004 && (
                <Text
                  style={[
                    styles.impact,
                    {
                      color:
                        c.yourImpact > 0 ? theme.color.green : theme.color.rose,
                    },
                  ]}>
                  {c.yourImpact > 0
                    ? `You now get back ${formatMoneyShort(c.yourImpact, currency)} more`
                    : `You now get back ${formatMoneyShort(-c.yourImpact, currency)} less`}
                </Text>
              )}
            </View>
          ))}
        </>
      )}
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    borderColor: 'rgba(240,185,77,0.4)',
  },
  header: {flexDirection: 'row', alignItems: 'center', gap: 8},
  countPill: {
    minWidth: 20,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(240,185,77,0.16)',
  },
  countText: {
    color: theme.color.amber,
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(11),
    fontWeight: '700',
  },
  title: {
    flex: 1,
    color: theme.color.amber,
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(13.5),
    fontWeight: '700',
  },
  sub: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(12),
    marginTop: 8,
    marginBottom: 6,
  },
  row: {
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.color.border,
  },
  line: {
    color: theme.color.inkSoft,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(13.5),
  },
  strong: {color: theme.color.ink, fontFamily: BodyFont.semibold, fontWeight: '600'},
  detail: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(12),
    marginTop: 2,
  },
  impact: {
    fontFamily: BodyFont.semibold,
    fontSize: moderateScale(12),
    fontWeight: '600',
    marginTop: 3,
  },
  flip: {transform: [{rotate: '180deg'}]},
});

export default BalanceChangesCard;
