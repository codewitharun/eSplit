// src/screens/AfterLogin/Balances.tsx
// The screen that didn't exist before: net balances, the minimum set of
// transfers to clear the group (via the debt simplifier), one-tap settle
// with a UPI deep link when the payee has a VPA on file, and the PDF/CSV
// exports moved here from the old "Show Total" toggle.

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import React, {useEffect, useState} from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import AnimatedNumber from '../../component/glass/AnimatedNumber';
import GlassCard from '../../component/glass/GlassCard';
import GroupSwitcherPill from '../../component/GroupSwitcherPill';
import GradientMesh from '../../component/glass/GradientMesh';
import SwipeableRow from '../../component/glass/SwipeableRow';
import {useGroupLedger} from '../../hooks/useGroupLedger';
import {addSettlement} from '../../services/ledger/firestoreLedger';
import {
  exportGroupExcel,
  exportGroupPdf,
} from '../../services/ledger/exportReport';
import {buildUpiPayUri} from '../../services/ledger/upi';
import {useExpenseState} from '../../store/useExpenseStore';
import {haptics} from '../../utils/haptics';
import theme from '../../utils/theme';

const BalancesScreen: React.FC = () => {
  const user = auth().currentUser;
  const groupKey = useExpenseState(state => state.groupKey);
  const ledger = useGroupLedger(groupKey);
  const [upiIds, setUpiIds] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!ledger.members.length) {
      return;
    }
    (async () => {
      const entries = await Promise.all(
        ledger.members.map(async m => {
          const doc = await firestore().collection('users').doc(m.uid).get();
          return [m.uid, doc.exists ? doc.data()?.upiId || '' : ''] as const;
        }),
      );
      setUpiIds(Object.fromEntries(entries));
    })();
  }, [ledger.members]);

  const myBalance = user ? ledger.netBalances[user.uid] || 0 : 0;

  const settle = async (fromUid: string, toUid: string, amount: number) => {
    if (!groupKey) {
      return;
    }
    try {
      await addSettlement(groupKey, {
        fromUid,
        toUid,
        amount,
        currency: 'INR',
        method: 'upi',
      });
      haptics.success();
      Toast.show({type: 'success', text1: 'Settlement recorded'});
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not record settlement',
        text2: error?.message,
      });
    }
  };

  const handleSettlePress = (
    fromUid: string,
    toUid: string,
    amount: number,
  ) => {
    const vpa = upiIds[toUid];
    const uri = vpa
      ? buildUpiPayUri({
          payeeVpa: vpa,
          payeeName: ledger.memberName(toUid),
          amount,
          note: 'EzySplit settle-up',
        })
      : null;

    if (uri) {
      Linking.openURL(uri).catch(() =>
        Toast.show({
          type: 'info',
          text1: 'No UPI app found',
          text2: 'Recording the settlement anyway.',
        }),
      );
    } else {
      Toast.show({
        type: 'info',
        text1: `${ledger.memberName(toUid)} hasn't added a UPI ID`,
        text2: 'Recording as settled — pay them however you normally would.',
      });
    }
    settle(fromUid, toUid, amount);
  };

  const onExportPdf = async () => {
    if (!groupKey) {
      return;
    }
    try {
      const path = await exportGroupPdf(
        ledger.group?.name || 'Group',
        ledger.members,
        ledger.expenses,
        ledger.netBalances,
        ledger.totalSpent,
        ledger.settlements,
      );
      Toast.show({type: 'success', text1: 'PDF exported', text2: path});
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'PDF export failed',
        text2: error?.message,
      });
    }
  };

  const onExportExcel = async () => {
    if (!groupKey) {
      return;
    }
    try {
      const path = await exportGroupExcel(
        ledger.group?.name || 'Group',
        ledger.members,
        ledger.expenses,
        ledger.netBalances,
        ledger.totalSpent,
        ledger.settlements,
      );
      Toast.show({type: 'success', text1: 'Excel exported', text2: path});
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Excel export failed',
        text2: error?.message,
      });
    }
  };

  if (!groupKey) {
    return (
      <View style={styles.flex}>
        <GradientMesh />
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No group selected yet.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <GradientMesh />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Balances</Text>
        <GroupSwitcherPill />

        <GlassCard tilt strong style={styles.heroCard}>
          <Text style={styles.heroLabel}>
            {myBalance >= 0 ? "You're owed" : 'You owe'}
          </Text>
          <AnimatedNumber
            value={Math.abs(myBalance)}
            prefix="₹"
            decimals={2}
            style={[
              styles.heroAmount,
              {color: myBalance >= 0 ? theme.color.green : theme.color.rose},
            ]}
          />
          <Text style={styles.heroSub}>
            Total group spend: ₹{ledger.totalSpent.toFixed(2)}
          </Text>
        </GlassCard>

        <Text style={styles.sectionTitle}>Who owes whom</Text>
        {ledger.transfers.length === 0 && (
          <Text style={styles.emptyText}>Everyone's settled up. 🎉</Text>
        )}
        {ledger.transfers.map((t, i) => {
          const isMine = t.fromUid === user?.uid;
          return (
            <SwipeableRow
              key={`${t.fromUid}-${t.toUid}-${i}`}
              actionLabel="Settle"
              actionColor={theme.color.green}
              onAction={() => handleSettlePress(t.fromUid, t.toUid, t.amount)}>
              <GlassCard style={styles.transferRow}>
                <Text style={styles.transferText}>
                  {t.fromUid === user?.uid
                    ? 'You'
                    : ledger.memberName(t.fromUid)}{' '}
                  owe
                  {t.fromUid === user?.uid ? '' : 's'}{' '}
                  {t.toUid === user?.uid ? 'you' : ledger.memberName(t.toUid)}
                </Text>
                <Text style={styles.transferAmount}>
                  ₹{t.amount.toFixed(2)}
                </Text>
                {isMine && (
                  <TouchableOpacity
                    style={styles.settleBtn}
                    onPress={() =>
                      handleSettlePress(t.fromUid, t.toUid, t.amount)
                    }>
                    <Text style={styles.settleBtnText}>Settle</Text>
                  </TouchableOpacity>
                )}
              </GlassCard>
            </SwipeableRow>
          );
        })}

        <Text style={styles.sectionTitle}>Per-person totals</Text>
        {ledger.members.map(m => (
          <View key={m.uid} style={styles.memberRow}>
            <Text style={styles.memberName}>
              {m.uid === user?.uid ? 'You' : m.displayName}
            </Text>
            <Text
              style={[
                styles.memberBalance,
                {
                  color:
                    (ledger.netBalances[m.uid] || 0) >= 0
                      ? theme.color.green
                      : theme.color.rose,
                },
              ]}>
              {(ledger.netBalances[m.uid] || 0) >= 0 ? '+' : ''}₹
              {(ledger.netBalances[m.uid] || 0).toFixed(2)}
            </Text>
          </View>
        ))}

        <View style={styles.exportRow}>
          <TouchableOpacity style={styles.exportBtn} onPress={onExportPdf}>
            <Text style={styles.exportText}>Export PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportBtn} onPress={onExportExcel}>
            <Text style={styles.exportText}>Export Excel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1, backgroundColor: theme.color.ground},
  content: {padding: 20, paddingTop: 60, paddingBottom: 60},
  heading: {
    color: theme.color.ink,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
  },
  heroCard: {alignItems: 'center', paddingVertical: 28, marginBottom: 24},
  heroLabel: {color: theme.color.inkSoft, fontSize: 13},
  heroAmount: {fontSize: 40, fontWeight: '800', marginTop: 6},
  heroSub: {color: theme.color.inkFaint, fontSize: 12.5, marginTop: 8},
  sectionTitle: {
    color: theme.color.inkSoft,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 8,
  },
  emptyText: {color: theme.color.inkFaint, fontSize: 13.5, marginBottom: 12},
  transferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    padding: 14,
  },
  transferText: {color: theme.color.ink, fontSize: 13.5, flex: 1},
  transferAmount: {color: theme.color.ink, fontWeight: '700', marginRight: 10},
  settleBtn: {
    backgroundColor: theme.color.green,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  settleBtnText: {color: theme.color.onAccent, fontWeight: '700', fontSize: 12},
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  memberName: {color: theme.color.ink, fontSize: 14},
  memberBalance: {fontWeight: '700', fontVariant: ['tabular-nums']},
  exportRow: {flexDirection: 'row', gap: 10, marginTop: 24},
  exportBtn: {
    flex: 1,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  exportText: {color: theme.color.ink, fontWeight: '600', fontSize: 13},
  emptyState: {flex: 1, justifyContent: 'center', alignItems: 'center'},
});

export default BalancesScreen;
