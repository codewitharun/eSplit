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
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {ChevronRight, Search} from 'lucide-react-native';
import Toast from '../../services/toast';
import AppAlert from '../../services/appAlert';
import BalanceDonut from '../../component/glass/BalanceDonut';
import GlassCard from '../../component/glass/GlassCard';
import GradientMesh from '../../component/glass/GradientMesh';
import SwipeableRow from '../../component/glass/SwipeableRow';
import GroupNameModal from '../../component/groupNameModal';
import Header from '../../component/header';
import {useGroups} from '../../hooks/useGroups';
import {useGroupsOverview} from '../../hooks/useGroupsOverview';
import {leaveGroup} from '../../services/ledger/firestoreLedger';
import UpiPromptModal from '../../component/UpiPromptModal';
import {useExpenseState} from '../../store/useExpenseStore';
import {haptics} from '../../utils/haptics';
import theme from '../../utils/theme';

const GroupManagement = ({navigation}: any) => {
  const setGroupKey = useExpenseState(state => state.setGroupKey);
  const currentGroupKey = useExpenseState(state => state.groupKey);
  const [loader, setLoader] = useState(false);
  const [groupNameModal, setGroupNameModal] = useState(false);
  // Separate from `loader` (which also covers join-by-id/join-by-code and
  // drives the full-screen overlay) so the modal gets its own precise
  // loading signal - `loader` is a native RN Modal, rendered on a separate
  // top-level surface above everything else, so the full-screen overlay
  // was invisible behind it while the modal was open. Without visible
  // feedback inside the modal itself, a user could tap "Create" again
  // before the first request finished.
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const user = auth().currentUser;
  const focused = useIsFocused();
  const {
    groups,
    loading,
    refresh,
    createGroup,
    joinGroupByCode,
    joinGroupById,
  } = useGroups();
  const overview = useGroupsOverview(groups, user?.uid);

  const filteredGroups = (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return groups;
    }
    return groups.filter(
      g =>
        g.name.toLowerCase().includes(q) ||
        g.joinCode.toLowerCase().includes(q),
    );
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

  const promptForUpiIfMissing = async (currentUser: typeof user) => {
    if (!currentUser || upiPromptShownRef.current) {
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

  const enterGroup = async (groupKey: string) => {
    setGroupKey(groupKey);
    await AsyncStorage.setItem('groupKey', groupKey);
    await AsyncStorage.setItem('lastJoinedGroup', groupKey);
    haptics.success();
    navigation.navigate('Home');
    promptForUpiIfMissing(user);
  };

  const handleJoinById = async (id: string) => {
    if (!user) {
      return;
    }
    setLoader(true);
    try {
      const {group} = await joinGroupById(id);
      await enterGroup(group.id);
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

  const handleJoinByCode = async () => {
    if (!joinCodeInput.trim()) {
      Toast.show({
        type: 'info',
        text1: 'Enter a join code',
        text2: 'Ask a group member for their 6-character code.',
      });
      return;
    }
    setLoader(true);
    try {
      const {group} = await joinGroupByCode(joinCodeInput.trim());
      setJoinCodeInput('');
      await enterGroup(group.id);
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
      Toast.show({
        type: 'error',
        text1: 'Settle up first',
        text2: `You still have an open balance of ₹${Math.abs(balance).toFixed(
          2,
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

  const handleCreateGroup = async (groupName: string) => {
    if (creatingGroup) {
      return;
    }
    setCreatingGroup(true);
    setLoader(true);
    try {
      const group = await createGroup(groupName);
      setGroupNameModal(false);
      Toast.show({
        type: 'success',
        text1: 'Group created',
        text2: `Join code: ${group.joinCode}`,
      });
      await enterGroup(group.id);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not create group',
        text2: error?.message,
      });
    } finally {
      setLoader(false);
      setCreatingGroup(false);
    }
  };

  return (
    <View style={styles.flex}>
      <GradientMesh />
      <Header />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        enableOnAndroid
        extraScrollHeight={20}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Overview</Text>
        <Text style={styles.subtitle}>
          What you owe and what's owed to you, across every group.
        </Text>

        {groups.length > 0 && (
          <GlassCard style={styles.dashboardCard}>
            <BalanceDonut
              owed={overview.totalOwedToYou}
              owe={overview.totalYouOwe}
            />
            <View style={styles.legendCol}>
              <View style={styles.legendRow}>
                <View
                  style={[
                    styles.legendDot,
                    {backgroundColor: theme.color.green},
                  ]}
                />
                <View>
                  <Text style={styles.legendLabel}>Owed to you</Text>
                  <Text
                    style={[styles.legendAmount, {color: theme.color.green}]}>
                    ₹{overview.totalOwedToYou.toFixed(2)}
                  </Text>
                </View>
              </View>
              <View style={styles.legendRow}>
                <View
                  style={[
                    styles.legendDot,
                    {backgroundColor: theme.color.rose},
                  ]}
                />
                <View>
                  <Text style={styles.legendLabel}>You owe</Text>
                  <Text
                    style={[styles.legendAmount, {color: theme.color.rose}]}>
                    ₹{overview.totalYouOwe.toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          </GlassCard>
        )}

        <Text style={[styles.title, {marginTop: 8}]}>Your groups</Text>
        <Text style={styles.subtitle}>
          Tap one to jump in, search to find one, or join / create below.
        </Text>

        <Text style={styles.sectionLabel}>Join with a code</Text>
        <GlassCard style={styles.joinCard}>
          <TextInput
            style={styles.joinInput}
            placeholder="e.g. 7K3PXQ"
            value={joinCodeInput}
            autoCapitalize="characters"
            onChangeText={t => setJoinCodeInput(t.toUpperCase())}
            placeholderTextColor={theme.color.inkFaint}
          />
          <TouchableOpacity style={styles.joinBtn} onPress={handleJoinByCode}>
            <Text style={styles.joinBtnText}>Join</Text>
          </TouchableOpacity>
        </GlassCard>

        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setGroupNameModal(true)}>
          <Text style={styles.createBtnText}>+ Create a new group</Text>
        </TouchableOpacity>

        {groups.length > 0 && (
          <View style={styles.searchWrap}>
            <Search size={16} color={theme.color.inkFaint} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search your groups"
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={theme.color.inkFaint}
            />
          </View>
        )}

        {groups.length > 0 && (
          <Text style={styles.hintText}>
            Tap a group to open it, swipe left to leave one.
          </Text>
        )}

        {loading && (
          <ActivityIndicator
            color={theme.color.blue}
            style={{marginVertical: 16}}
          />
        )}

        {!loading && groups.length === 0 && (
          <GlassCard style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              You haven't joined any groups yet.
            </Text>
          </GlassCard>
        )}

        {!loading && groups.length > 0 && filteredGroups.length === 0 && (
          <Text style={styles.emptyText}>No groups match "{searchQuery}".</Text>
        )}

        {filteredGroups.map(g => (
          <SwipeableRow
            key={g.id}
            actionLabel="Leave"
            actionColor={theme.color.rose}
            onAction={() => handleLeaveGroup(g.id)}>
            <TouchableOpacity
              onPress={() => enterGroup(g.id)}
              activeOpacity={0.85}>
              <GlassCard
                style={StyleSheet.flatten([
                  styles.groupCard,
                  g.id === currentGroupKey && styles.groupCardActive,
                ])}>
                <View style={{flex: 1}}>
                  <Text style={styles.groupName}>{g.name}</Text>
                  <Text style={styles.groupMeta}>
                    Code: {g.joinCode} · {g.memberIds.length} member
                    {g.memberIds.length === 1 ? '' : 's'}
                    {g.createdAt &&
                      ` · Created ${new Date(g.createdAt).toLocaleDateString(
                        'en-IN',
                        {day: '2-digit', month: 'short', year: 'numeric'},
                      )}`}
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
                        ₹{Math.abs(overview.perGroupBalance[g.id]).toFixed(2)}
                      </Text>
                    )}
                </View>
                <ChevronRight size={18} color={theme.color.inkFaint} />
              </GlassCard>
            </TouchableOpacity>
          </SwipeableRow>
        ))}
      </KeyboardAwareScrollView>

      <GroupNameModal
        visible={groupNameModal}
        onClose={() => setGroupNameModal(false)}
        onCreate={handleCreateGroup}
        loading={creatingGroup}
      />
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
  content: {padding: 20, paddingBottom: 60},
  title: {
    color: theme.color.ink,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 12,
  },
  subtitle: {
    color: theme.color.inkSoft,
    fontSize: 13.5,
    marginTop: 4,
    marginBottom: 18,
  },
  emptyCard: {marginBottom: 12},
  emptyText: {color: theme.color.inkFaint, fontSize: 13.5, textAlign: 'center'},
  groupCard: {flexDirection: 'row', alignItems: 'center', marginBottom: 10},
  groupCardActive: {borderColor: theme.color.blue, borderWidth: 1.5},
  groupName: {color: theme.color.ink, fontSize: 15.5, fontWeight: '700'},
  hintText: {
    color: theme.color.inkFaint,
    fontSize: 11.5,
    marginTop: 8,
    marginBottom: 4,
  },
  groupMeta: {color: theme.color.inkFaint, fontSize: 12, marginTop: 3},
  groupBalance: {fontSize: 12.5, fontWeight: '700', marginTop: 6},
  dashboardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
    paddingVertical: 20,
  },
  legendCol: {gap: 16},
  legendRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  legendDot: {width: 10, height: 10, borderRadius: 5},
  legendLabel: {color: theme.color.inkFaint, fontSize: 12},
  legendAmount: {fontSize: 16, fontWeight: '800', marginTop: 2},
  sectionLabel: {
    color: theme.color.inkSoft,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 10,
  },
  joinCard: {flexDirection: 'row', alignItems: 'center', gap: 10},
  joinInput: {flex: 1, color: theme.color.ink, fontSize: 15},
  joinBtn: {
    backgroundColor: theme.color.blue,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  joinBtnText: {color: theme.color.onAccent, fontWeight: '700'},
  createBtn: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  createBtnText: {color: theme.color.teal, fontWeight: '700', fontSize: 14.5},
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
    fontSize: 14.5,
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
