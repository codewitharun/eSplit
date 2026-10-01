// src/component/SwitchGroupSheet.tsx
// The "Switch group" bottom sheet - opened from GroupSwitcherPill's pill
// (shown in Activity/Balances/GroupSettings headers, once you're already
// inside a group). Shows your 5 most recently active groups so you can
// jump sideways to a different one without backing all the way out to
// the dashboard first; a "See more" row appears only when you actually
// have more than 5 to show, and drops you on the full Groups list.
//
// Same Modal pattern as AddExpenseModal.tsx (slide-up, transparent,
// dimmed backdrop, tap-to-dismiss, a centered close button floating just
// above the sheet rather than an in-header X) rather than a new
// bottom-sheet dependency - this app has no bottom-sheet library
// installed and none should be added without Arun installing it himself.

import auth from '@react-native-firebase/auth';
import {useNavigation} from '@react-navigation/native';
import {ChevronRight, X} from 'lucide-react-native';
import React, {useMemo} from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useEnterGroup} from '../hooks/useEnterGroup';
import {useGroups} from '../hooks/useGroups';
import {useGroupsOverview} from '../hooks/useGroupsOverview';
import {useModalOpenGuard} from '../hooks/useModalOpenGuard';
import {formatMoney} from '../services/ledger/currency';
import {useExpenseState} from '../store/useExpenseStore';
import {BodyFont, DisplayFont, moderateScale} from '../utils/fonts';
import {haptics} from '../utils/haptics';
import theme from '../utils/theme';
import GlassCard from './glass/GlassCard';

const MAX_SHOWN = 5;

// Same palette/hash as GroupCheck.tsx's own avatarColorForId - kept as a
// small local copy rather than importing from a screen file, same
// reasoning as GroupCheck's own comment on why this isn't shared: it's
// six lines, and a screen shouldn't be a dependency of a component.
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

interface SwitchGroupSheetProps {
  visible: boolean;
  onClose: () => void;
}

const SwitchGroupSheet: React.FC<SwitchGroupSheetProps> = ({
  visible,
  onClose,
}) => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const user = auth().currentUser;
  const {groups, loading} = useGroups();
  const overview = useGroupsOverview(groups, user?.uid);
  const {enterGroup} = useEnterGroup(navigation);
  const currentGroupKey = useExpenseState(state => state.groupKey);
  // See useModalOpenGuard.ts - swallows the phantom close Android can
  // replay onto this modal's backdrop/close button the instant it opens.
  const canClose = useModalOpenGuard(visible);

  const sorted = useMemo(() => {
    return [...groups].sort((a, b) => {
      const ta = overview.lastActivityByGroup[a.id] || a.createdAt || '';
      const tb = overview.lastActivityByGroup[b.id] || b.createdAt || '';
      return tb.localeCompare(ta);
    });
  }, [groups, overview.lastActivityByGroup]);

  const shown = sorted.slice(0, MAX_SHOWN);
  const hasMore = sorted.length > MAX_SHOWN;

  const handleSelect = (groupId: string, currency?: string, type?: any) => {
    haptics.tap();
    onClose();
    if (groupId === currentGroupKey) {
      return;
    }
    enterGroup(groupId, currency, type);
  };

  const handleSeeMore = () => {
    haptics.tap();
    onClose();
    navigation.navigate('Groups');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.backdrop} pointerEvents="box-none">
        <TouchableWithoutFeedback
          onPress={() => {
            // Swallows the phantom release Android can replay onto this
            // backdrop the instant the modal opens - see
            // useModalOpenGuard.ts. A real tap closes it exactly as
            // before.
            if (canClose()) {
              onClose();
            }
          }}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => {
            if (canClose()) {
              onClose();
            }
          }}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <X size={20} color={theme.color.ink} />
        </TouchableOpacity>
        <GlassCard
          opaque
          style={StyleSheet.flatten([
            styles.sheet,
            {paddingBottom: Math.max(insets.bottom, 16) + 8},
          ])}>
          <Text style={styles.title}>Switch group</Text>

          {loading && shown.length === 0 && (
            <ActivityIndicator color={theme.color.blue} style={styles.loader} />
          )}

          {!loading && groups.length === 0 && (
            <Text style={styles.emptyText}>
              You haven't joined any groups yet.
            </Text>
          )}

          {shown.map(g => (
            <TouchableOpacity
              key={g.id}
              style={styles.row}
              activeOpacity={0.8}
              onPress={() => handleSelect(g.id, g.currency, g.type)}>
              <View
                style={[
                  styles.avatar,
                  {backgroundColor: avatarColorForId(g.id)},
                ]}>
                <Text style={styles.avatarLetter}>
                  {(g.name || '?').trim().charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.rowBody}>
                <View style={styles.nameRow}>
                  <Text style={styles.groupName} numberOfLines={1}>
                    {g.name}
                  </Text>
                  {g.type === 'personal' && (
                    <View style={styles.personalTag}>
                      <Text style={styles.personalTagText}>Personal</Text>
                    </View>
                  )}
                </View>
                {g.type === 'personal' && (
                  <Text style={styles.subtle}>Just you - nothing to split</Text>
                )}
                {g.type !== 'personal' &&
                  overview.perGroupBalance[g.id] != null &&
                  Math.abs(overview.perGroupBalance[g.id]) <= 0.01 && (
                    <Text style={styles.subtle}>All settled up</Text>
                  )}
                {overview.perGroupBalance[g.id] != null &&
                  Math.abs(overview.perGroupBalance[g.id]) > 0.01 && (
                    <Text
                      style={[
                        styles.balance,
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
              {g.id === currentGroupKey && <View style={styles.currentDot} />}
              <ChevronRight size={16} color={theme.color.inkFaint} />
            </TouchableOpacity>
          ))}

          {hasMore && (
            <TouchableOpacity style={styles.seeMoreBtn} onPress={handleSeeMore}>
              <Text style={styles.seeMoreText}>
                See more ({sorted.length - MAX_SHOWN} more)
              </Text>
              <ChevronRight size={14} color={theme.color.blueBright} />
            </TouchableOpacity>
          )}
        </GlassCard>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6,5,12,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    paddingTop: 18,
    paddingHorizontal: 20,
  },
  title: {
    fontFamily: DisplayFont.bold,
    fontSize: moderateScale(17),
    fontWeight: '700',
    color: theme.color.ink,
    marginBottom: 14,
  },
  // Floating above the sheet, outside the card, centered - same pattern
  // as AddExpenseModal's own closeBtn.
  closeBtn: {
    alignSelf: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.color.surfaceStrong,
    borderWidth: 1,
    borderColor: theme.color.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  loader: {
    marginVertical: 20,
  },
  emptyText: {
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(13),
    color: theme.color.inkFaint,
    marginVertical: 20,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: theme.color.onAccent,
  },
  rowBody: {
    flex: 1,
  },
  nameRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  // Same tag as the dashboard / Groups list rows (GroupCheck.tsx).
  personalTag: {
    backgroundColor: theme.color.blueBright + '26',
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  personalTagText: {
    color: theme.color.blueBright,
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(10),
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  subtle: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(12),
    marginTop: 2,
  },
  groupName: {
    flexShrink: 1,
    fontFamily: BodyFont.semibold,
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: theme.color.ink,
  },
  balance: {
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(11.5),
    marginTop: 2,
  },
  currentDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: theme.color.blueBright,
  },
  seeMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 14,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  seeMoreText: {
    fontFamily: BodyFont.semibold,
    fontSize: moderateScale(13),
    fontWeight: '600',
    color: theme.color.blueBright,
  },
});

export default SwitchGroupSheet;
