// src/screens/AfterLogin/GroupSettings.tsx
// Replaces ProfileScreen as the 3rd bottom tab (see BottomTabNavigator.tsx
// and Routes.GroupSettings) - this tab is now scoped to the CURRENT
// GROUP, not the signed-in user. Account-level stuff (identity, logout,
// delete account) now lives in the standalone Profile screen instead
// (src/screens/AfterLogin/Profile.tsx, reached by tapping the avatar in
// the dashboard header) rather than in a bottom tab.
//
// Carries over group-scoped logic that used to live in the old
// Profile.tsx: the admin-only lock toggle, the balance-guarded leave-group
// flow, and "switch or create a group" - plus a members list with role
// badges and the group's join code/currency, which didn't have a home
// before. The per-user UPI ID editor that also used to live in
// Profile.tsx moved to Balances.tsx instead (see that file) - it's a
// payment preference, not a group setting.
//
// Delete group is new: admin-only, blocked unless every member's balance
// is settled (not just the admin's own), and gated behind typing the
// group's exact name - matching the stakes of an action that erases the
// group's entire expense history for every member, not just the person
// tapping the button.
//
// Rename (the pencil next to the group name) is the opposite end of that
// scale: admin-only too (a name change is visible to every member, same
// reasoning as the lock toggle), but a single-field, no-confirmation
// write - fixing a typo shouldn't feel like a big decision the way
// deleting the group does.

import auth from '@react-native-firebase/auth';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {useBottomTabBarHeight} from '@react-navigation/bottom-tabs';
import {Pencil} from 'lucide-react-native';
import React, {useCallback, useState} from 'react';
import {
  BackHandler,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import GlassCard from '../../component/glass/GlassCard';
import GroupSwitcherPill from '../../component/GroupSwitcherPill';
import HomeIconChip from '../../component/HomeIconChip';
import {useGroupLedger} from '../../hooks/useGroupLedger';
import {useGroups} from '../../hooks/useGroups';
import {useJoinRequests} from '../../hooks/useJoinRequests';
import {useModalOpenGuard} from '../../hooks/useModalOpenGuard';
import {Routes} from '../../navigator/constants';
import AppAlert from '../../services/appAlert';
import {formatMoney} from '../../services/ledger/currency';
import {
  addGuestMember,
  approveJoinRequest,
  declineJoinRequest,
  deleteGroup,
  leaveGroup,
  removeGuestMember,
  renameGroup,
  setGroupLocked,
} from '../../services/ledger/firestoreLedger';
import {EPSILON} from '../../services/ledger/types';
import Toast from '../../services/toast';
import {useExpenseState} from '../../store/useExpenseStore';
import {haptics} from '../../utils/haptics';
import theme from '../../utils/theme';
import {BodyFont, DisplayFont, moderateScale} from '../../utils/fonts';

const GroupSettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  // Real height of the floating tab bar (it overlays content now
  // instead of reserving its own row - see BottomTabNavigator.tsx),
  // so scrollable content here can pad exactly enough to clear it at
  // rest while still scrolling underneath it past that point.
  const tabBarHeight = useBottomTabBarHeight();
  const user = auth().currentUser;
  const groupKey = useExpenseState(state => state.groupKey);
  const setGroupKey = useExpenseState(state => state.setGroupKey);
  const ledger = useGroupLedger(groupKey);
  const {renameGroupLocally} = useGroups();
  const [togglingLock, setTogglingLock] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingGroup, setDeletingGroup] = useState(false);
  const {requests: joinRequests} = useJoinRequests(groupKey);
  const [respondingUid, setRespondingUid] = useState<string | null>(null);
  const [addGuestModalVisible, setAddGuestModalVisible] = useState(false);
  // Rename: deliberately much lighter than the delete modal below - no
  // typed confirmation, since fixing a mistaken name is meant to be a
  // quick, easily-reversible correction, not a high-stakes action.
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [renamingGroup, setRenamingGroup] = useState(false);
  // See useModalOpenGuard.ts - both confirm modals below open
  // synchronously from a list-row press, the same shape of bug that
  // hit AddExpenseModal without this guard on their Cancel buttons.
  const canCloseDeleteModal = useModalOpenGuard(deleteModalVisible);
  const canCloseAddGuestModal = useModalOpenGuard(addGuestModalVisible);
  const canCloseRenameModal = useModalOpenGuard(renameModalVisible);
  const [guestNameInput, setGuestNameInput] = useState('');
  const [addingGuest, setAddingGuest] = useState(false);
  const [removingGuestUid, setRemovingGuestUid] = useState<string | null>(null);

  // Settings is a secondary tab, so back should return to the home tab
  // first rather than exiting the app - same reasoning as Balances.tsx
  // and the old Profile.tsx.
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

  const myBalance = user ? ledger.netBalances[user.uid] || 0 : 0;
  const hasOpenBalance = Math.abs(myBalance) > EPSILON;
  const myRole = ledger.members.find(m => m.uid === user?.uid)?.role;
  const isGroupAdmin = myRole === 'admin';
  // Delete group needs EVERYONE settled, not just the admin - unlike
  // leaving, where only the leaver's own balance matters, deleting wipes
  // every member's history at once.
  const allBalancesSettled = ledger.members.every(
    m => Math.abs(ledger.netBalances[m.uid] || 0) < EPSILON,
  );

  const handleToggleLock = async (nextLocked: boolean) => {
    if (!groupKey) {
      return;
    }
    setTogglingLock(true);
    try {
      await setGroupLocked(groupKey, nextLocked);
      haptics.success();
      Toast.show({
        type: 'success',
        text1: nextLocked
          ? 'Group locked - no new members can join'
          : 'Group unlocked - anyone with the code can join',
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not update group',
        text2: error?.message,
      });
    } finally {
      setTogglingLock(false);
    }
  };

  const openRenameModal = () => {
    setRenameInput(ledger.group?.name || '');
    setRenameModalVisible(true);
  };

  const handleRenameGroup = async () => {
    if (!groupKey) {
      return;
    }
    const trimmed = renameInput.trim();
    if (!trimmed) {
      Toast.show({
        type: 'info',
        text1: 'Enter a name',
        text2: 'The group needs a name.',
      });
      return;
    }
    // No-op guard: closing without actually changing anything shouldn't
    // fire a write or a success toast.
    if (trimmed === (ledger.group?.name || '').trim()) {
      setRenameModalVisible(false);
      return;
    }
    setRenamingGroup(true);
    try {
      await renameGroup(groupKey, trimmed);
      renameGroupLocally(groupKey, trimmed);
      setRenameModalVisible(false);
      haptics.success();
      Toast.show({type: 'success', text1: 'Group renamed'});
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not rename group',
        text2: error?.message,
      });
    } finally {
      setRenamingGroup(false);
    }
  };

  const handleLeaveGroup = () => {
    if (!groupKey || !user) {
      return;
    }
    // CRITICAL: while ledger.loading is true, expenses/settlements haven't
    // arrived from Firestore yet, so netBalances is computed from empty
    // arrays and myBalance reads as 0 no matter what the real balance is -
    // "we don't know yet" was being treated the same as "definitely
    // zero", which could let someone leave with a real unsettled debt if
    // they acted fast enough after opening this screen. Block instead of
    // guessing whenever the real balance isn't in yet.
    if (ledger.loading) {
      Toast.show({
        type: 'info',
        text1: 'Still checking your balance',
        text2: 'Give it a second, then try again.',
      });
      return;
    }
    // Settle-up-first stays a hard block, checked again here (not just via
    // the button's `disabled`) since ledger.netBalances is live and could
    // have changed between renders - this re-reads the current value right
    // before acting on it.
    if (hasOpenBalance) {
      Toast.show({
        type: 'error',
        text1: 'Settle up first',
        text2: `You still have an open balance of ${formatMoney(
          Math.abs(myBalance),
          ledger.group?.currency,
        )} in this group.`,
      });
      return;
    }
    AppAlert.alert(
      'Leave this group?',
      `You'll need the join code or a new invite to get back into "${
        ledger.group?.name || 'this group'
      }".`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveGroup(groupKey, user.uid);
              setGroupKey(null);
              navigation.getParent()?.navigate('Group-Check');
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

  const handleSwitchGroup = () => {
    navigation.getParent()?.navigate('Group-Check');
  };

  const handleApproveRequest = async (requesterUid: string) => {
    if (!groupKey || respondingUid) {
      return;
    }
    setRespondingUid(requesterUid);
    try {
      await approveJoinRequest(groupKey, requesterUid);
      haptics.success();
      Toast.show({type: 'success', text1: 'Member approved'});
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not approve request',
        text2: error?.message,
      });
    } finally {
      setRespondingUid(null);
    }
  };

  const handleDeclineRequest = (
    requesterUid: string,
    requesterName: string,
  ) => {
    if (!groupKey || respondingUid) {
      return;
    }
    AppAlert.alert(
      'Decline this request?',
      `${requesterName} can ask to join again later.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setRespondingUid(requesterUid);
            try {
              await declineJoinRequest(groupKey, requesterUid);
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Could not decline request',
                text2: error?.message,
              });
            } finally {
              setRespondingUid(null);
            }
          },
        },
      ],
    );
  };

  const openDeleteModal = () => {
    if (ledger.loading) {
      Toast.show({
        type: 'info',
        text1: 'Still checking balances',
        text2: 'Give it a second, then try again.',
      });
      return;
    }
    if (!allBalancesSettled) {
      Toast.show({
        type: 'error',
        text1: 'Everyone needs to settle up first',
        text2:
          'Every member’s balance must be zero before a group can be deleted.',
      });
      return;
    }
    setDeleteConfirmText('');
    setDeleteModalVisible(true);
  };

  const handleDeleteGroup = async () => {
    if (!groupKey) {
      return;
    }
    setDeletingGroup(true);
    try {
      await deleteGroup(groupKey);
      setDeleteModalVisible(false);
      setGroupKey(null);
      haptics.success();
      Toast.show({type: 'success', text1: 'Group deleted'});
      navigation.getParent()?.navigate('Group-Check');
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not delete group',
        text2: error?.message,
      });
    } finally {
      setDeletingGroup(false);
    }
  };

  const openAddGuestModal = () => {
    setGuestNameInput('');
    setAddGuestModalVisible(true);
  };

  const handleAddGuest = async () => {
    if (!groupKey) {
      return;
    }
    const trimmed = guestNameInput.trim();
    if (!trimmed) {
      Toast.show({
        type: 'info',
        text1: 'Enter a name',
        text2: 'So the split shows who this is for.',
      });
      return;
    }
    setAddingGuest(true);
    try {
      await addGuestMember(groupKey, trimmed);
      setAddGuestModalVisible(false);
      haptics.success();
      Toast.show({type: 'success', text1: 'Added ' + trimmed});
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not add guest',
        text2: error?.message,
      });
    } finally {
      setAddingGuest(false);
    }
  };

  const handleRemoveGuest = (guestUid: string, guestName: string) => {
    AppAlert.alert(
      'Remove ' + guestName + '?',
      "Their past expenses stay in the history, but they won't be part of new splits in this group.",
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!groupKey) {
              return;
            }
            setRemovingGuestUid(guestUid);
            try {
              await removeGuestMember(groupKey, guestUid);
              haptics.tap();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Could not remove guest',
                text2: error?.message,
              });
            } finally {
              setRemovingGuestUid(null);
            }
          },
        },
      ],
    );
  };

  const deleteConfirmMatches =
    deleteConfirmText.trim() === (ledger.group?.name || '').trim() &&
    deleteConfirmText.trim().length > 0;

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
          // height so the Danger Zone card isn't hidden underneath it at
          // rest.
          {paddingTop: insets.top + 24, paddingBottom: tabBarHeight + 24},
        ]}>
        <View style={styles.headingRow}>
          <Text style={[styles.heading, styles.headingNoMargin]}>Settings</Text>
          <View style={styles.headerRightGroup}>
            <HomeIconChip />
            <GroupSwitcherPill iconOnly />
          </View>
        </View>

        <GlassCard style={styles.groupCard}>
          <View style={styles.groupNameRow}>
            <Text
              style={[styles.groupName, styles.groupNameText]}
              numberOfLines={1}>
              {ledger.group?.name || 'Loading…'}
            </Text>
            {isGroupAdmin && (
              <TouchableOpacity
                style={styles.renameBtn}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                onPress={openRenameModal}>
                <Pencil size={15} color={theme.color.inkSoft} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.groupMetaRow}>
            <Text style={styles.groupMetaText}>
              {ledger.group?.currency || 'INR'} · {ledger.members.length} member
              {ledger.members.length === 1 ? '' : 's'}
            </Text>
          </View>
          {ledger.group?.type !== 'personal' &&
            (!ledger.group?.isLocked ? (
              !!ledger.group?.joinCode && (
                <Text style={styles.joinCodeText} selectable>
                  Join code: {ledger.group.joinCode}
                </Text>
              )
            ) : (
              <Text style={styles.lockedText}>
                Locked - the join code no longer works.
              </Text>
            ))}
        </GlassCard>

        {isGroupAdmin && ledger.group?.type !== 'personal' && (
          <>
            <Text style={styles.sectionTitle}>Admin</Text>
            <View style={styles.lockCard}>
              <View style={{flex: 1}}>
                <Text style={styles.actionText}>Lock group to new members</Text>
                <Text style={styles.lockHint}>
                  {ledger.group?.isLocked
                    ? 'Locked - the join code no longer works.'
                    : 'Open - anyone with the join code can join.'}
                </Text>
              </View>
              <Switch
                value={!!ledger.group?.isLocked}
                onValueChange={handleToggleLock}
                disabled={togglingLock}
                trackColor={{
                  false: theme.color.surfaceStrong,
                  true: theme.color.blue,
                }}
                thumbColor={theme.color.ink}
              />
            </View>
          </>
        )}

        {isGroupAdmin &&
          ledger.group?.type !== 'personal' &&
          joinRequests.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>
                Join requests ({joinRequests.length})
              </Text>
              {joinRequests.map(r => (
                <View key={r.uid} style={styles.requestRow}>
                  <View style={styles.requestInfo}>
                    <Text style={styles.requestName}>{r.displayName}</Text>
                    <Text style={styles.requestHint}>
                      wants to join this group
                    </Text>
                  </View>
                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={styles.requestDeclineBtn}
                      onPress={() => handleDeclineRequest(r.uid, r.displayName)}
                      disabled={!!respondingUid}>
                      <Text style={styles.requestDeclineText}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.requestApproveBtn}
                      onPress={() => handleApproveRequest(r.uid)}
                      disabled={!!respondingUid}>
                      <Text style={styles.requestApproveText}>
                        {respondingUid === r.uid ? 'Approving…' : 'Approve'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}

        <Text style={styles.sectionTitle}>Members</Text>
        {ledger.members
          .filter(m => !m.isGuest)
          .map(m => (
            <View key={m.uid} style={styles.memberRow}>
              <Text style={styles.memberName}>
                {m.uid === user?.uid ? 'You' : m.displayName}
              </Text>
              {m.role === 'admin' && (
                <View style={styles.adminBadge}>
                  <Text style={styles.adminBadgeText}>Admin</Text>
                </View>
              )}
            </View>
          ))}

        {/* Guests: people sharing real expenses here who haven't (or
        won't) install the app or go through the join-code flow - kept in
        their own section rather than mixed into "Members" above so it's
        obvious at a glance who's actually on the app versus who was
        added manually, per the ask that prompted this feature. A
        Personal list is explicitly "just you, nothing to split or
        settle" everywhere else in the app (AddExpenseModal, Balances) -
        guests are inherently a splitting concept, so they're kept out of
        Personal entirely rather than reintroducing that complexity. */}
        {ledger.group?.type !== 'personal' &&
          (ledger.members.some(m => m.isGuest) || isGroupAdmin) && (
            <>
              <Text style={styles.sectionTitle}>Guests</Text>
              {ledger.members.filter(m => m.isGuest).length === 0 && (
                <Text style={styles.guestEmptyText}>
                  No guests yet - add someone who's splitting with you but isn't
                  on EzySplit.
                </Text>
              )}
              {ledger.members
                .filter(m => m.isGuest)
                .map(m => (
                  <View key={m.uid} style={styles.memberRow}>
                    <Text style={styles.memberName}>{m.displayName}</Text>
                    <View style={styles.guestRowActions}>
                      <View style={styles.guestBadge}>
                        <Text style={styles.guestBadgeText}>Guest</Text>
                      </View>
                      {isGroupAdmin && (
                        <TouchableOpacity
                          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                          disabled={removingGuestUid === m.uid}
                          onPress={() =>
                            handleRemoveGuest(m.uid, m.displayName)
                          }>
                          <Text style={styles.removeGuestText}>
                            {removingGuestUid === m.uid
                              ? 'Removing…'
                              : 'Remove'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
              {isGroupAdmin && (
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={openAddGuestModal}>
                  <Text style={styles.actionText}>+ Add a guest</Text>
                </TouchableOpacity>
              )}
            </>
          )}

        {ledger.group?.type !== 'personal' &&
          !ledger.group?.isLocked &&
          !!ledger.group?.id && (
            <>
              <Text style={styles.sectionTitle}>Invite people</Text>
              <GlassCard opaque style={styles.qrCard}>
                <View style={styles.qrBox}>
                  <QRCode
                    value={`https://ezysplit.arun.codes/app/Group-Check/${ledger.group.id}`}
                    size={168}
                    color={theme.color.onAccent}
                    backgroundColor="#FFFFFF"
                  />
                </View>
                <Text style={styles.qrHint}>
                  Scan with a camera or Google Lens to request to join "
                  {ledger.group.name}" - same as sharing the join code above.
                </Text>
              </GlassCard>
            </>
          )}
        <Text style={styles.sectionTitle}>Group</Text>
        <TouchableOpacity style={styles.actionRow} onPress={handleSwitchGroup}>
          <Text style={styles.actionText}>Switch or create a group</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={handleLeaveGroup}
          disabled={hasOpenBalance}
          activeOpacity={hasOpenBalance ? 1 : 0.6}>
          <Text
            style={[
              styles.actionText,
              {
                color: hasOpenBalance ? theme.color.inkFaint : theme.color.rose,
              },
            ]}>
            Leave this group
          </Text>
          {hasOpenBalance && (
            <Text style={styles.leaveBlockedHint}>
              Settle your {myBalance >= 0 ? 'incoming' : 'open'} balance of{' '}
              {formatMoney(Math.abs(myBalance), ledger.group?.currency)} first
            </Text>
          )}
        </TouchableOpacity>

        {isGroupAdmin && (
          <>
            <Text style={[styles.sectionTitle, styles.dangerTitle]}>
              Danger zone
            </Text>
            <TouchableOpacity
              style={styles.dangerRow}
              onPress={openDeleteModal}>
              <Text style={styles.dangerText}>Delete this group</Text>
              <Text style={styles.dangerHint}>
                Permanently erases every expense and this group for all{' '}
                {ledger.members.length} member
                {ledger.members.length === 1 ? '' : 's'}. Can't be undone.
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}>
        <View style={styles.deleteOverlay}>
          <GlassCard opaque style={styles.deleteCard}>
            <Text style={styles.deleteTitle}>
              Delete "{ledger.group?.name}"?
            </Text>
            <Text style={styles.deleteBody}>
              This permanently deletes every expense, settlement and member
              record in this group for all {ledger.members.length} member
              {ledger.members.length === 1 ? '' : 's'}. This can't be undone.
            </Text>
            <Text style={styles.deleteLabel}>
              Type the group name to confirm:
            </Text>
            <TextInput
              style={styles.deleteInput}
              placeholder={ledger.group?.name || ''}
              placeholderTextColor={theme.color.inkFaint}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={styles.deleteCancelBtn}
                onPress={() => {
                  if (canCloseDeleteModal()) {
                    setDeleteModalVisible(false);
                  }
                }}
                disabled={deletingGroup}>
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.deleteConfirmBtn,
                  (!deleteConfirmMatches || deletingGroup) &&
                    styles.deleteConfirmBtnDisabled,
                ]}
                onPress={handleDeleteGroup}
                disabled={!deleteConfirmMatches || deletingGroup}>
                <Text style={styles.deleteConfirmText}>
                  {deletingGroup ? 'Deleting…' : 'Delete group'}
                </Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      </Modal>

      <Modal
        visible={addGuestModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddGuestModalVisible(false)}>
        <View style={styles.deleteOverlay}>
          <GlassCard opaque style={styles.deleteCard}>
            <Text style={styles.deleteTitle}>Add a guest</Text>
            <Text style={styles.deleteBody}>
              For someone splitting expenses with you here who isn't on EzySplit
              yet - they'll show up in the split picker like any other member,
              but won't get notifications or need to join.
            </Text>
            <Text style={styles.deleteLabel}>Their name</Text>
            <TextInput
              style={styles.deleteInput}
              placeholder="e.g. Aunt Priya"
              placeholderTextColor={theme.color.inkFaint}
              value={guestNameInput}
              onChangeText={setGuestNameInput}
              autoFocus
              editable={!addingGuest}
            />
            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={styles.deleteCancelBtn}
                onPress={() => {
                  if (canCloseAddGuestModal()) {
                    setAddGuestModalVisible(false);
                  }
                }}
                disabled={addingGuest}>
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.addGuestConfirmBtn,
                  (!guestNameInput.trim() || addingGuest) &&
                    styles.deleteConfirmBtnDisabled,
                ]}
                onPress={handleAddGuest}
                disabled={!guestNameInput.trim() || addingGuest}>
                <Text style={styles.addGuestConfirmText}>
                  {addingGuest ? 'Adding…' : 'Add guest'}
                </Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      </Modal>

      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}>
        <View style={styles.deleteOverlay}>
          <GlassCard opaque style={styles.deleteCard}>
            <Text style={styles.deleteTitle}>Rename group</Text>
            <Text style={styles.deleteLabel}>Group name</Text>
            <TextInput
              style={styles.deleteInput}
              placeholder="e.g. Goa Trip"
              placeholderTextColor={theme.color.inkFaint}
              value={renameInput}
              onChangeText={setRenameInput}
              autoFocus
              maxLength={60}
              editable={!renamingGroup}
            />
            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={styles.deleteCancelBtn}
                onPress={() => {
                  if (canCloseRenameModal()) {
                    setRenameModalVisible(false);
                  }
                }}
                disabled={renamingGroup}>
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.addGuestConfirmBtn,
                  (!renameInput.trim() || renamingGroup) &&
                    styles.deleteConfirmBtnDisabled,
                ]}
                onPress={handleRenameGroup}
                disabled={!renameInput.trim() || renamingGroup}>
                <Text style={styles.addGuestConfirmText}>
                  {renamingGroup ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      </Modal>
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
  groupCard: {marginTop: 18, marginBottom: 8},
  groupNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  groupName: {
    color: theme.color.ink,
    fontFamily: DisplayFont.bold,
    fontSize: moderateScale(18),
    fontWeight: '700',
  },
  groupNameText: {flex: 1},
  renameBtn: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupMetaRow: {marginTop: 4},
  groupMetaText: {
    color: theme.color.inkSoft,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(13),
  },
  joinCodeText: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.semibold,
    fontSize: moderateScale(12),
    fontWeight: '600',
    letterSpacing: 0.4,
    marginTop: 10,
  },
  lockedText: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(12),
    marginTop: 10,
  },
  qrCard: {alignItems: 'center', paddingVertical: 20},
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: theme.radius.md,
  },
  qrHint: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(12),
    textAlign: 'center',
    marginTop: 14,
    lineHeight: moderateScale(17),
  },
  sectionTitle: {
    color: theme.color.inkSoft,
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(12),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 20,
  },
  dangerTitle: {color: theme.color.rose},
  lockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  lockHint: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(11.5),
    marginTop: 3,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  requestInfo: {flex: 1},
  requestName: {
    color: theme.color.ink,
    fontFamily: BodyFont.semibold,
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  requestHint: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(11.5),
    marginTop: 2,
  },
  requestActions: {flexDirection: 'row', gap: 8},
  requestDeclineBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  requestDeclineText: {
    color: theme.color.inkSoft,
    fontFamily: BodyFont.semibold,
    fontSize: moderateScale(12.5),
    fontWeight: '600',
  },
  requestApproveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.blue,
  },
  requestApproveText: {
    color: theme.color.onAccent,
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(12.5),
    fontWeight: '700',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  memberName: {
    color: theme.color.ink,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(14),
  },
  adminBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  adminBadgeText: {
    color: theme.color.inkSoft,
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(10.5),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  guestEmptyText: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(12.5),
    lineHeight: moderateScale(17),
    paddingVertical: 8,
  },
  guestRowActions: {flexDirection: 'row', alignItems: 'center', gap: 12},
  guestBadge: {
    backgroundColor: 'rgba(240,185,77,0.16)',
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  guestBadgeText: {
    color: theme.color.amber,
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(10.5),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  removeGuestText: {
    color: theme.color.rose,
    fontFamily: BodyFont.semibold,
    fontSize: moderateScale(12.5),
    fontWeight: '600',
  },
  addGuestConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.blue,
    alignItems: 'center',
  },
  addGuestConfirmText: {
    color: theme.color.onAccent,
    fontFamily: BodyFont.bold,
    fontWeight: '700',
  },
  actionRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  actionText: {
    color: theme.color.ink,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(14.5),
  },
  leaveBlockedHint: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(11.5),
    marginTop: 4,
  },
  dangerRow: {
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.color.rose,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
  },
  dangerText: {
    color: theme.color.rose,
    fontFamily: BodyFont.bold,
    fontWeight: '700',
    fontSize: moderateScale(14.5),
  },
  dangerHint: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(11.5),
    marginTop: 4,
  },
  emptyState: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  emptyText: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(14),
  },
  deleteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6,5,12,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  deleteCard: {width: '100%', maxWidth: 380},
  deleteTitle: {
    color: theme.color.ink,
    fontFamily: DisplayFont.bold,
    fontSize: moderateScale(17),
    fontWeight: '700',
    marginBottom: 10,
  },
  deleteBody: {
    color: theme.color.inkSoft,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(13),
    lineHeight: moderateScale(18),
    marginBottom: 16,
  },
  deleteLabel: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.semibold,
    fontSize: moderateScale(11.5),
    fontWeight: '600',
    marginBottom: 6,
  },
  deleteInput: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: theme.color.ink,
    marginBottom: 18,
  },
  deleteActions: {flexDirection: 'row', gap: 10},
  deleteCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    alignItems: 'center',
  },
  deleteCancelText: {
    color: theme.color.inkSoft,
    fontFamily: BodyFont.semibold,
    fontWeight: '600',
  },
  deleteConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.rose,
    alignItems: 'center',
  },
  deleteConfirmBtnDisabled: {opacity: 0.4},
  deleteConfirmText: {
    color: theme.color.onAccent,
    fontFamily: BodyFont.bold,
    fontWeight: '700',
  },
});

export default GroupSettingsScreen;
