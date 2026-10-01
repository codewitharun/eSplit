// src/screens/AfterLogin/Balances.tsx
// The screen that didn't exist before: net balances, a direct pair-by-pair
// "who owes whom" ledger (computePairwiseLedger - straight per-expense
// math, not a minimum-transaction simplification users found confusing),
// one-tap settle with a UPI deep link when the payee has a VPA on file,
// and the PDF/CSV exports moved here from the old "Show Total" toggle.
//
// The "Your UPI ID" editor moved here from the old Profile.tsx (which is
// being repurposed as a standalone account screen) since UPI is what
// makes the settle-up deep link above actually work - it belongs next to
// the balances it affects, not buried in a general profile screen. The
// data model is unchanged: still per-USER (users/{uid}.upiId), read here
// for every OTHER member (unchanged) and now also read/written here for
// the current user instead of in Profile.tsx.

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {useBottomTabBarHeight} from '@react-navigation/bottom-tabs';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  AppState,
  BackHandler,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from '../../services/toast';
import FileViewer from 'react-native-file-viewer';
import AppAlert from '../../services/appAlert';
import AnimatedNumber from '../../component/glass/AnimatedNumber';
import GlassCard from '../../component/glass/GlassCard';
import GroupSwitcherPill from '../../component/GroupSwitcherPill';
import HomeIconChip from '../../component/HomeIconChip';
import SwipeableRow from '../../component/glass/SwipeableRow';
import {useGroupLedger} from '../../hooks/useGroupLedger';
import {addSettlement} from '../../services/ledger/firestoreLedger';
import {
  exportGroupExcel,
  exportGroupPdf,
} from '../../services/ledger/exportReport';
import {buildUpiPayUri, isValidUpiVpa} from '../../services/ledger/upi';
import {
  currencySymbol,
  formatMoney,
  isUpiCurrency,
} from '../../services/ledger/currency';
import {Routes} from '../../navigator/constants';
import {useExpenseState} from '../../store/useExpenseStore';
import {haptics} from '../../utils/haptics';
import theme from '../../utils/theme';
import {BodyFont, DisplayFont, moderateScale} from '../../utils/fonts';

const BalancesScreen: React.FC = () => {
  const user = auth().currentUser;
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  // Real height of the floating tab bar (it overlays content now
  // instead of reserving its own row - see BottomTabNavigator.tsx),
  // so scrollable content here can pad exactly enough to clear it at
  // rest while still scrolling underneath it past that point.
  const tabBarHeight = useBottomTabBarHeight();
  const groupKey = useExpenseState(state => state.groupKey);
  const ledger = useGroupLedger(groupKey);
  const [upiIds, setUpiIds] = useState<Record<string, string>>({});
  const [myUpiId, setMyUpiId] = useState('');
  const [savingUpi, setSavingUpi] = useState(false);

  // Balances is a secondary tab, so the hardware back button should first
  // return the user to the home tab (Activity) rather than exiting the
  // app - matching how most tabbed Android apps treat back on a non-home
  // tab. See Activity.tsx for the home-tab handler that takes over once
  // the user is back there.
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        navigation.navigate(Routes.TabTransaction);
        return true;
      };
      const sub = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress,
      );
      return () => sub.remove();
    }, [navigation]),
  );

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

  // The current user's own UPI ID is also present in `upiIds` once the
  // fetch above lands (they're a member of their own group) - seed the
  // editable field from that instead of a second read of the same doc.
  useEffect(() => {
    if (user && upiIds[user.uid] !== undefined) {
      setMyUpiId(upiIds[user.uid]);
    }
  }, [user, upiIds]);

  const saveMyUpiId = async () => {
    if (!user) {
      return;
    }
    if (myUpiId && !isValidUpiVpa(myUpiId)) {
      Toast.show({
        type: 'error',
        text1: 'That doesn’t look like a UPI ID',
        text2: 'e.g. name@bank',
      });
      return;
    }
    setSavingUpi(true);
    try {
      await firestore()
        .collection('users')
        .doc(user.uid)
        .set({upiId: myUpiId.trim()}, {merge: true});
      setUpiIds(prev => ({...prev, [user.uid]: myUpiId.trim()}));
      haptics.success();
      Toast.show({type: 'success', text1: 'UPI ID saved'});
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not save',
        text2: error?.message,
      });
    } finally {
      setSavingUpi(false);
    }
  };

  const myBalance = user ? ledger.netBalances[user.uid] || 0 : 0;
  // A personal list (or, incidentally, any real group everyone else has
  // left) has nobody to owe or settle with - UPI-for-receiving-payment,
  // "who owes whom", and a per-person breakdown are all meaningless with
  // one member, so this screen shows a much simpler view instead of the
  // full settle-up UI for those.
  const isPersonal = ledger.members.length <= 1;

  const settle = async (
    fromUid: string,
    toUid: string,
    amount: number,
    method: 'upi' | 'other' = 'other',
  ) => {
    if (!groupKey) {
      return;
    }
    try {
      await addSettlement(groupKey, {
        fromUid,
        toUid,
        amount,
        currency: ledger.group?.currency || 'INR',
        method,
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

  // A UPI intent has no way to report payment completion back to the app
  // (that would need a native PSP SDK, not just Linking) - so this used to
  // just fire `settle()` unconditionally, in the same breath as opening the
  // UPI app. Firestore was recording the debt as paid before the user had
  // even reached the PIN screen, which read as "tapping Settle instantly
  // settles it" rather than "go pay, then it's settled". Fixed by deferring
  // the actual settle() until the app is foregrounded again (i.e. the user
  // came back from the UPI app) and asking them to confirm they paid.
  const pendingSettlementRef = useRef<{
    fromUid: string;
    toUid: string;
    amount: number;
  } | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active' || !pendingSettlementRef.current) {
        return;
      }
      const pending = pendingSettlementRef.current;
      pendingSettlementRef.current = null;
      AppAlert.alert(
        'Mark as paid?',
        `Did you complete the ${formatMoney(
          pending.amount,
          ledger.group?.currency,
        )} payment to ${ledger.memberName(pending.toUid)}?`,
        [
          {text: 'Not yet', style: 'cancel'},
          {
            text: 'Yes, paid',
            onPress: () =>
              settle(pending.fromUid, pending.toUid, pending.amount, 'upi'),
          },
        ],
      );
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledger]);

  const handleSettlePress = (
    fromUid: string,
    toUid: string,
    amount: number,
  ) => {
    const groupCurrency = ledger.group?.currency;

    // UPI only exists as a payment rail in India - a group in any other
    // currency skips the VPA/deep-link attempt entirely and goes straight
    // to a manual settle confirmation. Checked first, before even looking
    // at upiIds, so a stray UPI ID on file (e.g. from before this group's
    // currency was set) can never trigger a upi:// intent for a currency
    // it doesn't apply to.
    if (!isUpiCurrency(groupCurrency)) {
      AppAlert.alert(
        'Mark as settled?',
        `Mark the ${formatMoney(
          amount,
          groupCurrency,
        )} payment to ${ledger.memberName(
          toUid,
        )} as settled? Pay them however you normally would - bank transfer, cash, whatever you two use.`,
        [
          {text: 'Not yet', style: 'cancel'},
          {
            text: 'Mark as settled',
            onPress: () => settle(fromUid, toUid, amount, 'other'),
          },
        ],
      );
      return;
    }

    const vpa = upiIds[toUid];
    const uri = vpa
      ? buildUpiPayUri({
          payeeVpa: vpa,
          payeeName: ledger.memberName(toUid),
          amount,
          // Group name in the note, not just "EzySplit settle-up", so this
          // shows up distinguishably in both people's UPI app history when
          // they're splitting across more than one group at a time.
          note: `${ledger.group?.name || 'EzySplit'} settle-up`,
        })
      : null;

    // Every path here asks before writing to Firestore, not just the
    // "opened the UPI app" one - a blind "click Settle -> balance goes to
    // zero" with no confirmation isn't honest about whether money actually
    // moved, whichever of the three situations below it is.
    if (uri) {
      pendingSettlementRef.current = {fromUid, toUid, amount};
      Linking.openURL(uri).catch(() => {
        pendingSettlementRef.current = null;
        AppAlert.alert(
          'No UPI app found',
          `Mark the ${formatMoney(
            amount,
            groupCurrency,
          )} payment to ${ledger.memberName(
            toUid,
          )} as settled anyway? Pay them however you normally would.`,
          [
            {text: 'Not yet', style: 'cancel'},
            {
              text: 'Mark as settled',
              onPress: () => settle(fromUid, toUid, amount, 'other'),
            },
          ],
        );
      });
    } else {
      AppAlert.alert(
        `${ledger.memberName(toUid)} hasn't added a UPI ID`,
        `Mark the ${formatMoney(
          amount,
          groupCurrency,
        )} payment as settled anyway? Pay them however you normally would.`,
        [
          {text: 'Not yet', style: 'cancel'},
          {
            text: 'Mark as settled',
            onPress: () => settle(fromUid, toUid, amount, 'other'),
          },
        ],
      );
    }
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
        ledger.group?.currency,
      );
      haptics.success();
      Toast.show({type: 'success', text1: 'PDF exported'});
      // The file lives in the app's own private storage (see
      // exportReport.ts) - there's nothing at a path the user could
      // browse to, so hand it straight to the OS "Open with" chooser
      // where they can view it or save/share it wherever they like.
      // Best-effort: the export itself already succeeded and the toast
      // above already said so, so a viewer failure (e.g. no PDF app on
      // the device) shouldn't read as the export having failed.
      FileViewer.open(path, {showOpenWithDialog: true}).catch(() => {});
    } catch (error: any) {
      haptics.warning();
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
        ledger.group?.currency,
      );
      haptics.success();
      Toast.show({type: 'success', text1: 'Excel exported'});
      // Same hand-off as onExportPdf above.
      FileViewer.open(path, {showOpenWithDialog: true}).catch(() => {});
    } catch (error: any) {
      haptics.warning();
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
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No group selected yet.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          // The tab bar floats over content now instead of reserving
          // its own row (see BottomTabNavigator.tsx) - pad for its real
          // height so the last card isn't hidden underneath it at rest.
          {paddingTop: insets.top + 24, paddingBottom: tabBarHeight + 24},
        ]}>
        <View style={styles.headingRow}>
          <Text style={[styles.heading, styles.headingNoMargin]}>Balances</Text>
          <View style={styles.headerRightGroup}>
            <HomeIconChip />
            <GroupSwitcherPill iconOnly />
          </View>
        </View>

        <GlassCard tilt strong style={styles.heroCard}>
          <Text style={styles.heroLabel}>
            {myBalance >= 0 ? "You're owed" : 'You owe'}
          </Text>
          <AnimatedNumber
            value={Math.abs(myBalance)}
            prefix={currencySymbol(ledger.group?.currency)}
            decimals={2}
            style={[
              styles.heroAmount,
              {color: myBalance >= 0 ? theme.color.green : theme.color.rose},
            ]}
          />
          <Text style={styles.heroSub}>
            Total group spend:{' '}
            {formatMoney(ledger.totalSpent, ledger.group?.currency)}
          </Text>
        </GlassCard>

        {isUpiCurrency(ledger.group?.currency) && !isPersonal && (
          <>
            <Text style={styles.sectionTitle}>Your UPI ID (for settle-up)</Text>
            <GlassCard style={styles.upiCard}>
              <TextInput
                style={styles.upiInput}
                placeholder="yourname@bank"
                placeholderTextColor={theme.color.inkFaint}
                autoCapitalize="none"
                value={myUpiId}
                onChangeText={setMyUpiId}
              />
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={saveMyUpiId}
                disabled={savingUpi}>
                <Text style={styles.saveBtnText}>
                  {savingUpi ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </GlassCard>
            <Text style={styles.hint}>
              When someone settles up with you, this is what lets EzySplit open
              GPay/PhonePe with the amount prefilled.
            </Text>
          </>
        )}

        {isPersonal ? (
          <Text style={styles.emptyText}>
            This is a personal list - just you, nothing to split or settle.
          </Text>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Who owes whom</Text>
            {ledger.transfers.length === 0 && (
              <Text style={styles.emptyText}>Everyone's settled up. 🎉</Text>
            )}
          </>
        )}
        {!isPersonal &&
          ledger.transfers.map((t, i) => {
            const isMine = t.fromUid === user?.uid;
            const key = `${t.fromUid}-${t.toUid}-${i}`;
            const card = (
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
                  {formatMoney(t.amount, ledger.group?.currency)}
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
            );
            // Only the member who owes can settle their own debt. The swipe
            // gesture used to wrap every row unconditionally and fire
            // handleSettlePress() regardless of who was looking at it - in a
            // 3+ person group, that let anyone swipe-settle a debt between
            // two OTHER members. The inline "Settle" button was already
            // isMine-gated; the swipe wrapper wasn't, until now.
            return isMine ? (
              <SwipeableRow
                key={key}
                actionLabel="Settle"
                actionColor={theme.color.green}
                onAction={() =>
                  handleSettlePress(t.fromUid, t.toUid, t.amount)
                }>
                {card}
              </SwipeableRow>
            ) : (
              <View key={key}>{card}</View>
            );
          })}

        {!isPersonal && (
          <>
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
                  {(ledger.netBalances[m.uid] || 0) >= 0 ? '+' : ''}
                  {formatMoney(
                    ledger.netBalances[m.uid] || 0,
                    ledger.group?.currency,
                  )}
                </Text>
              </View>
            ))}
          </>
        )}

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
  // paddingTop is overridden per-render with the safe-area inset above -
  // a flat 60 here only happened to clear the status bar on devices
  // where the OS forces edge-to-edge (Android 15+).
  content: {padding: 20, paddingBottom: 60},
  heading: {
    color: theme.color.ink,
    fontFamily: DisplayFont.extrabold,
    fontSize: moderateScale(24),
    fontWeight: '800',
    marginBottom: 16,
  },
  // Wraps the heading + GroupSwitcherPill on one row (right-aligned pill)
  // instead of the pill sitting alone on its own line below the title -
  // the row itself now owns the marginBottom the bare heading used to.
  headingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headingNoMargin: {marginBottom: 0},
  // GroupSwitcherPill's own default marginTop gave it breathing room
  // below a title - centered in this row instead, that same margin just
  // pushed it down and off-center.
  headerRightGroup: {flexDirection: 'row', alignItems: 'center', gap: 8},
  heroCard: {alignItems: 'center', paddingVertical: 28, marginBottom: 24},
  heroLabel: {
    color: theme.color.inkSoft,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(13),
  },
  heroAmount: {
    fontFamily: DisplayFont.extrabold,
    fontSize: moderateScale(40),
    fontWeight: '800',
    marginTop: 6,
  },
  heroSub: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(12.5),
    marginTop: 8,
  },
  sectionTitle: {
    color: theme.color.inkSoft,
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(12),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 8,
  },
  upiCard: {flexDirection: 'row', alignItems: 'center', gap: 10},
  upiInput: {
    flex: 1,
    color: theme.color.ink,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(14.5),
  },
  saveBtn: {
    backgroundColor: theme.color.blue,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveBtnText: {
    color: theme.color.onAccent,
    fontFamily: BodyFont.bold,
    fontWeight: '700',
    fontSize: moderateScale(12.5),
  },
  hint: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(12),
    marginTop: 8,
    marginBottom: 8,
    lineHeight: moderateScale(17),
  },
  emptyText: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(13.5),
    marginBottom: 12,
  },
  transferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    padding: 14,
  },
  transferText: {
    color: theme.color.ink,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(13.5),
    flex: 1,
  },
  transferAmount: {
    color: theme.color.ink,
    fontFamily: BodyFont.bold,
    fontWeight: '700',
    marginRight: 10,
  },
  settleBtn: {
    backgroundColor: theme.color.green,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  settleBtnText: {
    color: theme.color.onAccent,
    fontFamily: BodyFont.bold,
    fontWeight: '700',
    fontSize: moderateScale(12),
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  memberName: {
    color: theme.color.ink,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(14),
  },
  memberBalance: {
    fontFamily: BodyFont.bold,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
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
  exportText: {
    color: theme.color.ink,
    fontFamily: BodyFont.semibold,
    fontWeight: '600',
    fontSize: moderateScale(13),
  },
  emptyState: {flex: 1, justifyContent: 'center', alignItems: 'center'},
});

export default BalancesScreen;
