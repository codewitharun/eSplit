// src/component/MonthInsightCard.tsx
// Dashboard "This month" insight: your top category so far this month and
// how your spending compares with the same days last month. Display only
// for now (tapping does nothing - a category breakdown screen can hang off
// it later). Renders nothing when there isn't enough data to say anything
// meaningful (see computeMonthInsight's minExpenses).
import {TrendingDown, TrendingUp} from 'lucide-react-native';
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Text} from './ui/AppText';
import GlassCard from './glass/GlassCard';
import {formatMoneyShort} from '../services/ledger/currency';
import type {MonthInsight} from '../services/ledger/monthInsight';
import {BodyFont, DisplayFont, moderateScale} from '../utils/fonts';
import theme from '../utils/theme';

interface Props {
  insight: MonthInsight | null;
  scopeLabel?: string; // e.g. "personal" - shown when the toggle narrows it
}

const MonthInsightCard: React.FC<Props> = ({insight, scopeLabel}) => {
  if (!insight) {
    return null;
  }
  const {top, delta, currency, thisMonthTotal, thisPeriodLabel, lastPeriodLabel} =
    insight;
  // Within ~1 unit counts as "about the same" - no green/red for noise.
  const flat = delta != null && Math.abs(delta) < 1;
  const spentLess = delta != null && delta < 0;
  const tone = flat || delta == null
    ? theme.color.inkSoft
    : spentLess
    ? theme.color.green
    : theme.color.rose;

  return (
    <GlassCard style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconTile}>
          <Text style={styles.icon}>{top.icon}</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.eyebrow}>
            This month · {thisPeriodLabel}
            {scopeLabel ? ` · ${scopeLabel}` : ''}
          </Text>
          <Text style={styles.headline} numberOfLines={2}>
            <Text style={styles.strong}>{top.label}</Text> is your top spend ·{' '}
            {formatMoneyShort(top.amount, currency)}
          </Text>
          {delta == null ? (
            <Text style={styles.sub}>
              {formatMoneyShort(thisMonthTotal, currency)} spent so far
            </Text>
          ) : (
            <View style={styles.deltaRow}>
              {!flat &&
                (spentLess ? (
                  <TrendingDown size={14} color={tone} />
                ) : (
                  <TrendingUp size={14} color={tone} />
                ))}
              <Text style={[styles.sub, styles.subInRow, {color: tone}]}>
                {/* Spelled-out dates ("than 1–4 Sep") instead of "this
                time last month", which read as ambiguous. */}
                {flat
                  ? `Spent about the same as ${lastPeriodLabel}`
                  : `Spent ${formatMoneyShort(Math.abs(delta), currency)} ${
                      spentLess ? 'less' : 'more'
                    } than ${lastPeriodLabel}`}
              </Text>
            </View>
          )}
        </View>
      </View>
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  card: {marginTop: 12, paddingVertical: 14},
  row: {flexDirection: 'row', alignItems: 'center', gap: 14},
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: theme.color.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {fontSize: moderateScale(22)},
  body: {flex: 1},
  eyebrow: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(10.5),
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  headline: {
    color: theme.color.inkSoft,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(14),
    marginTop: 3,
  },
  strong: {
    color: theme.color.ink,
    fontFamily: DisplayFont.bold,
    fontWeight: '700',
  },
  deltaRow: {flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4},
  subInRow: {marginTop: 0, flexShrink: 1},
  sub: {
    color: theme.color.inkSoft,
    fontFamily: BodyFont.semibold,
    fontSize: moderateScale(12.5),
    fontWeight: '600',
    marginTop: 4,
  },
});

export default MonthInsightCard;
