// src/screens/AfterLogin/NotificationsScreen.tsx
// The dedicated notifications inbox - reached by tapping the bell in the
// dashboard header (src/component/header/index.tsx, previously just a
// placeholder "coming soon" toast) or by tapping a "someone wants to
// join" push. Deliberately NOT a feed of everything that happens in the
// app: expense-added notifications stay as plain pushes/toasts only, per
// the explicit ask that this screen is for join requests, announcements
// and admin-sent personal messages - not group activity.
//
// Not to be confused with src/screens/Notifications.js, which is an
// unrelated service module (local/notifee notification display), not a
// UI screen.

import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import React, {useMemo, useState} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {ChevronLeft} from 'lucide-react-native';
import moment from 'moment';
import Toast from '../../services/toast';
import GlassCard from '../../component/glass/GlassCard';
import {
  AdminJoinRequest,
  useAdminJoinRequests,
} from '../../hooks/useAdminJoinRequests';
import {useAnnouncements} from '../../hooks/useAnnouncements';
import {useAdminNotifications} from '../../hooks/useAdminNotifications';
import {
  approveJoinRequest,
  declineJoinRequest,
} from '../../services/ledger/firestoreLedger';
import {haptics} from '../../utils/haptics';
import {BodyFont, DisplayFont, moderateScale} from '../../utils/fonts';
import theme from '../../utils/theme';

// A join request and an announcement/admin message have different shapes
// - this is just enough of a common shape to sort and render the "Updates"
// feed as one merged, newest-first list without either type knowing about
// the other.
interface FeedItem {
  id: string;
  title: string;
  body: string;
  at: string; // ISO timestamp
}

const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const joinRequests = useAdminJoinRequests();
  const {announcements} = useAnnouncements();
  const {notifications: adminNotifications} = useAdminNotifications();
  const [respondingKey, setRespondingKey] = useState<string | null>(null);

  const feed = useMemo<FeedItem[]>(() => {
    const fromAnnouncements: FeedItem[] = announcements.map(a => ({
      id: `announcement:${a.id}`,
      title: a.title,
      body: a.message,
      at: a.createdAt,
    }));
    const fromAdmin: FeedItem[] = adminNotifications.map(n => ({
      id: `admin:${n.id}`,
      title: n.title,
      body: n.body,
      at: n.createdAt,
    }));
    return [...fromAnnouncements, ...fromAdmin].sort((a, b) =>
      a.at < b.at ? 1 : -1,
    );
  }, [announcements, adminNotifications]);

  const handleApprove = async (request: AdminJoinRequest) => {
    const key = `${request.groupId}:${request.uid}`;
    if (respondingKey) {
      return;
    }
    setRespondingKey(key);
    try {
      await approveJoinRequest(request.groupId, request.uid);
      haptics.success();
      Toast.show({
        type: 'success',
        text1: 'Member approved',
        text2: `${request.displayName} can now see "${request.groupName}".`,
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not approve request',
        text2: error?.message,
      });
    } finally {
      setRespondingKey(null);
    }
  };

  const handleDecline = async (request: AdminJoinRequest) => {
    const key = `${request.groupId}:${request.uid}`;
    if (respondingKey) {
      return;
    }
    setRespondingKey(key);
    try {
      await declineJoinRequest(request.groupId, request.uid);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not decline request',
        text2: error?.message,
      });
    } finally {
      setRespondingKey(null);
    }
  };

  const nothingToShow = joinRequests.length === 0 && feed.length === 0;

  return (
    <View style={styles.flex}>
      <View style={[styles.header, {paddingTop: insets.top + 12}]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
          style={styles.backBtn}>
          <ChevronLeft size={22} color={theme.color.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {nothingToShow && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>You're all caught up</Text>
            <Text style={styles.emptyHint}>
              Join requests, announcements and messages from the team will show
              up here.
            </Text>
          </View>
        )}

        {joinRequests.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Join requests ({joinRequests.length})
            </Text>
            {joinRequests.map(request => {
              const key = `${request.groupId}:${request.uid}`;
              const isResponding = respondingKey === key;
              return (
                <GlassCard key={key} style={styles.requestCard}>
                  <Text style={styles.requestName}>{request.displayName}</Text>
                  <Text style={styles.requestHint}>
                    wants to join "{request.groupName}"
                  </Text>
                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={styles.declineBtn}
                      onPress={() => handleDecline(request)}
                      disabled={!!respondingKey}>
                      <Text style={styles.declineText}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => handleApprove(request)}
                      disabled={!!respondingKey}>
                      <Text style={styles.approveText}>
                        {isResponding ? '…' : 'Approve'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </GlassCard>
              );
            })}
          </>
        )}

        {feed.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Updates</Text>
            {feed.map(item => (
              <GlassCard key={item.id} style={styles.updateCard}>
                <View style={styles.updateHeaderRow}>
                  <Text style={styles.updateTitle}>{item.title}</Text>
                  <Text style={styles.updateTime}>
                    {moment(item.at).fromNow()}
                  </Text>
                </View>
                <Text style={styles.updateBody}>{item.body}</Text>
              </GlassCard>
            ))}
          </>
        )}
      </ScrollView>
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
  content: {padding: 20, paddingBottom: 60},
  emptyState: {paddingTop: 60, alignItems: 'center'},
  emptyTitle: {
    fontFamily: DisplayFont.bold,
    color: theme.color.ink,
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  emptyHint: {
    fontFamily: BodyFont.regular,
    color: theme.color.inkFaint,
    fontSize: moderateScale(13),
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontFamily: BodyFont.bold,
    color: theme.color.inkSoft,
    fontSize: moderateScale(12),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 20,
  },
  requestCard: {marginBottom: 10},
  requestName: {
    fontFamily: BodyFont.bold,
    color: theme.color.ink,
    fontSize: moderateScale(15),
    fontWeight: '700',
  },
  requestHint: {
    fontFamily: BodyFont.regular,
    color: theme.color.inkFaint,
    fontSize: moderateScale(12.5),
    marginTop: 2,
  },
  requestActions: {flexDirection: 'row', gap: 8, marginTop: 12},
  declineBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    alignItems: 'center',
  },
  declineText: {
    fontFamily: BodyFont.semibold,
    color: theme.color.inkSoft,
    fontSize: moderateScale(13),
    fontWeight: '600',
  },
  approveBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.blue,
    alignItems: 'center',
  },
  approveText: {
    fontFamily: BodyFont.bold,
    color: theme.color.onAccent,
    fontSize: moderateScale(13),
    fontWeight: '700',
  },
  updateCard: {marginBottom: 10},
  updateHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  updateTitle: {
    fontFamily: BodyFont.bold,
    color: theme.color.ink,
    fontSize: moderateScale(14.5),
    fontWeight: '700',
    flex: 1,
  },
  updateTime: {
    fontFamily: BodyFont.regular,
    color: theme.color.inkFaint,
    fontSize: moderateScale(11),
  },
  updateBody: {
    fontFamily: BodyFont.regular,
    color: theme.color.inkSoft,
    fontSize: moderateScale(13),
    marginTop: 6,
    lineHeight: 18,
  },
});

export default NotificationsScreen;
