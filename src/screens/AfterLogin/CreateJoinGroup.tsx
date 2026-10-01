// src/screens/AfterLogin/CreateJoinGroup.tsx
// Dedicated "Create or join a group" page. Previously this lived as an
// inline "+ Create a new group" button and a "Join with a code" card
// sitting directly on the dashboard (Group-Check.tsx), with the actual
// create form popping up as a modal on top of it - per user feedback,
// group creation now gets its own page instead of being buried in the
// dashboard, reached from the "+" button next to "Your groups".
//
// Uses the shared useEnterGroup hook (src/hooks/useEnterGroup.ts) instead
// of duplicating the enterGroup/UPI-prompt logic that Group-Check.tsx
// keeps inline for its own deep-link join flow - this screen has no
// existing logic of its own to preserve, so it's the natural first user
// of that shared hook.
//
// Both submit actions use a plain gradient CTA button (no slider) - per
// designer feedback, SwipeToConfirm is now reserved for higher-stakes
// actions (add expense, delete/leave group) and group creation/joining
// don't warrant it. Neither is a plain Modal, so (unlike
// AddExpenseModal/groupNameModal) no extra GestureHandlerRootView
// wrapper is needed: this screen already sits inside the app's
// top-level one from App.jsx.

import auth from '@react-native-firebase/auth';
import {useNavigation} from '@react-navigation/native';
import {ChevronLeft} from 'lucide-react-native';
import React, {useMemo, useState} from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import GlassCard from '../../component/glass/GlassCard';
import GradientView from '../../component/glass/GradientView';
import UpiPromptModal from '../../component/UpiPromptModal';
import {COUNTRIES, CountryOption} from '../../data/countries';
import {useEnterGroup} from '../../hooks/useEnterGroup';
import {useModalOpenGuard} from '../../hooks/useModalOpenGuard';
import {useGroups} from '../../hooks/useGroups';
import {isUpiCurrency} from '../../services/ledger/currency';
import {GroupType} from '../../services/ledger/types';
import Toast from '../../services/toast';
import {
  BodyFont,
  DisplayFont,
  MonoFont,
  moderateScale,
} from '../../utils/fonts';
import theme from '../../utils/theme';

const DEFAULT_COUNTRY: CountryOption =
  COUNTRIES.find(c => c.code === 'IN') || COUNTRIES[0];

type EnterGroupFn = (
  groupId: string,
  currency?: string,
  type?: GroupType,
) => Promise<void>;

interface FormProps {
  // The caller's useEnterGroup().enterGroup - the caller also owns the
  // UpiPromptModal that hook drives, so the prompt survives this form
  // closing (it may live in a panel that closes on success).
  enterGroup: EnterGroupFn;
  // Called right before entering a newly created/joined group, and after
  // a join request is sent - lets a panel close itself.
  onDone?: () => void;
}

// The create + join form, without any page chrome. Rendered by the
// CreateJoinGroup screen below and by NewGroupPanel (the genie panel the
// "New group" button opens).
export const CreateJoinGroupForm: React.FC<FormProps> = ({
  enterGroup,
  onDone,
}) => {
  const {createGroup, joinGroupByCode} = useGroups();

  const [groupName, setGroupName] = useState('');
  // Existing groups (created before this toggle existed) simply have no
  // `type` field at all and are read as 'group' everywhere - this local
  // state only decides what NEW groups get written as, it never touches
  // anything already in Firestore.
  const [groupType, setGroupType] = useState<GroupType>('group');
  const [country, setCountry] = useState<CountryOption>(DEFAULT_COUNTRY);
  const [pickerVisible, setPickerVisible] = useState(false);
  // See useModalOpenGuard.ts - the country picker opens synchronously
  // from a button press, the exact shape of bug that hit
  // AddExpenseModal without this guard.
  const canClosePicker = useModalOpenGuard(pickerVisible);
  const [countrySearch, setCountrySearch] = useState('');
  const [creating, setCreating] = useState(false);

  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joining, setJoining] = useState(false);

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) {
      return COUNTRIES;
    }
    return COUNTRIES.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.currency.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q),
    );
  }, [countrySearch]);

  const openPicker = () => {
    if (creating) {
      return;
    }
    setCountrySearch('');
    setPickerVisible(true);
  };

  // Throws on guard/validation/write failure (and shows its own error
  // toast before throwing) purely so callers can no-op on failure via
  // .catch(() => {}) - the CTA button's onPress doesn't need to do
  // anything else with the rejection since the toast already told the
  // user what went wrong.
  const handleCreateGroup = async () => {
    if (creating) {
      throw new Error('already-loading');
    }
    const trimmed = groupName.trim();
    if (trimmed.length < 3) {
      Toast.show({
        type: 'error',
        text1: 'Group name too short',
        text2: 'Please enter at least 3 characters.',
      });
      throw new Error('name-too-short');
    }
    setCreating(true);
    try {
      const group = await createGroup(trimmed, country.currency, groupType);
      Toast.show({
        type: 'success',
        text1:
          groupType === 'personal' ? 'Personal list created' : 'Group created',
        text2:
          groupType === 'personal' ? undefined : `Join code: ${group.joinCode}`,
      });
      setGroupName('');
      setCountry(DEFAULT_COUNTRY);
      setGroupType('group');
      onDone?.();
      await enterGroup(group.id, group.currency, group.type);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not create group',
        text2: error?.message,
      });
      throw error;
    } finally {
      setCreating(false);
    }
  };

  const handleJoinByCode = async () => {
    if (joining) {
      throw new Error('already-loading');
    }
    if (!joinCodeInput.trim()) {
      Toast.show({
        type: 'info',
        text1: 'Enter a join code',
        text2: 'Ask a group member for their 6-character code.',
      });
      throw new Error('empty-code');
    }
    setJoining(true);
    try {
      const {group, alreadyMember, requestPending} = await joinGroupByCode(
        joinCodeInput.trim(),
      );
      setJoinCodeInput('');
      if (alreadyMember) {
        // Unchanged behaviour for someone re-entering a group they're
        // already in - straight into the group, no request involved.
        onDone?.();
        await enterGroup(group.id, group.currency, group.type);
      } else if (requestPending) {
        // New members now need the admin's OK first - see joinGroup() in
        // firestoreLedger.ts. There's nothing to enter yet, so stay on
        // this screen instead of navigating into a group they're not a
        // member of.
        onDone?.();
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
      throw error;
    } finally {
      setJoining(false);
    }
  };

  return (
    <View style={styles.formRoot}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        enableOnAndroid
        extraScrollHeight={20}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>Create a new group</Text>
        <GlassCard style={styles.card}>
          <View style={styles.typeToggleRow}>
            {(['group', 'personal'] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.typeToggleSeg,
                  groupType === t && styles.typeToggleSegActive,
                ]}
                disabled={creating}
                onPress={() => setGroupType(t)}>
                <Text
                  style={[
                    styles.typeToggleText,
                    groupType === t && styles.typeToggleTextActive,
                  ]}>
                  {t === 'group' ? 'Group' : 'Personal'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.hint}>
            {groupType === 'personal'
              ? "Just for tracking your own spending - it's only you, no one else can join, and there's nothing to split or settle."
              : 'Add other people later with a join code or QR - expenses get split between everyone in it.'}
          </Text>
          <TextInput
            placeholder={
              groupType === 'personal' ? 'e.g. My expenses' : 'e.g. Trip to Goa'
            }
            style={styles.input}
            value={groupName}
            onChangeText={setGroupName}
            placeholderTextColor={theme.color.inkFaint}
            editable={!creating}
          />
          <Text style={styles.fieldLabel}>Country / Currency</Text>
          <TouchableOpacity
            style={styles.countrySelector}
            disabled={creating}
            onPress={openPicker}>
            <Text style={styles.countryFlag}>{country.flag}</Text>
            <View style={styles.countryTextWrap}>
              <Text style={styles.countryName} numberOfLines={1}>
                {country.name}
              </Text>
              <Text style={styles.countrySub}>
                {country.currency} · {country.symbol}
              </Text>
            </View>
            <Text style={styles.countryChevron}>▾</Text>
          </TouchableOpacity>
          {groupType === 'group' && (
            <Text style={styles.hint}>
              {isUpiCurrency(country.currency)
                ? 'Settle up opens GPay/PhonePe/Paytm directly with the amount filled in.'
                : 'UPI isn\'t available outside India, so settle up will be a manual "mark as paid" instead.'}
            </Text>
          )}
          <TouchableOpacity
            style={styles.ctaBtn}
            disabled={creating}
            activeOpacity={0.85}
            onPress={() => {
              handleCreateGroup().catch(() => {});
            }}>
            <GradientView
              colors={theme.gradient.fab}
              style={[styles.ctaBtnFill, creating && styles.ctaBtnDisabled]}>
              <Text style={styles.ctaBtnText}>
                {creating
                  ? 'Creating…'
                  : groupType === 'personal'
                  ? 'Create list'
                  : 'Create group'}
              </Text>
            </GradientView>
          </TouchableOpacity>
        </GlassCard>

        {groupType === 'group' && (
          <>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <Text style={styles.sectionLabel}>Join with a code</Text>
            <GlassCard style={styles.card}>
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="e.g. 7K3PXQ"
                value={joinCodeInput}
                maxLength={6}
                autoCapitalize="characters"
                onChangeText={t => setJoinCodeInput(t.toUpperCase())}
                placeholderTextColor={theme.color.inkFaint}
                editable={!joining}
              />
              <Text style={styles.hint}>
                Ask a group member for their 6-character join code.
              </Text>
              <TouchableOpacity
                style={styles.ctaBtn}
                disabled={joining}
                activeOpacity={0.85}
                onPress={() => {
                  handleJoinByCode().catch(() => {});
                }}>
                <GradientView
                  colors={theme.gradient.fab}
                  style={[styles.ctaBtnFill, joining && styles.ctaBtnDisabled]}>
                  <Text style={styles.ctaBtnText}>
                    {joining ? 'Joining…' : 'Join group'}
                  </Text>
                </GradientView>
              </TouchableOpacity>
            </GlassCard>
          </>
        )}
      </KeyboardAwareScrollView>

      <Modal
        visible={pickerVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.pickerOverlay}>
          <TouchableWithoutFeedback
            onPress={() => {
              if (canClosePicker()) {
                setPickerVisible(false);
              }
            }}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <GlassCard opaque style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Choose country</Text>
            <TextInput
              placeholder="Search country or currency"
              style={styles.searchInput}
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholderTextColor={theme.color.inkFaint}
              autoFocus
              autoCorrect={false}
            />
            <FlatList
              data={filteredCountries}
              keyExtractor={item => item.code}
              keyboardShouldPersistTaps="handled"
              style={styles.pickerList}
              ListEmptyComponent={
                <Text style={styles.pickerEmpty}>No matching country.</Text>
              }
              renderItem={({item}) => (
                <TouchableOpacity
                  style={styles.pickerRow}
                  onPress={() => {
                    setCountry(item);
                    setPickerVisible(false);
                  }}>
                  <Text style={styles.pickerRowFlag}>{item.flag}</Text>
                  <Text style={styles.pickerRowName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.pickerRowCurrency}>{item.currency}</Text>
                </TouchableOpacity>
              )}
            />
          </GlassCard>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1, backgroundColor: theme.color.ground},
  formRoot: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: {padding: 4},
  headerTitle: {
    color: theme.color.ink,
    fontFamily: DisplayFont.bold,
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  headerSpacer: {width: 30},
  content: {padding: 20, paddingBottom: 60},
  sectionLabel: {
    color: theme.color.inkSoft,
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(12),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  card: {marginBottom: 22},
  typeToggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: theme.radius.md,
    padding: 3,
    marginBottom: 16,
  },
  typeToggleSeg: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: theme.radius.md - 3,
    alignItems: 'center',
  },
  typeToggleSegActive: {backgroundColor: theme.color.blue},
  typeToggleText: {
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: theme.color.inkFaint,
  },
  typeToggleTextActive: {color: theme.color.ink},
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    padding: 12,
    marginBottom: 16,
    color: theme.color.ink,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(15),
  },
  // Matches the mockup's .code-input - a join code is a code, not prose,
  // so it gets the mono face plus generous letter-spacing and a centered
  // layout instead of sharing the group-name field's plain text style.
  codeInput: {
    fontFamily: MonoFont,
    fontSize: moderateScale(18),
    letterSpacing: 3,
    textAlign: 'center',
  },
  fieldLabel: {
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(12),
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: theme.color.inkFaint,
    marginBottom: 8,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    padding: 12,
  },
  countryFlag: {fontSize: moderateScale(22), marginRight: 10},
  countryTextWrap: {flex: 1},
  countryName: {
    fontFamily: BodyFont.semibold,
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: theme.color.ink,
  },
  countrySub: {
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(12),
    color: theme.color.inkFaint,
    marginTop: 1,
  },
  countryChevron: {
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(14),
    color: theme.color.inkFaint,
    marginLeft: 8,
  },
  hint: {
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(12),
    color: theme.color.inkFaint,
    marginTop: 8,
    marginBottom: 12,
  },
  ctaBtn: {
    borderRadius: theme.radius.pill,
    marginTop: 16,
    overflow: 'hidden',
  },
  ctaBtnFill: {
    width: '100%',
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
  },
  ctaBtnDisabled: {opacity: 0.6},
  ctaBtnText: {
    color: theme.color.onAccent,
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(15),
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
    gap: 12,
  },
  dividerLine: {flex: 1, height: 1, backgroundColor: theme.color.border},
  dividerText: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(11.5),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6,5,12,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerCard: {width: '88%', maxHeight: '75%'},
  pickerTitle: {
    fontFamily: DisplayFont.bold,
    fontSize: moderateScale(18),
    marginBottom: 14,
    fontWeight: '700',
    textAlign: 'center',
    color: theme.color.ink,
  },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    padding: 12,
    marginBottom: 10,
    color: theme.color.ink,
  },
  pickerList: {flexGrow: 0},
  pickerEmpty: {
    color: theme.color.inkFaint,
    textAlign: 'center',
    paddingVertical: 20,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  pickerRowFlag: {fontSize: moderateScale(20), marginRight: 10},
  pickerRowName: {
    flex: 1,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(14),
    color: theme.color.ink,
  },
  pickerRowCurrency: {
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: theme.color.inkFaint,
    marginLeft: 8,
  },
});

// The original full-page route (kept so nothing that navigates to
// 'CreateJoinGroup' breaks). The dashboard and Groups list now open the
// same form in a genie panel instead - see NewGroupPanel.
const CreateJoinGroup = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const user = auth().currentUser;
  const {enterGroup, upiPromptVisible, dismissUpiPrompt} =
    useEnterGroup(navigation);
  return (
    <View style={styles.flex}>
      <View style={[styles.header, {paddingTop: insets.top + 12}]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
          style={styles.backBtn}>
          <ChevronLeft size={22} color={theme.color.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create or join a group</Text>
        <View style={styles.headerSpacer} />
      </View>
      <CreateJoinGroupForm enterGroup={enterGroup} />
      <UpiPromptModal
        visible={upiPromptVisible}
        uid={user?.uid || ''}
        onSkip={dismissUpiPrompt}
        onSaved={dismissUpiPrompt}
      />
    </View>
  );
};

export default CreateJoinGroup;
