// src/screens/AfterLogin/GroupCheck.tsx
// The "Groups" screen: which group are you in right now. Redesigned to
// show your groups as a plain tappable list instead of hiding them behind
// a "Select a group" button that opens a modal - one less step for the
// single most common action on this screen. Also the deep-link landing
// target (Group-Check/:groupId), and reachable any time from Activity's
// header pill or the You tab's "Switch or create a group".

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useIsFocused, useRoute} from '@react-navigation/native';
import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Clock,
  Plus,
  Search,
  Sigma,
  SlidersHorizontal,
  X,
} from 'lucide-react-native';
import Toast from '../../services/toast';
import Chip from '../../component/glass/Chip';
import {GroupType} from '../../services/ledger/types';
import AppAlert from '../../services/appAlert';
import PositionRing from '../../component/glass/PositionRing';
import DashboardSkeleton from '../../component/glass/DashboardSkeleton';
import GlassCard from '../../component/glass/GlassCard';
import SwipeableRow from '../../component/glass/SwipeableRow';
import Header from '../../component/header';
import {useGroups} from '../../hooks/useGroups';
import {useGroupsOverview} from '../../hooks/useGroupsOverview';
import {leaveGroup} from '../../services/ledger/firestoreLedger';
import {mergeCurrencyTotals} from '../../services/ledger/spendTotals';
import GradientView from '../../component/glass/GradientView';
import {formatMoney, isUpiCurrency} from '../../services/ledger/currency';
import UpiPromptModal from '../../component/UpiPromptModal';
import {useExpenseState} from '../../store/useExpenseStore';
import {haptics} from '../../utils/haptics';
import theme from '../../utils/theme';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {BodyFont, MonoFont, Typography, moderateScale} from '../../utils/fonts';
import {useCountUp} from '../../utils/animation';

// Deterministic accent color per group (from its id) for the lettered
// avatar chip in the groups list - purely cosmetic variety, not tied to
// any stored field, so it never needs a migration if it changes later.
const AVATAR_PALETTE = [
  theme.color.blue,
  theme.color.teal,
  theme.color.green,
  theme.color.rose,
  theme.color.amber,
  theme.color.blueBright,
];
function avatarColorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    // eslint-disable-next-line no-bitwise
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

const GroupManagement = ({navigation}: any) => {
  const setGroupKey = useExpenseState(state => state.setGroupKey);
  const currentGroupKey = useExpenseState(state => state.groupKey);
  const [loader, setLoader] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  // Opening search used to leave the list scrolled wherever the user
  // already was, so the search box (and the first matching results)
  // could land mid-screen or fully offscreen below the fold - reported
  // as the search UX feeling broken. Snap back to the top the moment
  // search opens, same as tapping a "search" affordance does in most
  // other apps.
  const scrollRef = useRef<any>(null);
  useEffect(() => {
    if (searchVisible) {
      scrollRef.current?.scrollToPosition(0, 0, true);
    }
  }, [searchVisible]);
  // Runs a beat after the search input's own focus - deliberately AFTER
  // the library's built-in "scroll the focused input above the keyboard"
  // behaviour has had a chance to fire, so this scroll-to-top runs last
  // and actually sticks instead of being immediately undone by it.
  const rescrollToTopOnFocus = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToPosition(0, 0, true);
    }, 80);
  };
  const user = auth().currentUser;
  const focused = useIsFocused();

  useEffect(() => {
    // Fires when navigating AWAY from this screen (focused flips to
    // false) - closing the search bar now, rather than leaving it open,
    // means coming back to Home never re-mounts the autoFocus search
    // TextInput and silently pops the keyboard.
    if (!focused) {
      setSearchVisible(false);
      setSearchQuery('');
    }
  }, [focused]);
  const {groups, loading, refresh, joinGroupById} = useGroups();
  const overview = useGroupsOverview(groups, user?.uid);
  const [spendMode, setSpendMode] = useState<'all' | 'groups' | 'personal'>(
    'all',
  );
  useEffect(() => {
    AsyncStorage.getItem('spendMode').then(saved => {
      if (saved === 'all' || saved === 'groups' || saved === 'personal') {
        setSpendMode(saved);
      }
    });
  }, []);
  useEffect(() => {
    AsyncStorage.setItem('spendMode', spendMode);
  }, [spendMode]);
  // "How much have I spent" totals, bucketed by currency - Groups (share-
  // based, from useGroupsOverview) and Personal (plain sum) never get
  // added across currencies, only within one (see spendTotals.ts).
  const groupSpendByCurrency = overview.myGroupSpendByCurrency;
  const personalSpendByCurrency = overview.myPersonalGroupSpendByCurrency;
  const combinedSpendByCurrency = mergeCurrencyTotals(
    groupSpendByCurrency,
    personalSpendByCurrency,
  );
  const activeSpendByCurrency =
    spendMode === 'groups'
      ? groupSpendByCurrency
      : spendMode === 'personal'
      ? personalSpendByCurrency
      : combinedSpendByCurrency;

  // Separate from spendMode (which only scopes the hero's spend total) -
  // this is its own pill, shown just above the list, so switching what
  // the hero totals up never hides groups the user didn't ask to hide.
  const [listFilter, setListFilter] = useState<'all' | 'group' | 'personal'>(
    'all',
  );

  // Sort/filter panel for "Your groups" - separate from listFilter above
  // (which is its own always-visible All/Groups/Personal pill row): this
  // one is tucked behind a toggle button since it's reached for less
  // often. `sortMode` reorders the list; `monthFilter` narrows it to
  // groups created in one calendar month, or null for every month.
  const [sortFilterVisible, setSortFilterVisible] = useState(false);
  const [sortMode, setSortMode] = useState<
    'default' | 'dateAdded' | 'activity'
  >('default');
  const [monthFilter, setMonthFilter] = useState<string | null>(null); // 'YYYY-MM'
  const sortOrFilterActive = sortMode !== 'default' || monthFilter !== null;

  // Every distinct year-month a group was actually created in, newest
  // first - only real months show up as chips instead of a fixed rolling
  // window that could offer empty ones.
  const availableMonths = React.useMemo(() => {
    const months = new Set<string>();
    groups.forEach(g => {
      if (g.createdAt) {
        months.add(g.createdAt.slice(0, 7));
      }
    });
    return Array.from(months).sort((a, b) => (a < b ? 1 : -1));
  }, [groups]);

  const formatMonthLabel = (yearMonth: string) => {
    const [year, month] = yearMonth.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
      month: 'short',
      year: 'numeric',
    });
  };

  const filteredGroups = (() => {
    const q = searchQuery.trim().toLowerCase();
    let list = groups.filter(g => {
      const isPersonalGroup = g.type === 'personal';
      if (listFilter === 'group' && isPersonalGroup) {
        return false;
      }
      if (listFilter === 'personal' && !isPersonalGroup) {
        return false;
      }
      if (monthFilter && (g.createdAt || '').slice(0, 7) !== monthFilter) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        g.name.toLowerCase().includes(q) || g.joinCode.toLowerCase().includes(q)
      );
    });
    if (sortMode === 'dateAdded') {
      list = [...list].sort((a, b) =>
        (b.createdAt || '').localeCompare(a.createdAt || ''),
      );
    } else if (sortMode === 'activity') {
      list = [...list].sort((a, b) => {
        const ta = overview.lastActivityByGroup[a.id] || a.createdAt || '';
        const tb = overview.lastActivityByGroup[b.id] || b.createdAt || '';
        return tb.localeCompare(ta);
      });
    }
    return list;
  })();

  const route = useRoute<any>();
  const {groupId} = route.params || {};
  // Tracks the last deep-linked groupId this screen actually acted on, so
  // a second link tap for a genuinely NEW group still triggers the join
  // even while Group-Check is already mounted and focused (native-stack
  // updates route.params on the existing screen instance instead of
  // remounting it, so a plain "run once on mount" effect would miss it).
  // This replaces an earlier version keyed on a Zustand boolean flag that
  // React Navigation's own built-in `linking` handling raced against,
  // which is why deep links landing on an already-open Group-Check screen
  // would intermittently do nothing at all.
  const handledGroupIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (groupId && handledGroupIdRef.current !== groupId) {
      handledGroupIdRef.current = groupId;
      handleJoinById(groupId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  useEffect(() => {
    if (focused) {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused]);

  // Fires at most once per app session (not once per screen mount - a
  // user bouncing between several groups shouldn't see this on every
  // single one) so a "Later" tap doesn't turn into a nag loop, while
  // still catching the moment that actually matters: someone opening a
  // group. This is the root fix for settle-up silently falling back to
  // "mark as settled manually" for so many pairs right now - that
  // fallback path was already correct (see Balances.tsx), it just fires
  // far more than it should because so many members never set a UPI ID
  // in the first place. Checked in the background so it can never delay
  // getting into the group.
  const upiPromptShownRef = useRef(false);
  const [upiPromptVisible, setUpiPromptVisible] = useState(false);

  const promptForUpiIfMissing = async (
    currentUser: typeof user,
    groupCurrency?: string,
    groupType?: GroupType,
  ) => {
    // UPI settle-up doesn't apply outside India - nudging someone to add
    // a UPI ID right after they open a EUR/USD/... group would be asking
    // for something that group can never actually use. Same reasoning
    // rules out a Personal list too - it's "just you" everywhere else in
    // the app, so there's no one to ever pay via UPI there.
    if (
      !currentUser ||
      upiPromptShownRef.current ||
      !isUpiCurrency(groupCurrency) ||
      groupType === 'personal'
    ) {
      return;
    }
    try {
      const doc = await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .get();
      const hasUpiId = !!(doc.exists && doc.data()?.upiId);
      if (hasUpiId) {
        return;
      }
      upiPromptShownRef.current = true;
      setUpiPromptVisible(true);
    } catch {
      // Best-effort nudge only - a failed check shouldn't block entry to
      // the group or alarm the user with an error they can't act on.
    }
  };

  const enterGroup = async (
    groupKey: string,
    groupCurrency?: string,
    groupType?: GroupType,
  ) => {
    setGroupKey(groupKey);
    await AsyncStorage.setItem('groupKey', groupKey);
    await AsyncStorage.setItem('lastJoinedGroup', groupKey);
    haptics.success();
    navigation.navigate('Home');
    promptForUpiIfMissing(user, groupCurrency, groupType);
  };

  const handleJoinById = async (id: string) => {
    if (!user) {
      return;
    }
    setLoader(true);
    try {
      const {group, alreadyMember, requestPending} = await joinGroupById(id);
      if (alreadyMember) {
        // Unchanged: an old invite link or a repeat deep link into a
        // group you're already in still drops you straight back inside.
        await enterGroup(group.id, group.currency, group.type);
      } else if (requestPending) {
        // New members now need the admin's OK first (see joinGroup() in
        // firestoreLedger.ts) - the same rule this deep-link path used to
        // skip past instantly. Stay on the groups list and let them know
        // what's pending instead of opening a group they're not in yet.
        Toast.show({
          type: 'success',
          text1: 'Request sent',
          text2: `The admin of "${group.name}" needs to approve you before you can join.`,
        });
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not join group',
        text2: error?.message,
      });
    } finally {
      setLoader(false);
    }
  };

  const handleLeaveGroup = (leaveGroupId: string) => {
    // Same "settle up first" guard as the in-group Profile screen's leave
    // action, but computed from the groups-list overview so a user can
    // leave a cluttering group without having to enter it first - this is
    // the low-risk declutter option (vs. a full destructive admin
    // "delete group", which would need recursive Firestore subcollection
    // cleanup and its own confirmation flow).
    if (!user) {
      return;
    }
    // CRITICAL: overview.perGroupBalance is filled in by a one-time fetch
    // that takes a beat after the group list itself renders (right after
    // app launch especially). Right in that window, this group's entry
    // simply isn't in the map yet - `balance != null` was treating
    // "unknown" the same as "zero", which let someone swipe-leave with a
    // real, unsettled debt as long as they were fast enough to act before
    // the balance had loaded. Block instead of guessing whenever we don't
    // yet have a real answer.
    if (overview.loading || !(leaveGroupId in overview.perGroupBalance)) {
      Toast.show({
        type: 'info',
        text1: 'Still checking your balance',
        text2: 'Give it a second, then try again.',
      });
      return;
    }
    const balance = overview.perGroupBalance[leaveGroupId];
    if (Math.abs(balance) > 0.01) {
      const leaveGroupCurrency = groups.find(
        g => g.id === leaveGroupId,
      )?.currency;
      Toast.show({
        type: 'error',
        text1: 'Settle up first',
        text2: `You still have an open balance of ${formatMoney(
          Math.abs(balance),
          leaveGroupCurrency,
        )} in this group.`,
      });
      return;
    }
    // This is reached by a swipe gesture, which is easier to trigger by
    // accident than a deliberate button tap (the Profile screen's leave
    // button) - a confirmation matters more here, not less.
    const groupName =
      groups.find(g => g.id === leaveGroupId)?.name || 'this group';
    AppAlert.alert(
      'Leave this group?',
      `You'll need the join code or a new invite to get back into "${groupName}".`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveGroup(leaveGroupId, user.uid);
              if (leaveGroupId === currentGroupKey) {
                setGroupKey(null);
              }
              haptics.tap();
              Toast.show({type: 'success', text1: 'Left group'});
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Could not leave group',
                text2: error?.message,
              });
            }
          },
        },
      ],
    );
  };

  // --- Dashboard stat helpers (see PositionRing + quick-stat tiles below) ---
  // "Settled" only counts a group once its balance has actually loaded
  // (g.id in overview.perGroupBalance) - otherwise a group would flash as
  // "settled" for a moment right after app launch, before its real
  // balance has been fetched.
  const realGroups = groups.filter(g => g.type !== 'personal');
  const balanceKnownGroups = realGroups.filter(
    g => g.id in overview.perGroupBalance,
  );
  const settledGroupsCount = balanceKnownGroups.filter(
    g => Math.abs(overview.perGroupBalance[g.id]) <= 0.01,
  ).length;
  const owedGroupsCount = balanceKnownGroups.filter(
    g => overview.perGroupBalance[g.id] > 0.01,
  ).length;
  const oweGroupsCount = balanceKnownGroups.filter(
    g => overview.perGroupBalance[g.id] < -0.01,
  ).length;
  const settledFraction =
    realGroups.length > 0 ? settledGroupsCount / realGroups.length : 0;

  // The hero card's own owed/owe figure and ring are a GROUP concept -
  // personal expenses are never shared, so they never create a debt.
  // That means "All" and "Groups" are genuinely the same real numbers
  // (there's no separate group-only debt hiding inside "All"), and only
  // "Personal" is a genuinely different scope: no owed/owe, so it shows
  // this period's personal spend instead, honestly labeled as such
  // rather than pretending there's a settle percentage for it.
  const heroIsPersonal = spendMode === 'personal';
  const heroYouAreOwed = overview.totalOwedToYou >= overview.totalYouOwe;
  const heroColor = heroYouAreOwed ? theme.color.greenBright : theme.color.rose;
  const heroRingColor = heroYouAreOwed ? theme.color.green : theme.color.rose;
  const personalSpendPrimary =
    personalSpendByCurrency[overview.primaryCurrency] || 0;
  // Counts up from 0 to the real figure whenever it changes (initial
  // load, or the All/Groups/Personal toggle swapping the hero amount) -
  // was a hard jump straight to the final number before.
  const heroAmountTarget = heroIsPersonal
    ? personalSpendPrimary
    : Math.abs(overview.totalOwedToYou - overview.totalYouOwe);
  const heroAmountAnimated = useCountUp(heroAmountTarget, 650);

  // Floating pill that slides between All/Groups/Personal instead of the
  // active segment's background just snapping on - see heroToggleRow.
  const [toggleWidth, setToggleWidth] = useState(0);
  const TOGGLE_PADDING = 3;
  const spendModeIndex =
    spendMode === 'all' ? 0 : spendMode === 'groups' ? 1 : 2;
  const toggleIndicatorX = useSharedValue(0);
  useEffect(() => {
    if (toggleWidth > 0) {
      const segWidth = (toggleWidth - TOGGLE_PADDING * 2) / 3;
      toggleIndicatorX.value = withSpring(spendModeIndex * segWidth, {
        damping: 18,
        stiffness: 180,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spendModeIndex, toggleWidth]);
  const toggleIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{translateX: toggleIndicatorX.value}],
  }));

  // Collapsible "shutter" for the quick-stats tiles - collapsed by default,
  // tap the header to open. A tap-to-expand toggle was chosen over a raw
  // swipe/pan gesture so it can't fight the outer ScrollView's vertical
  // scroll. The visible tiles live in an overflow:hidden wrapper whose
  // height/opacity animate between 0 and the tiles' natural height. That
  // natural height comes from a SEPARATE, hidden, position:absolute copy
  // of the same tiles (see quickStatTiles + statsMeasurer below) measured
  // via onLayout - measuring the visible copy directly doesn't work
  // reliably, since a flex child can still get compressed by an ancestor
  // whose height is explicitly animating toward 0, which silently locked
  // the measured height at ~0 and made the shutter open to nothing.
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [statsMeasuredHeight, setStatsMeasuredHeight] = useState(0);
  const statsContentHeight = useSharedValue(0);
  const statsOpenProgress = useSharedValue(0);
  useEffect(() => {
    statsOpenProgress.value = withTiming(statsExpanded ? 1 : 0, {
      duration: 280,
    });
  }, [statsExpanded, statsOpenProgress]);
  const handleStatsLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && Math.abs(h - statsMeasuredHeight) > 0.5) {
      setStatsMeasuredHeight(h);
      statsContentHeight.value = h;
    }
  };
  const statsCollapseStyle = useAnimatedStyle(() => ({
    height: statsContentHeight.value * statsOpenProgress.value,
    opacity: statsOpenProgress.value,
  }));
  const statsChevronStyle = useAnimatedStyle(() => ({
    transform: [{rotate: `${statsOpenProgress.value * 180}deg`}],
  }));

  // Rendered twice below: once in a hidden measurer, once in the visible
  // animated shutter. Kept as one JSX value so the two copies can never
  // drift out of sync.
  const quickStatTiles = (
    <>
      <View style={styles.quickStatTile}>
        <View style={[styles.quickStatIcon, styles.quickStatIconGreen]}>
          <ArrowDown size={15} color={theme.color.green} />
        </View>
        <Text style={styles.quickStatValue}>
          {formatMoney(overview.totalOwedToYou, overview.primaryCurrency)}
        </Text>
        <Text style={styles.quickStatLabel}>Owed to you</Text>
        <Text style={styles.quickStatHint}>
          {overview.totalOwedToYou > 0.01
            ? `▲ across ${owedGroupsCount} group${
                owedGroupsCount === 1 ? '' : 's'
              }`
            : '— no open credit'}
        </Text>
      </View>
      <View style={styles.quickStatTile}>
        <View style={[styles.quickStatIcon, styles.quickStatIconRose]}>
          <ArrowUp size={15} color={theme.color.rose} />
        </View>
        <Text style={styles.quickStatValue}>
          {formatMoney(overview.totalYouOwe, overview.primaryCurrency)}
        </Text>
        <Text style={styles.quickStatLabel}>You owe</Text>
        <Text style={styles.quickStatHint}>
          {overview.totalYouOwe > 0.01
            ? `▲ across ${oweGroupsCount} group${
                oweGroupsCount === 1 ? '' : 's'
              }`
            : '— all clear'}
        </Text>
      </View>
      <View style={styles.quickStatTile}>
        <View style={[styles.quickStatIcon, styles.quickStatIconBlue]}>
          <Sigma size={15} color={theme.color.teal} />
        </View>
        <Text style={styles.quickStatValue}>
          {formatMoney(
            activeSpendByCurrency[overview.primaryCurrency] || 0,
            overview.primaryCurrency,
          )}
        </Text>
        <Text style={styles.quickStatLabel}>Total spent</Text>
        <Text style={styles.quickStatHint}>
          {spendMode === 'all'
            ? 'groups + personal'
            : spendMode === 'groups'
            ? 'groups only'
            : 'personal only'}
        </Text>
      </View>
      <View style={styles.quickStatTile}>
        <View style={[styles.quickStatIcon, styles.quickStatIconAmber]}>
          <Clock size={15} color={theme.color.amber} />
        </View>
        <Text style={styles.quickStatValue}>{groups.length} active</Text>
        <Text style={styles.quickStatLabel}>Groups</Text>
        <Text style={styles.quickStatHint}>
          {settledGroupsCount > 0
            ? `▼ ${settledGroupsCount} settled up`
            : `${groups.length} group${groups.length === 1 ? '' : 's'}`}
        </Text>
      </View>
    </>
  );

  return (
    <View style={styles.flex}>
      <Header />
      <KeyboardAwareScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        enableOnAndroid
        extraScrollHeight={20}
        keyboardShouldPersistTaps="handled">
        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {groups.length > 0 && (
              <GlassCard style={styles.heroCard}>
                <GradientView
                  colors={theme.gradient.heroDark}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.heroTopRow}>
                  <Text style={styles.heroKicker}>YOUR POSITION</Text>
                  <View style={styles.heroModePill}>
                    <Text style={styles.heroModePillText}>
                      All groups + personal
                    </Text>
                  </View>
                </View>

                <View style={styles.heroMainRow}>
                  <PositionRing
                    settledFraction={settledFraction}
                    color={heroRingColor}
                    indeterminate={heroIsPersonal}
                    indeterminateLabel="no split"
                  />
                  <View style={styles.heroAmountCol}>
                    <Text
                      style={[
                        styles.heroAmount,
                        {
                          color: heroIsPersonal
                            ? theme.color.blueBright
                            : heroColor,
                        },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit>
                      {formatMoney(
                        heroAmountAnimated,
                        overview.primaryCurrency,
                      )}
                    </Text>
                    <Text style={styles.heroAmountCaption}>
                      {heroIsPersonal
                        ? 'logged this month, no split'
                        : heroYouAreOwed
                        ? "you're owed, across everything"
                        : 'you owe, across everything'}
                    </Text>
                    {!heroIsPersonal &&
                      Object.entries(overview.totalsByCurrency)
                        .filter(([code]) => code !== overview.primaryCurrency)
                        .map(([code, totals]) => (
                          <Text
                            key={code}
                            style={styles.legendOtherCurrencyOnHero}>
                            + {formatMoney(totals.owedToYou, code)} owed ·{' '}
                            {formatMoney(totals.youOwe, code)} owing ({code})
                          </Text>
                        ))}
                  </View>
                </View>

                {/* All/Groups genuinely show the same numbers above - a
                debt only ever exists at the group level, so there's no
                separate "groups-only" balance hiding inside "all". Only
                Personal is a real scope change: no debt concept applies,
                so the ring/amount swap to this period's personal spend
                (see heroIsPersonal above) instead of pretending there's a
                settle percentage for money that was never split. Below,
                the toggle keeps scoping the "Total spent" quick-stat tile
                too, in whichever way that stat's own scope reads. */}
                <View
                  style={styles.heroToggleRow}
                  onLayout={e => setToggleWidth(e.nativeEvent.layout.width)}>
                  {toggleWidth > 0 && (
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.heroToggleIndicator,
                        {
                          width: (toggleWidth - TOGGLE_PADDING * 2) / 3,
                        },
                        toggleIndicatorStyle,
                      ]}>
                      <GradientView
                        colors={theme.gradient.fab}
                        style={StyleSheet.absoluteFillObject}
                      />
                    </Animated.View>
                  )}
                  {(['all', 'groups', 'personal'] as const).map(mode => (
                    <TouchableOpacity
                      key={mode}
                      style={styles.heroToggleSeg}
                      activeOpacity={0.85}
                      onPress={() => setSpendMode(mode)}>
                      <Text
                        style={[
                          styles.heroToggleText,
                          spendMode === mode && styles.heroToggleTextActive,
                        ]}>
                        {mode === 'all'
                          ? 'All'
                          : mode === 'groups'
                          ? 'Groups'
                          : 'Personal'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </GlassCard>
            )}

            {groups.length > 0 && (
              <View>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.statsHeaderRow}
                  onPress={() => setStatsExpanded(v => !v)}>
                  <Text style={styles.statsHeaderTitle}>Quick stats</Text>
                  <View style={styles.statsHeaderRight}>
                    <Text style={styles.statsHeaderHint}>
                      {statsExpanded ? 'Hide' : 'Show'}
                    </Text>
                    <Animated.View style={statsChevronStyle}>
                      <ChevronDown size={16} color={theme.color.inkFaint} />
                    </Animated.View>
                  </View>
                </TouchableOpacity>
                {/*
                  Hidden, absolutely-positioned duplicate of the tiles used
                  purely to measure their natural height via onLayout.
                  Deliberately NOT inside the animated/overflow:hidden
                  wrapper below: a flex child's reported layout can still
                  get compressed by an ancestor with an explicit small/zero
                  height even with flexShrink:0 in some cases, which was
                  silently locking the measured height at ~0 and making the
                  "shutter" open animation reveal nothing. Position:absolute
                  takes this copy fully out of that flow so it always lays
                  out (and measures) at its true intrinsic size.
                */}
                <View
                  style={styles.statsMeasurer}
                  pointerEvents="none"
                  importantForAccessibility="no-hide-descendants"
                  onLayout={handleStatsLayout}>
                  <View style={styles.quickStatsGrid}>{quickStatTiles}</View>
                </View>
                <Animated.View
                  style={[styles.statsCollapseWrap, statsCollapseStyle]}>
                  <View style={styles.quickStatsGrid}>{quickStatTiles}</View>
                </Animated.View>
              </View>
            )}

            <View style={styles.groupsHeaderRow}>
              <Text style={styles.title}>Your groups</Text>
              <View style={styles.groupsHeaderActions}>
                {groups.length > 0 && (
                  <TouchableOpacity
                    style={[
                      styles.addGroupBtn,
                      sortOrFilterActive && styles.addGroupBtnActive,
                    ]}
                    hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                    onPress={() => setSortFilterVisible(v => !v)}>
                    <SlidersHorizontal
                      size={16}
                      color={
                        sortOrFilterActive
                          ? theme.color.blueBright
                          : theme.color.ink
                      }
                    />
                  </TouchableOpacity>
                )}
                {groups.length > 0 && (
                  <TouchableOpacity
                    style={styles.addGroupBtn}
                    hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                    onPress={() => {
                      setSearchVisible(v => !v);
                      if (searchVisible) {
                        setSearchQuery('');
                      }
                    }}>
                    {searchVisible ? (
                      <X size={17} color={theme.color.ink} />
                    ) : (
                      <Search size={17} color={theme.color.ink} />
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.addGroupBtn}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                  onPress={() => navigation.navigate('CreateJoinGroup')}>
                  <Plus size={18} color={theme.color.ink} />
                </TouchableOpacity>
              </View>
            </View>

            {groups.length > 0 && searchVisible && (
              <View style={styles.searchWrap}>
                <Search size={16} color={theme.color.inkFaint} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search your groups"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor={theme.color.inkFaint}
                  autoFocus
                  onFocus={rescrollToTopOnFocus}
                />
              </View>
            )}

            {groups.length > 0 && (
              <View style={styles.listFilterRow}>
                {(['all', 'group', 'personal'] as const).map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[
                      styles.listFilterPill,
                      listFilter === f && styles.listFilterPillActive,
                    ]}
                    onPress={() => setListFilter(f)}>
                    <Text
                      style={[
                        styles.listFilterText,
                        listFilter === f && styles.listFilterTextActive,
                      ]}>
                      {f === 'all'
                        ? 'All'
                        : f === 'group'
                        ? 'Groups'
                        : 'Personal'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {groups.length > 0 && sortFilterVisible && (
              <View style={styles.sortFilterBlock}>
                <Text style={styles.sortFilterLabel}>Sort by</Text>
                <View style={styles.sortFilterRow}>
                  <Chip
                    label="Default"
                    active={sortMode === 'default'}
                    onPress={() => setSortMode('default')}
                  />
                  <Chip
                    label="Date added"
                    active={sortMode === 'dateAdded'}
                    onPress={() => setSortMode('dateAdded')}
                  />
                  <Chip
                    label="Activity"
                    active={sortMode === 'activity'}
                    onPress={() => setSortMode('activity')}
                  />
                </View>
                {availableMonths.length > 0 && (
                  <>
                    <Text style={styles.sortFilterLabel}>Month</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.sortFilterRow}>
                      <Chip
                        label="All"
                        active={monthFilter === null}
                        onPress={() => setMonthFilter(null)}
                      />
                      {availableMonths.map(ym => (
                        <Chip
                          key={ym}
                          label={formatMonthLabel(ym)}
                          active={monthFilter === ym}
                          onPress={() =>
                            setMonthFilter(monthFilter === ym ? null : ym)
                          }
                        />
                      ))}
                    </ScrollView>
                  </>
                )}
              </View>
            )}

            {groups.length > 0 && (
              <Text style={styles.hintText}>
                Tap a group to open it, swipe left to leave one.
              </Text>
            )}

            {!loading && groups.length === 0 && (
              <GlassCard style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  You haven't joined any groups yet.
                </Text>
              </GlassCard>
            )}

            {!loading && groups.length > 0 && filteredGroups.length === 0 && (
              <Text style={styles.emptyText}>
                No groups match "{searchQuery}".
              </Text>
            )}

            {filteredGroups.map(g => (
              <SwipeableRow
                key={g.id}
                actionLabel="Leave"
                actionColor={theme.color.rose}
                onAction={() => handleLeaveGroup(g.id)}>
                <TouchableOpacity
                  onPress={() => enterGroup(g.id, g.currency, g.type)}
                  activeOpacity={0.85}>
                  <GlassCard
                    style={StyleSheet.flatten([
                      styles.groupCard,
                      g.id === currentGroupKey && styles.groupCardActive,
                    ])}>
                    <View
                      style={[
                        styles.groupAvatar,
                        {backgroundColor: avatarColorForId(g.id)},
                      ]}>
                      <Text style={styles.groupAvatarLetter}>
                        {(g.name || '?').trim().charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{flex: 1}}>
                      <View style={styles.groupNameRow}>
                        <Text style={styles.groupName}>{g.name}</Text>
                        {g.type === 'personal' && (
                          <View style={styles.personalTag}>
                            <Text style={styles.personalTagText}>Personal</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.groupMeta}>
                        {g.type === 'personal'
                          ? 'Just you - nothing to split'
                          : `Code: ${g.joinCode} · ${
                              g.memberIds.length
                            } member${g.memberIds.length === 1 ? '' : 's'}`}
                        {g.createdAt &&
                          ` · Created ${new Date(
                            g.createdAt,
                          ).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}`}
                      </Text>
                      {overview.perGroupBalance[g.id] != null &&
                        Math.abs(overview.perGroupBalance[g.id]) > 0.01 && (
                          <Text
                            style={[
                              styles.groupBalance,
                              {
                                color:
                                  overview.perGroupBalance[g.id] >= 0
                                    ? theme.color.green
                                    : theme.color.rose,
                              },
                            ]}>
                            {overview.perGroupBalance[g.id] >= 0
                              ? "You're owed "
                              : 'You owe '}
                            {formatMoney(
                              Math.abs(overview.perGroupBalance[g.id]),
                              g.currency,
                            )}
                          </Text>
                        )}
                    </View>
                    <ChevronRight size={18} color={theme.color.inkFaint} />
                  </GlassCard>
                </TouchableOpacity>
              </SwipeableRow>
            ))}
          </>
        )}
      </KeyboardAwareScrollView>

      <UpiPromptModal
        visible={upiPromptVisible}
        uid={user?.uid || ''}
        onSkip={() => setUpiPromptVisible(false)}
        onSaved={() => setUpiPromptVisible(false)}
      />
      {loader && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator color={theme.color.blue} size="large" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1, backgroundColor: theme.color.ground},
  content: {paddingHorizontal: 18, paddingTop: 8, paddingBottom: 60},
  title: {
    color: theme.color.ink,
    ...Typography.title,
  },
  subtitle: {
    color: theme.color.inkSoft,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(13.5),
    marginTop: 4,
    marginBottom: 18,
  },
  emptyCard: {marginBottom: 12},
  emptyText: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(13.5),
    textAlign: 'center',
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  groupAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupAvatarLetter: {
    color: theme.color.onAccent,
    ...Typography.subtitle,
  },
  groupCardActive: {borderColor: theme.color.blue, borderWidth: 1.5},
  groupNameRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  groupName: {
    color: theme.color.ink,
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(15.5),
    fontWeight: '700',
  },
  personalTag: {
    backgroundColor: theme.color.blueBright + '26',
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  personalTagText: {
    color: theme.color.blueBright,
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(10.5),
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  listFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  listFilterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  listFilterPillActive: {
    backgroundColor: theme.color.blue,
    borderColor: theme.color.blue,
  },
  listFilterText: {
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(12.5),
    fontWeight: '700',
    color: theme.color.inkFaint,
  },
  listFilterTextActive: {color: theme.color.ink},
  hintText: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(11.5),
    marginTop: 8,
    marginBottom: 4,
  },
  groupMeta: {
    color: theme.color.inkFaint,
    fontSize: moderateScale(12),
    marginTop: 3,
    fontFamily: MonoFont,
  },
  groupBalance: {
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(12.5),
    fontWeight: '700',
    marginTop: 6,
  },
  heroCard: {
    marginTop: 14,
    marginBottom: 16,
    paddingTop: 22,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderRadius: theme.radius.xl,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heroKicker: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(11.5),
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  heroModePill: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  heroModePillText: {
    color: 'rgba(255,255,255,0.85)',
    fontFamily: BodyFont.semibold,
    fontSize: moderateScale(11),
    fontWeight: '600',
  },
  heroMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  heroAmountCol: {flex: 1, minWidth: 0},
  heroAmount: {
    ...Typography.display,
    color: theme.color.rose,
  },
  heroAmountCaption: {
    color: 'rgba(255,255,255,0.82)',
    ...Typography.body,
    marginTop: 2,
  },
  legendOtherCurrencyOnHero: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(11.5),
    marginTop: 8,
  },
  heroToggleRow: {
    flexDirection: 'row',
    marginTop: 18,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 3,
  },
  heroToggleIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },
  heroToggleSeg: {
    flex: 1,
    borderRadius: theme.radius.pill,
    paddingVertical: 8,
    alignItems: 'center',
  },
  heroToggleText: {
    color: 'rgba(255,255,255,0.65)',
    ...Typography.bodySemibold,
  },
  heroToggleTextActive: {color: theme.color.onAccent},
  statsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  statsHeaderTitle: {
    color: theme.color.inkSoft,
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(10.5),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statsHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statsHeaderHint: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(11.5),
  },
  statsCollapseWrap: {
    overflow: 'hidden',
  },
  statsMeasurer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    opacity: 0,
  },
  quickStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flexShrink: 0,
    gap: 10,
    marginBottom: 14,
  },
  quickStatTile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: theme.color.groundAlt,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.lg,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  quickStatIcon: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickStatIconGreen: {backgroundColor: 'rgba(62,207,142,0.16)'},
  quickStatIconRose: {backgroundColor: 'rgba(240,129,156,0.16)'},
  quickStatIconBlue: {backgroundColor: 'rgba(56,217,201,0.16)'},
  quickStatIconAmber: {backgroundColor: 'rgba(240,185,77,0.16)'},
  quickStatValue: {
    color: theme.color.ink,
    ...Typography.title,
  },
  quickStatLabel: {
    color: theme.color.inkSoft,
    ...Typography.body,
    marginTop: 2,
  },
  quickStatHint: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(11.5),
    marginTop: 6,
  },
  groupsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  groupsHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addGroupBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.groundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addGroupBtnActive: {borderColor: theme.color.blueBright},
  sortFilterBlock: {marginTop: 10, marginBottom: 2},
  sortFilterLabel: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(10.5),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 8,
  },
  sortFilterRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    marginTop: 22,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    color: theme.color.ink,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(14.5),
    paddingVertical: 12,
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,5,12,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default GroupManagement;
