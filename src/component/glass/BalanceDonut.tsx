// src/component/glass/BalanceDonut.tsx
// The "money in / out, as circles" dashboard piece: one ring split into a
// green arc (what's owed to you) and a rose arc (what you owe), with the
// net amount in the center. Built with react-native-svg (already a
// project dependency) - two overlapping circle strokes with a dash
// offset, no charting library needed.

import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Svg, {Circle, G} from 'react-native-svg';
import theme from '../../utils/theme';
import {formatMoney} from '../../services/ledger/currency';

interface Props {
  owed: number; // total owed to you, across groups
  owe: number; // total you owe, across groups
  currency?: string; // ISO code the owed/owe numbers are in - see useGroupsOverview's primaryCurrency
  size?: number;
}

const BalanceDonut: React.FC<Props> = ({owed, owe, currency, size = 148}) => {
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = owed + owe;
  const net = owed - owe;
  const owedFraction = total > 0 ? owed / total : 0;

  const owedLength = circumference * owedFraction;

  return (
    <View style={{width: size, height: size}}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={total > 0 ? theme.color.rose : theme.color.surfaceStrong}
            strokeWidth={strokeWidth}
            strokeOpacity={total > 0 ? 0.9 : 1}
            fill="none"
          />
          {total > 0 && (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={theme.color.green}
              strokeWidth={strokeWidth}
              strokeDasharray={`${owedLength}, ${circumference}`}
              strokeLinecap="round"
              fill="none"
            />
          )}
        </G>
      </Svg>
      <View style={[styles.center, {width: size, height: size}]}>
        {total <= 0.01 ? (
          <>
            <Text style={styles.settledEmoji}>🎉</Text>
            <Text style={styles.settledText}>All settled</Text>
          </>
        ) : (
          <>
            <Text style={styles.netLabel}>
              {net >= 0 ? "You're owed" : 'You owe'}
            </Text>
            <Text
              style={[
                styles.netAmount,
                {color: net >= 0 ? theme.color.green : theme.color.rose},
              ]}>
              {formatMoney(Math.abs(net), currency, 0)}
            </Text>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  netLabel: {color: theme.color.inkFaint, fontSize: 11.5},
  netAmount: {fontSize: 22, fontWeight: '800', marginTop: 2},
  settledEmoji: {fontSize: 22},
  settledText: {
    color: theme.color.inkSoft,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
});

export default BalanceDonut;
