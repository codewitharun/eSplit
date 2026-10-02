// src/component/GroupInsightsCard.tsx
// The Activity screen's header card, upgraded from "Total spent + Invite"
// to a small animated analytics card:
//   - total group spend, counting up
//   - the user's position as a pill (+₹ owed to you / −₹ you owe /
//     settled) - always arrow + words, never colour alone
//   - a bar of "your share" of the group's spend, growing in
//   - your share / you paid / top category in plain text
// Anything passed as children (the existing Invite row) renders at the
// bottom unchanged. Personal lists skip the pill and the bar - there's no
// one else to owe or share with.
// Read-only: everything comes from data the screen already loaded.

import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Check,
} from 'lucide-react-native';
import React, {useEffect} from 'react';
import {StyleSheet, View} from 'react-native';
import {Text} from './ui/AppText';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {formatMoney} from '../services/ledger/currency';
import {GroupInsights} from '../services/ledger/groupInsights';
import {EXPENSE_CATEGORIES} from '../services/ledger/types';
import {useCountUp} from '../utils/animation';
import {BodyFont, DisplayFont, moderateScale} from '../utils/fonts';
import theme from '../utils/theme';
import GlassCard from './glass/GlassCard';

interface Props {
  insights: GroupInsights;
  currency?: string;
  isPersonal?: boolean;
  children?: React.ReactNode;
}

const GroupInsightsCard: React.FC<Props> = ({
  insights,
  currency,
  isPersonal,
  children,
}) => {
  const total = useCountUp(insights.totalSpent, 700);
  const fill = useSharedValue(0);

  useEffect(() => {
    fill.value = withDelay(
      150,
      withTiming(insights.myShareRatio, {duration: 800}),
    );
  }, [insights.myShareRatio, fill]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(fill.value * 100, 0)}%`,
  }));

  const top = insights.topCategory
    ? EXPENSE_CATEGORIES.find(c => c.key === insights.topCategory!.key)
    : null;
  const pct = (r: number) => `${Math.round(r * 100)}%`;

  const pill =
    insights.position === 'owed'
      ? {
          style: styles.pillOwed,
          textStyle: styles.pillTextOwed,
          icon: <ArrowUpRight size={14} color={theme.color.green} />,
          text: `+${formatMoney(insights.net, currency)} you’re owed`,
        }
      : insights.position === 'owes'
      ? {
          style: styles.pillOwes,
          textStyle: styles.pillTextOwes,
          icon: <ArrowDownRight size={14} color={theme.color.rose} />,
          text: `−${formatMoney(-insights.net, currency)} you owe`,
        }
      : {
          style: styles.pillSettled,
          textStyle: styles.pillTextSettled,
          icon: <Check size={14} color={theme.color.inkSoft} />,
          text: 'All settled',
        };

  return (
    <Animated.View entering={FadeInDown.duration(450)}>
      <GlassCard style={styles.card}>
        <View style={styles.topRow}>
          <Text style={styles.label}>
            {isPersonal ? 'Total spent' : 'Total group spend'}
          </Text>
          {!isPersonal && insights.expenseCount > 0 && (
            <Animated.View
              entering={FadeInDown.delay(250).duration(400)}
              style={[styles.pill, pill.style]}
              accessibilityLabel={pill.text}>
              {pill.icon}
              <Text style={[styles.pillText, pill.textStyle]}>{pill.text}</Text>
            </Animated.View>
          )}
        </View>
        <Text style={styles.amount}>{formatMoney(total, currency)}</Text>

        {!isPersonal && insights.totalSpent > 0 && (
          <>
            <View
              style={styles.track}
              accessibilityLabel={`Your share is ${pct(
                insights.myShareRatio,
              )} of the group's spend`}>
              <Animated.View style={[styles.fill, fillStyle]} />
            </View>
            <View style={styles.statsRow}>
              <Text style={styles.stat}>
                Your share{' '}
                <Text style={styles.statStrong}>
                  {formatMoney(insights.myShare, currency)}
                </Text>{' '}
                · {pct(insights.myShareRatio)}
              </Text>
              <Text style={styles.stat}>
                You paid{' '}
                <Text style={styles.statStrong}>
                  {formatMoney(insights.myPaid, currency)}
                </Text>
              </Text>
            </View>
          </>
        )}

        {insights.expenseCount > 0 && (
          <Animated.View
            entering={FadeInDown.delay(350).duration(400)}
            style={styles.chips}>
            <View style={styles.chip}>
              <CalendarDays size={13} color={theme.color.inkSoft} />
              <Text style={styles.chipText}>
                This month{' '}
                <Text style={styles.chipStrong}>
                  {formatMoney(insights.thisMonth, currency, 0)}
                </Text>
              </Text>
              {insights.monthChange !== null && (
                <Text
                  style={styles.chipText}
                  accessibilityLabel={`${
                    insights.monthChange >= 0 ? 'up' : 'down'
                  } ${pct(Math.abs(insights.monthChange))} from last month`}>
                  {insights.monthChange >= 0 ? '↑' : '↓'}
                  {pct(Math.abs(insights.monthChange))}
                </Text>
              )}
            </View>
            {top && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {top.icon} {top.label}{' '}
                  <Text style={styles.chipStrong}>
                    {pct(insights.topCategory!.ratio)}
                  </Text>
                </Text>
              </View>
            )}
            <View style={styles.chip}>
              <Text style={styles.chipText}>
                <Text style={styles.chipStrong}>{insights.expenseCount}</Text>{' '}
                expense{insights.expenseCount === 1 ? '' : 's'}
              </Text>
            </View>
          </Animated.View>
        )}

        {children}
      </GlassCard>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {marginHorizontal: 20, marginBottom: 14},
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(12),
  },
  amount: {
    color: theme.color.ink,
    fontFamily: DisplayFont.extrabold,
    fontSize: moderateScale(28),
    fontWeight: '800',
    marginTop: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
  },
  pillOwed: {
    backgroundColor: 'rgba(62,207,142,0.12)',
    borderColor: 'rgba(62,207,142,0.35)',
  },
  pillOwes: {
    backgroundColor: 'rgba(240,129,156,0.12)',
    borderColor: 'rgba(240,129,156,0.35)',
  },
  pillSettled: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: theme.color.border,
  },
  pillText: {
    fontFamily: BodyFont.semibold,
    fontSize: moderateScale(12),
    fontWeight: '600',
  },
  pillTextOwed: {color: theme.color.green},
  pillTextOwes: {color: theme.color.rose},
  pillTextSettled: {color: theme.color.inkSoft},
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginTop: 12,
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: theme.color.teal,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 6,
  },
  stat: {
    color: theme.color.inkSoft,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(12.5),
  },
  statStrong: {
    color: theme.color.ink,
    fontFamily: BodyFont.semibold,
    fontWeight: '600',
  },
  chips: {flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12},
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  chipText: {
    color: theme.color.inkSoft,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(11.5),
  },
  chipStrong: {
    color: theme.color.ink,
    fontFamily: BodyFont.semibold,
    fontWeight: '600',
  },
});

export default GroupInsightsCard;
