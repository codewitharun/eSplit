// src/screens/AfterLogin/Profile.tsx
// The "You" tab: identity, UPI ID (what makes Balances' settle-up deep
// link actually work), leave-group with an open-balance guard, and
// logout - replacing the old always-visible Header component's job.

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import React, {useCallback, useEffect, useState} from 'react';
import {
  BackHandler,
  Image,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import Toast from '../../services/toast';
import AppAlert from '../../services/appAlert';
import GlassCard from '../../component/glass/GlassCard';
import GradientMesh from '../../component/glass/GradientMesh';
import {useGroupLedger} from '../../hooks/useGroupLedger';
import {
  leaveGroup,
  setGroupLocked,
} from '../../services/ledger/firestoreLedger';
import {Routes} from '../../navigator/constants';
import {isValidUpiVpa} from '../../services/ledger/upi';
import {formatMoney, isUpiCurrency} from '../../services/ledger/currency';
import {signOut} from '../../services/auth';
import {useExpenseState} from '../../store/useExpenseStore';
import {haptics} from '../../utils/haptics';
import theme from '../../utils/theme';
import {EPSILON} from '../../services/ledger/types';

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const user = auth().currentUser;
  const groupKey = useExpenseState(state => state.groupKey);
  const setGroupKey = useExpenseState(state => state.setGroupKey);
  const ledger = useGroupLedger(groupKey);

  // Same reasoning as Balances.tsx: "You" is a secondary tab, so back
  // should return to the home tab first rather than exiting the app.
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
  const [upiId, setUpiId] = useState('');
  const [saving, setSaving] = useState(false);
  const [togglingLock, setTogglingLock] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }
    firestore()
      .collection('users')
      .doc(user.uid)
      .get()
      .then(doc => setUpiId(doc.exists ? doc.data()?.upiId || '' : ''));
  }, [user]);

  const saveUpiId = async () => {
    if (!user) {
      return;
    }
    if (upiId && !isValidUpiVpa(upiId)) {
      Toast.show({
        type: 'error',
        text1: 'That doesn’t look like a UPI ID',
        text2: 'e.g. name@bank',
      });
      return;
    }
    setSaving(true);
    try {
      await firestore()
        .collection('users')
        .doc(user.uid)
        .set({upiId: upiId.trim()}, {merge: true});
      haptics.success();
      Toast.show({type: 'success', text1: 'UPI ID saved'});
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not save',
        text2: error?.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const myBalance = user ? ledger.netBalances[user.uid] || 0 : 0;
  const hasOpenBalance = Math.abs(myBalance) > EPSILON;
  const myRole = ledger.members.find(m => m.uid === user?.uid)?.role;
  const isGroupAdmin = myRole === 'admin';

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

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.log('Logout error:', error);
    }
  };

  return (
    <View style={styles.flex}>
      <GradientMesh />
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.content, {paddingTop: insets.top + 24}]}
        enableOnAndroid
        extraScrollHeight={20}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>You</Text>

        <GlassCard style={styles.profileCard}>
          {user?.photoURL ? (
            <Image source={{uri: user.photoURL}} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback} />
          )}
          <View style={{flex: 1, marginLeft: 14}}>
            <Text style={styles.name}>{user?.displayName || 'Guest'}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </GlassCard>

        {isUpiCurrency(ledger.group?.currency) && (
          <>
            <Text style={styles.sectionTitle}>UPI ID (for settle-up)</Text>
            <GlassCard style={styles.upiCard}>
              <TextInput
                style={styles.upiInput}
                placeholder="yourname@bank"
                placeholderTextColor={theme.color.inkFaint}
                autoCapitalize="none"
                value={upiId}
                onChangeText={setUpiId}
              />
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={saveUpiId}
                disabled={saving}>
                <Text style={styles.saveBtnText}>
                  {saving ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </GlassCard>
            <Text style={styles.hint}>
              When someone settles up with you, this is what lets EzySplit
              open GPay/PhonePe with the amount prefilled.
            </Text>
          </>
        )}

        {groupKey && (
          <>
            <Text style={styles.sectionTitle}>Current group</Text>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleSwitchGroup}>
              <Text style={styles.actionText}>Switch or create a group</Text>
            </TouchableOpacity>

            {isGroupAdmin && (
              <View style={styles.actionRow}>
                <View style={styles.lockRow}>
                  <View style={{flex: 1}}>
                    <Text style={styles.actionText}>
                      Lock group to new members
                    </Text>
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
              </View>
            )}

            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleLeaveGroup}
              disabled={hasOpenBalance}
              activeOpacity={hasOpenBalance ? 1 : 0.6}>
              <Text
                style={[
                  styles.actionText,
                  {
                    color: hasOpenBalance
                      ? theme.color.inkFaint
                      : theme.color.rose,
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
          </>
        )}

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
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
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
  },
  profileCard: {flexDirection: 'row', alignItems: 'center', marginBottom: 24},
  avatar: {width: 52, height: 52, borderRadius: 26},
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.color.surfaceStrong,
  },
  name: {color: theme.color.ink, fontSize: 17, fontWeight: '700'},
  email: {color: theme.color.inkFaint, fontSize: 12.5, marginTop: 2},
  sectionTitle: {
    color: theme.color.inkSoft,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 8,
  },
  upiCard: {flexDirection: 'row', alignItems: 'center', gap: 10},
  upiInput: {flex: 1, color: theme.color.ink, fontSize: 14.5},
  saveBtn: {
    backgroundColor: theme.color.blue,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveBtnText: {color: theme.color.onAccent, fontWeight: '700', fontSize: 12.5},
  hint: {
    color: theme.color.inkFaint,
    fontSize: 12,
    marginTop: 8,
    lineHeight: 17,
  },
  actionRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  actionText: {color: theme.color.ink, fontSize: 14.5},
  lockRow: {flexDirection: 'row', alignItems: 'center', gap: 12},
  lockHint: {color: theme.color.inkFaint, fontSize: 11.5, marginTop: 3},
  leaveBlockedHint: {color: theme.color.inkFaint, fontSize: 11.5, marginTop: 4},
  logoutBtn: {
    marginTop: 32,
    backgroundColor: 'rgba(240,129,156,0.14)',
    borderWidth: 1,
    borderColor: theme.color.rose,
    borderRadius: theme.radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  logoutText: {color: theme.color.rose, fontWeight: '700'},
});

export default ProfileScreen;
