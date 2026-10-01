// src/screens/AfterLogin/Groups.tsx
// The "Groups" tab of the outer Home/Groups/Settings bar (AppBottomBar) -
// the full searchable/sortable/filterable list of every group you're in.
// This is the search+sort+filter+list section that used to live inline on
// GroupCheck.tsx's dashboard; GroupCheck now shows only a trimmed preview
// (its 5 most recently active groups) with a "See All" link into this
// screen, so the full list has its own dedicated, less crowded home.
//
// Deliberately reuses useGroups()/useGroupsOverview()/useEnterGroup() -
// the exact same hooks GroupCheck (and SwitchGroupSheet) use - so "which
// groups do I have" and "what's my balance in each" can never drift
// between the dashboard preview and this full list.

import auth from '@react-native-firebase/auth';
import {useIsFocused} from '@react-navigation/native';
import React, {useEffect, useRef, useState} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {ChevronRight, Search, SlidersHorizontal, X} from 'lucide-react-native';
import Toast from '../../services/toast';
import Chip from '../../component/glass/Chip';
import AppAlert from '../../services/appAlert';
import GroupsListSkeleton from '../../component/glass/GroupsListSkeleton';
import AddGroupFab, {ADD_GROUP_FAB_HEIGHT} from '../../component/AddGroupFab';
import GlassCard from '../../component/glass/GlassCard';
import SwipeableRow from '../../component/glass/SwipeableRow';
import Header from '../../component/header';
import AppBottomBar, {
  useAppBottomBarHeight,
} from '../../navigator/AppBottomBar';
import {useGroups} from '../../hooks/useGroups';
import {useGroupsOverview} from '../../hooks/useGroupsOverview';
import {useEnterGroup} from '../../hooks/useEnterGroup';
import {leaveGroup} from '../../services/ledger/firestoreLedger';
import {formatMoney} from '../../services/ledger/currency';
import UpiPromptModal from '../../component/UpiPromptModal';
import {useExpenseState} from '../../store/useExpenseStore';
import {haptics} from '../../utils/haptics';
import theme from '../../utils/theme';
import {BodyFont, MonoFont, Typography, moderateScale} from '../../utils/fonts';

// Same deterministic accent-color-per-id scheme as GroupCheck's group
// list - duplicated rather than shared (see AppBottomBar.tsx's own
// comment on why these small per-screen constants are copied instead of
// pulled into a shared module: it keeps one screen's tuning from quietly
// drifting into another's).
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

const GroupsScreen = ({navigation}: any) => {
  const setGroupKey = useExpenseState(state => state.setGroupKey);
  const currentGroupKey = useExpenseState(state => state.groupKey);
  const {enterGroup, upiPromptVisible, dismissUpiPrompt} =
    useEnterGroup(navigation);
  const barHeight = useAppBottomBarHeight();
  const user = auth().currentUser;
  const focused = useIsFocused();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  // Same "snap back to top the moment search opens" fix as GroupCheck's
  // own list - see that screen's identical comment for why.
  const scrollRef = useRef<any>(null);
  useEffect(() => {
    if (searchVisible) {
      scrollRef.current?.scrollToPosition(0, 0, true);
    }
  }, [searchVisible]);
  const rescrollToTopOnFocus = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToPosition(0, 0, true);
    }, 80);
  };

  useEffect(() => {
    // Closing search on nav-away (not just on unmount) means coming back
    // to this tab never re-mounts the autoFocus search TextInput and
    // silently pops the keyboard - identical reasoning to GroupCheck.
    if (!focused) {
      setSearchVisible(false);
      setSearchQuery('');
    }
  }, [focused]);

  const {groups, loading, refresh, removeGroupLocally} = useGroups();
  const overview = useGroupsOverview(groups, user?.uid);

  useEffect(() => {
    if (focused) {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused]);

  const [listFilter, setListFilter] = useState<'all' | 'group' | 'personal'>(
    'all',
  );

  const [sortFilterVisible, setSortFilterVisible] = useState(false);
  const [sortMode, setSortMode] = useState<
    'default' | 'dateAdded' | 'activity'
  >('default');
  const [monthFilter, setMonthFilter] = useState<string | null>(null); // 'YYYY-MM'
  const sortOrFilterActive = sortMode !== 'default' || monthFilter !== null;

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

  const handleLeaveGroup = (leaveGroupId: string) => {
    // Same "settle up first" guard as GroupCheck's own swipe-to-leave -
    // see that screen's identical comment for the full reasoning on why
    // this blocks rather than guesses while a balance is still loading.
    if (!user) {
      return;
    }
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
              removeGroupLocally(leaveGroupId);
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

  return (
    <View style={styles.flex}>
      <Header />
      <KeyboardAwareScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          {paddingBottom: barHeight + ADD_GROUP_FAB_HEIGHT + 24},
        ]}
        enableOnAndroid
        extraScrollHeight={20}
        keyboardShouldPersistTaps="handled">
        {loading ? (
          <GroupsListSkeleton />
        ) : (
          <>
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
        <View style={{height: barHeight + ADD_GROUP_FAB_HEIGHT + 24}} />
      </KeyboardAwareScrollView>

      <AppBottomBar active="groups" />

      <AddGroupFab
        bottom={barHeight + 24}
        onPress={() => navigation.navigate('CreateJoinGroup')}
      />

      <UpiPromptModal
        visible={upiPromptVisible}
        uid={user?.uid || ''}
        onSkip={dismissUpiPrompt}
        onSaved={dismissUpiPrompt}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1, backgroundColor: theme.color.ground},
  content: {paddingHorizontal: 18, paddingTop: 8},
  title: {
    color: theme.color.ink,
    ...Typography.title,
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
});

export default GroupsScreen;
