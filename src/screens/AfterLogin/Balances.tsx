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

import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {useBottomTabBarHeight} from '@react-navigation/bottom-tabs';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AppState, BackHandler, Linking, ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import {Text, TextInput} from '../../component/ui/AppText';
import Toast from '../../services/toast';
import {openExportedFile} from '../../services/ledger/openExport';
import AppAlert from '../../services/appAlert';
import AnimatedNumber from '../../component/glass/AnimatedNumber';
import BalanceBar from '../../component/BalanceBar';
import MemberAvatar from '../../component/MemberAvatar';
import ProgressBar from '../../component/ProgressBar';
import {ArrowRight, Check} from 'lucide-react-native';
import {computeSettleUpSummary} from '../../services/ledger/groupInsights';
import GlassCard from '../../component/glass/GlassCard';
import GroupSwitcherPill from '../../component/GroupSwitcherPill';
import HomeIconChip from '../../component/HomeIconChip';
import SwipeableRow from '../../component/glass/SwipeableRow';
import {useGroupLedger} from '../../hooks/useGroupLedger';
import {addSettlement} from '../../data/ledger';
import {
  exportGroupExcel,
  exportGroupPdf,
} from '../../services/ledger/exportReport';
import {buildUpiPayUri, isValidUpiVpa} from '../../services/ledger/upi';
import {
  currencySymbol,
  formatMoney,
  formatSignedMoney,
  isUpiCurrency,
} from '../../services/ledger/currency';
import {Routes, FLOATING_ACTIONS_CLEARANCE} from '../../navigator/constants';
import {useExpenseState} from '../../store/useExpenseStore';
import {haptics} from '../../utils/haptics';
import {useCollapseFabsOnScroll} from '../../hooks/useCollapseFabsOnScroll';
import theme from '../../utils/theme';
import {BodyFont, DisplayFont, moderateScale} from '../../utils/fonts';
import {currentUser} from '../../data/firebase';
import {getUserUpiId, setUserUpiId} from '../../data/users';

const BalancesScreen: React.FC = () => {
  const user = currentUser();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  // Real height of the floating tab bar (it overlays content now
  // instead of reserving its own row - see BottomTabNavigator.tsx),
  // so scrollable content here can pad exactly enough to clear it at
  // rest while still scrolling underneath it past that point.
  const tabBarHeight = useBottomTabBarHeight();
  // Collapses the floating create button to icon-only while scrolling down.
  const onFabScroll = useCollapseFabsOnScroll();
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
          return [m.uid, await getUserUpiId(m.uid)] as const;
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
      await setUserUpiId(user.uid, myUpiId.trim());
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
  const isSettled = Math.abs(myBalance) < 0.01;
  // Hero card breakdown + settle-up progress - derived from the same
  // transfers/settlements this screen already shows, no extra reads.
  const summary = useMemo(
    () =>
      computeSettleUpSummary(
        ledger.transfers,
        ledger.settlements,
        user?.uid || '',
      ),
    [ledger.transfers, ledger.settlements, user?.uid],
  );
  const maxAbsBalance = useMemo(
    () =>
      Math.max(
        0,
        ...ledger.members.map(m => Math.abs(ledger.netBalances[m.uid] || 0)),
      ),
    [ledger.members, ledger.netBalances],
  );

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
      // browse to, so hand it straight to the OS share sheet (expo-sharing)
      // where they can view it or save/share it wherever they like.
      // Best-effort: the export itself already succeeded and the toast
      // above already said so, so a viewer failure (e.g. no PDF app on
      // the device) shouldn't read as the export having failed.
      openExportedFile(path, 'pdf').catch(() => {});
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
      openExportedFile(path, 'xlsx').catch(() => {});
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
        onScroll={onFabScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.content,
          // The tab bar floats over content now instead of reserving
          // its own row (see BottomTabNavigator.tsx) - pad for its real
          // height so the last card isn't hidden underneath it at rest.
          {
            paddingTop: insets.top + 24,
            paddingBottom: tabBarHeight + FLOATING_ACTIONS_CLEARANCE,
          },
        ]}>
        <View style={styles.headingRow}>
          <Text style={[styles.heading, styles.headingNoMargin]}>Balances</Text>
          <View style={styles.headerRightGroup}>
            <HomeIconChip />
            <GroupSwitcherPill iconOnly />
          </View>
        </View>

        <GlassCard style={styles.heroCard}>
          {isPersonal ? (
            <>
              <Text style={styles.heroLabel}>Total spent</Text>
              <AnimatedNumber
                value={ledger.totalSpent}
                prefix={currencySymbol(ledger.group?.currency)}
                decimals={2}
                style={[styles.heroAmount, {color: theme.color.ink}]}
              />
              <Text style={styles.heroSub}>
                Personal list · nothing to settle
              </Text>
            </>
          ) : isSettled ? (
            <>
              <View style={styles.settledBadge}>
                <Check size={22} color={theme.color.green} />
              </View>
              <Text style={styles.settledTitle}>You're all settled up</Text>
              <Text style={styles.heroSub}>
                Nothing owed either way · Group spend{' '}
                {formatMoney(ledger.totalSpent, ledger.group?.currency)}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.heroLabel}>
                {myBalance > 0 ? "You're owed" : 'You owe'}
              </Text>
              <AnimatedNumber
                value={Math.abs(myBalance)}
                prefix={currencySymbol(ledger.group?.currency)}
                decimals={2}
                style={[
                  styles.heroAmount,
                  {
                    color: myBalance > 0 ? theme.color.green : theme.color.rose,
                  },
                ]}
              />
              <Text style={styles.heroSub}>
                Total group spend:{' '}
                {formatMoney(ledger.totalSpent, ledger.group?.currency)}
              </Text>
            </>
          )}

          {!isPersonal && (
            <>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatLabel}>Owed to you</Text>
                  <Text style={[styles.heroStatValue, styles.positive]}>
                    {formatMoney(summary.owedToMe, ledger.group?.currency)}
                  </Text>
                  <Text style={styles.heroStatHint}>
                    {summary.owedToMeCount === 0
                      ? 'from no one'
                      : `from ${summary.owedToMeCount} ${
                          summary.owedToMeCount === 1 ? 'person' : 'people'
                        }`}
                  </Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatLabel}>You owe</Text>
                  <Text style={[styles.heroStatValue, styles.negative]}>
                    {formatMoney(summary.iOwe, ledger.group?.currency)}
                  </Text>
                  <Text style={styles.heroStatHint}>
                    {summary.iOweCount === 0
                      ? 'to no one'
                      : `to ${summary.iOweCount} ${
                          summary.iOweCount === 1 ? 'person' : 'people'
                        }`}
                  </Text>
                </View>
              </View>
              {summary.settled + summary.outstanding > 0 && (
                <View style={styles.progressBlock}>
                  <View style={styles.progressLabels}>
                    <Text style={styles.heroStatHint}>
                      Group settle-up progress
                    </Text>
                    <Text style={styles.heroStatHint}>
                      {Math.round(summary.settledRatio * 100)}% settled
                    </Text>
                  </View>
                  <ProgressBar value={summary.settledRatio} />
                  <Text style={[styles.heroStatHint, styles.progressFoot]}>
                    {formatMoney(summary.settled, ledger.group?.currency)}{' '}
                    settled ·{' '}
                    {formatMoney(summary.outstanding, ledger.group?.currency)}{' '}
                    still open
                  </Text>
                </View>
              )}
            </>
          )}
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
              <GlassCard
                style={
                  isMine || t.toUid === user?.uid
                    ? [styles.transferRow, styles.transferRowMine]
                    : styles.transferRow
                }>
                <View style={styles.transferPeople}>
                  <MemberAvatar
                    id={t.fromUid}
                    name={ledger.memberName(t.fromUid)}
                    size={28}
                  />
                  <ArrowRight size={14} color={theme.color.inkFaint} />
                  <MemberAvatar
                    id={t.toUid}
                    name={ledger.memberName(t.toUid)}
                    size={28}
                  />
                </View>
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
            <GlassCard style={styles.perPersonCard}>
              {/* Legend for the bars: the centre line is zero, left of
                  it means that person owes, right means they're owed. */}
              <View style={styles.legendRow}>
                <View style={styles.legendAvatarSpacer} />
                <View style={styles.legendMid}>
                  <Text style={[styles.legendText, styles.negative]}>
                    ← owes
                  </Text>
                  <Text style={[styles.legendText, styles.positive]}>
                    is owed →
                  </Text>
                </View>
                <View style={styles.amountCol} />
              </View>
              {ledger.members.map((m, i) => {
                const bal = ledger.netBalances[m.uid] || 0;
                return (
                  <View
                    key={m.uid}
                    style={[
                      styles.memberRow,
                      i === ledger.members.length - 1 && styles.memberRowLast,
                    ]}>
                    <MemberAvatar id={m.uid} name={m.displayName} size={28} />
                    <View style={styles.memberMid}>
                      <Text style={styles.memberName} numberOfLines={1}>
                        {m.uid === user?.uid ? 'You' : m.displayName}
                      </Text>
                      <BalanceBar
                        value={bal}
                        maxAbs={maxAbsBalance}
                        delay={120 + i * 60}
                      />
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.memberBalance,
                        styles.amountCol,
                        Math.abs(bal) < 0.01
                          ? styles.neutral
                          : bal > 0
                          ? styles.positive
                          : styles.negative,
                      ]}>
                      {formatSignedMoney(bal, ledger.group?.currency)}
                    </Text>
                  </View>
                );
              })}
            </GlassCard>
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
  // Same plain GlassCard as Activity's insights card (no tilt/strong
  // fill), kept compact.
  heroCard: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  heroLabel: {
    color: theme.color.inkSoft,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(13),
  },
  heroAmount: {
    fontFamily: DisplayFont.extrabold,
    fontSize: moderateScale(30),
    fontWeight: '800',
    marginTop: 2,
  },
  heroSub: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(12),
    marginTop: 4,
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
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
  },
  memberRowLast: {borderBottomWidth: 0},
  // Fixed-width amount column so every row's bar has the same width and
  // the zero line sits at the same x on every row.
  amountCol: {width: moderateScale(96), textAlign: 'right'},
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
  },
  legendAvatarSpacer: {width: 28},
  legendMid: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendText: {
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(10.5),
  },
  memberMid: {flex: 1, gap: 6},
  perPersonCard: {paddingVertical: 4, paddingHorizontal: 14},
  positive: {color: theme.color.green},
  negative: {color: theme.color.rose},
  neutral: {color: theme.color.inkSoft},
  transferPeople: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 10,
  },
  transferRowMine: {borderColor: 'rgba(56,217,201,0.45)'},
  settledBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(62,207,142,0.14)',
    marginBottom: 6,
  },
  settledTitle: {
    color: theme.color.ink,
    fontFamily: DisplayFont.bold,
    fontSize: moderateScale(18),
    fontWeight: '700',
  },
  heroStats: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.color.border,
  },
  heroStat: {flex: 1, alignItems: 'center'},
  heroStatDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: theme.color.border,
  },
  heroStatLabel: {
    color: theme.color.inkSoft,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(12),
  },
  heroStatValue: {
    fontFamily: DisplayFont.bold,
    fontSize: moderateScale(15.5),
    fontWeight: '700',
    marginTop: 2,
  },
  heroStatHint: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(11.5),
    marginTop: 2,
  },
  progressBlock: {alignSelf: 'stretch', marginTop: 12, gap: 5},
  progressLabels: {flexDirection: 'row', justifyContent: 'space-between'},
  progressFoot: {textAlign: 'center'},
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
