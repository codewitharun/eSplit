// src/screens/AfterLogin/Profile.tsx
// The standalone account screen - reached by tapping the avatar in the
// dashboard header (see src/component/header/index.tsx), not a bottom
// tab. Group-scoped settings (lock toggle, leave group, delete group,
// members, join requests) live in GroupSettings.tsx instead; this screen
// is only ever about the signed-in person themselves: their identity,
// logging out, and deleting their account entirely.
//
// Delete account is admin-of-nothing-but-yourself: gated on having ZERO
// group memberships (useGroups()) before anything is touched, so it can
// never cascade into anyone else's shared data - unlike Delete group in
// GroupSettings.tsx, which erases data every member of that group shares.
// The actual deletion (personal expenses, the users/{uid} doc, then the
// Firebase Auth login) lives in src/data/auth.ts's deleteAccount().

import {useNavigation} from '@react-navigation/native';
import {
  ChevronLeft,
  ExternalLink,
  LucideIcon,
  MessageSquare,
  ShieldCheck,
  Trash2,
} from 'lucide-react-native';
import React, {useState} from 'react';
import {
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {Text} from '../../component/ui/AppText';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import GlassCard from '../../component/glass/GlassCard';
import AppBottomBar, {
  useAppBottomBarHeight,
} from '../../navigator/AppBottomBar';
import TechTitanFooter from '../../component/glass/TechTitanFooter';
import {useGroups} from '../../hooks/useGroups';
import AppAlert from '../../services/appAlert';
import {deleteAccount, signOut} from '../../data/auth';
import Toast from '../../services/toast';
import {BodyFont, DisplayFont, moderateScale} from '../../utils/fonts';
import theme from '../../utils/theme';
import {currentUser} from '../../data/firebase';
import {
  DELETE_ACCOUNT_URL,
  PRIVACY_POLICY_URL,
  SUPPORT_URL,
} from '../../config/urls';

// Help & legal links - open the public pages on esplit-backend in the
// browser (same URLs Play Console lists for privacy and data deletion).
const LINKS: {label: string; icon: LucideIcon; url: string}[] = [
  {label: 'Help & support', icon: MessageSquare, url: SUPPORT_URL},
  {label: 'Privacy policy', icon: ShieldCheck, url: PRIVACY_POLICY_URL},
  {label: 'Delete account & data', icon: Trash2, url: DELETE_ACCOUNT_URL},
];

const openLink = (url: string) => {
  Linking.openURL(url).catch(() =>
    Toast.show({
      type: 'error',
      text1: "Couldn't open the link",
      text2: url,
    }),
  );
};

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const barHeight = useAppBottomBarHeight();
  const user = currentUser();
  const {groups, loading: groupsLoading} = useGroups();
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleLogout = () => {
    // Delete account and leave group both confirm before acting (see
    // handleDeleteAccount above and GroupSettings.tsx's handleLeaveGroup) -
    // logout was the one account action that fired immediately on tap,
    // so a stray tap near the button would sign someone out with no way
    // to back out of it.
    AppAlert.alert(
      'Log out?',
      "You'll need to sign in again to get back to your groups.",
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              console.log('Logout error:', error);
            }
          },
        },
      ],
    );
  };

  const handleDeleteAccount = () => {
    if (deletingAccount) {
      return;
    }
    if (groupsLoading) {
      Toast.show({
        type: 'info',
        text1: 'Still checking your groups',
        text2: 'Give it a second, then try again.',
      });
      return;
    }
    // Re-checked here (not just via the button's `disabled`) since
    // `groups` is live and could have changed between renders - same
    // "re-read the current value right before acting" convention as
    // GroupSettings.tsx's leave/delete-group guards.
    if (groups.length > 0) {
      Toast.show({
        type: 'error',
        text1: 'Leave every group first',
        text2: `You're still in ${groups.length} group${
          groups.length === 1 ? '' : 's'
        } - leave ${
          groups.length === 1 ? 'it' : 'all of them'
        } before deleting your account.`,
      });
      return;
    }
    AppAlert.alert(
      'Delete your account?',
      "This permanently erases your personal expense history and your EzySplit login. This can't be undone.",
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true);
            try {
              await deleteAccount();
              // On success deleteAccount() clears the auth store itself,
              // which unmounts this whole screen - nothing left to do or
              // reset here.
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Could not delete account',
                text2: error?.message,
              });
              setDeletingAccount(false);
            }
          },
        },
      ],
    );
  };

  const deleteBlocked = groupsLoading || groups.length > 0 || deletingAccount;

  return (
    <View style={styles.flex}>
      <View style={[styles.header, {paddingTop: insets.top + 12}]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
          style={styles.backBtn}>
          <ChevronLeft size={22} color={theme.color.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          // ~50 covers TechTitanFooter's own rendered height (paddingTop
          // 10 + the logo/text row + paddingBottom 10); +24 is the same
          // breathing-room gap used elsewhere for AppBottomBar clearance.
          {paddingBottom: barHeight + 74},
        ]}>
        <GlassCard style={styles.profileCard}>
          {user?.photoURL ? (
            <Image source={{uri: user.photoURL}} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback} />
          )}
          <View style={styles.identity}>
            <Text style={styles.name}>{user?.displayName || 'Guest'}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </GlassCard>

        <Text style={styles.sectionTitle}>Help & legal</Text>
        <GlassCard style={styles.linksCard}>
          {LINKS.map(({label, icon: Icon, url}, i) => (
            <TouchableOpacity
              key={url}
              style={[styles.linkRow, i > 0 && styles.linkRowDivider]}
              onPress={() => openLink(url)}
              activeOpacity={0.7}>
              <Icon size={18} color={theme.color.inkSoft} />
              <Text style={styles.linkText}>{label}</Text>
              <ExternalLink size={15} color={theme.color.inkFaint} />
            </TouchableOpacity>
          ))}
        </GlassCard>

        <Text style={[styles.sectionTitle, styles.dangerTitle]}>
          Danger zone
        </Text>
        <TouchableOpacity
          style={[styles.dangerRow, deleteBlocked && styles.dangerRowMuted]}
          onPress={handleDeleteAccount}
          disabled={deleteBlocked && !groupsLoading}
          activeOpacity={0.7}>
          <Text style={styles.dangerText}>
            {deletingAccount ? 'Deleting account…' : 'Delete my account'}
          </Text>
          <Text style={styles.dangerHint}>
            {groupsLoading
              ? 'Checking your groups…'
              : groups.length > 0
              ? `Leave all ${groups.length} of your group${
                  groups.length === 1 ? '' : 's'
                } first - this can't cascade into anything shared.`
              : "Erases your personal expense history and your login. Can't be undone."}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>

      <TechTitanFooter style={[styles.footerFixed, {bottom: barHeight}]} />

      <AppBottomBar active="settings" />
    </View>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1, backgroundColor: theme.color.ground},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: {padding: 4},
  headerTitle: {
    fontFamily: DisplayFont.bold,
    color: theme.color.ink,
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  headerSpacer: {width: 30},
  content: {padding: 20},
  profileCard: {flexDirection: 'row', alignItems: 'center', marginBottom: 8},
  avatar: {width: 52, height: 52, borderRadius: 26},
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.color.surfaceStrong,
  },
  identity: {flex: 1, marginLeft: 14},
  name: {
    fontFamily: DisplayFont.bold,
    color: theme.color.ink,
    fontSize: moderateScale(17),
    fontWeight: '700',
  },
  email: {
    fontFamily: BodyFont.regular,
    color: theme.color.inkFaint,
    fontSize: moderateScale(12.5),
    marginTop: 2,
  },
  sectionTitle: {
    fontFamily: BodyFont.bold,
    color: theme.color.inkSoft,
    fontSize: moderateScale(12),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 28,
  },
  dangerTitle: {color: theme.color.rose},
  linksCard: {paddingVertical: 2, paddingHorizontal: 14},
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  linkRowDivider: {borderTopWidth: 1, borderTopColor: theme.color.border},
  linkText: {
    flex: 1,
    fontFamily: BodyFont.semibold,
    color: theme.color.ink,
    fontSize: moderateScale(14.5),
  },
  dangerRow: {
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.color.rose,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
  },
  dangerRowMuted: {opacity: 0.6},
  dangerText: {
    fontFamily: BodyFont.bold,
    color: theme.color.rose,
    fontWeight: '700',
    fontSize: moderateScale(14.5),
  },
  dangerHint: {
    fontFamily: BodyFont.regular,
    color: theme.color.inkFaint,
    fontSize: moderateScale(11.5),
    marginTop: 4,
  },
  logoutBtn: {
    marginTop: 32,
    backgroundColor: 'rgba(240,129,156,0.14)',
    borderWidth: 1,
    borderColor: theme.color.rose,
    borderRadius: theme.radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  logoutText: {
    fontFamily: BodyFont.bold,
    color: theme.color.rose,
    fontWeight: '700',
  },
  footerFixed: {
    position: 'absolute',
    left: 0,
    right: 0,
    justifyContent: 'center',
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: theme.color.ground,
  },
});

export default ProfileScreen;
