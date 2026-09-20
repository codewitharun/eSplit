// src/component/AddExpenseModal.tsx
// Replaces the two plain TextInputs + "Add New" button in the old
// ExpenseTracker.js with the full split engine: pick a category, pick a
// split type, and (for anything other than equal) enter each member's
// exact amount / percentage / share weight, validated live against the
// same rules the Firestore layer enforces.

import {X} from 'lucide-react-native';
import React, {useEffect, useMemo, useState} from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {useModalOpenGuard} from '../hooks/useModalOpenGuard';
import {currencySymbol, formatMoney} from '../services/ledger/currency';
import {addExpense, editExpense} from '../services/ledger/firestoreLedger';
import {
  computeSplits,
  round2,
  validateSplitInput,
} from '../services/ledger/splitEngine';
import {
  EXPENSE_CATEGORIES,
  Expense,
  ExpenseCategory,
  GroupMember,
  SplitType,
} from '../services/ledger/types';
import Toast from '../services/toast';
import {BodyFont, DisplayFont, moderateScale} from '../utils/fonts';
import theme from '../utils/theme';
import Chip from './glass/Chip';
import GlassCard from './glass/GlassCard';
import SwipeToConfirm from './glass/SwipeToConfirm';

interface Props {
  visible: boolean;
  onClose: () => void;
  groupId: string;
  members: GroupMember[];
  currentUid: string;
  // ISO currency code of the group this expense belongs to - drives every
  // ₹/$/€ symbol shown here and what gets written to the new expense.
  // Defaults to INR for any caller that hasn't been updated to pass it.
  groupCurrency?: string;
  // When set, the modal opens pre-filled with this expense's data and
  // saves via editExpense() instead of creating a new one via addExpense().
  editingExpense?: Expense | null;
}

const SPLIT_TYPES: {key: SplitType; label: string}[] = [
  {key: 'equal', label: 'Equal'},
  {key: 'exact', label: 'Exact'},
  {key: 'percentage', label: 'Percentage'},
  {key: 'shares', label: 'Shares'},
];

// Reconstructs the per-member text-input values shown for exact/percentage/
// shares splits from an existing expense's `splitParams`, so re-opening an
// expense for editing shows the same numbers that produced its `shares`.
function perMemberInputFromExpense(expense: Expense): Record<string, string> {
  const source =
    expense.splitType === 'exact'
      ? expense.splitParams?.exactAmounts
      : expense.splitType === 'percentage'
      ? expense.splitParams?.percentages
      : expense.splitType === 'shares'
      ? expense.splitParams?.shares
      : undefined;
  if (!source) {
    return {};
  }
  const out: Record<string, string> = {};
  Object.keys(source).forEach(uid => {
    out[uid] = String(source[uid]);
  });
  return out;
}

// A short, human-readable log line for the expense's editHistory - not
// exhaustive (it doesn't diff exact per-member amounts), just enough for
// someone reviewing the audit trail to see what changed at a glance.
function buildChangeSummary(
  before: Expense,
  after: {
    description: string;
    amount: number;
    category: ExpenseCategory;
    paidBy: string;
    splitType: SplitType;
    participantUids: string[];
  },
): string {
  const parts: string[] = [];
  if (before.description !== after.description) {
    parts.push(
      `description: "${before.description}" -> "${after.description}"`,
    );
  }
  if (before.amount !== after.amount) {
    parts.push(
      `amount: Rs.${before.amount.toFixed(2)} -> Rs.${after.amount.toFixed(2)}`,
    );
  }
  if (before.category !== after.category) {
    parts.push(`category: ${before.category} -> ${after.category}`);
  }
  if (before.paidBy !== after.paidBy) {
    parts.push('payer changed');
  }
  if (before.splitType !== after.splitType) {
    parts.push(`split: ${before.splitType} -> ${after.splitType}`);
  } else if (
    Object.keys(before.shares).sort().join(',') !==
    [...after.participantUids].sort().join(',')
  ) {
    parts.push('participants changed');
  }
  return parts.length ? parts.join('; ') : 'Edited expense';
}

// Caps a single per-member exact/percentage entry so it can never be
// typed as more than what's actually left to assign - not just the whole
// expense total, but the total minus whatever the *other* free-input
// people already have entered. Example: a ₹2000 expense where someone
// already has ₹1600 typed in only leaves ₹400 of room for everyone else,
// so a stray "2000" in the next field snaps to ₹400 instead of silently
// accepting a number that could never fit. Shares have no such ceiling
// (they're relative weights, not an absolute amount), so those pass
// through untouched.
function clampPerMemberValue(
  uid: string,
  raw: string,
  splitType: SplitType,
  cap: number,
  otherFreeUids: string[],
  inputs: Record<string, string>,
): string {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (splitType === 'shares') {
    return cleaned;
  }
  const othersSum = otherFreeUids
    .filter(id => id !== uid)
    .reduce((sum, id) => sum + (parseFloat(inputs[id]) || 0), 0);
  const remainingCap = Math.max(round2(cap - othersSum), 0);
  const parsed = parseFloat(cleaned);
  if (!cap || Number.isNaN(parsed) || parsed <= remainingCap) {
    return cleaned;
  }
  // Reformat to whatever's actually left, but only once the number is
  // complete enough to compare (avoids clobbering "40." mid-type) -
  // parseFloat already ignores a trailing ".", so this only fires once
  // the typed number itself exceeds what's left.
  return String(remainingCap % 1 === 0 ? remainingCap : round2(remainingCap));
}

const AddExpenseModal: React.FC<Props> = ({
  visible,
  onClose,
  groupId,
  members,
  currentUid,
  groupCurrency,
  editingExpense,
}) => {
  const isEditMode = !!editingExpense;
  const moneySymbol = currencySymbol(groupCurrency);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [paidBy, setPaidBy] = useState(currentUid);
  const [participantUids, setParticipantUids] = useState<string[]>(
    members.map(m => m.uid),
  );
  const [perMemberInput, setPerMemberInput] = useState<Record<string, string>>(
    {},
  );
  const [submitting, setSubmitting] = useState(false);
  // See useModalOpenGuard.ts - swallows the phantom close Android
  // can replay onto this modal's backdrop/close button the instant
  // it opens.
  const canClose = useModalOpenGuard(visible);

  const amountValue = parseFloat(amount) || 0;

  const toggleParticipant = (uid: string) => {
    setParticipantUids(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid],
    );
  };

  // For exact/percentage splits, whether the payer is one of the people
  // this expense is shared with. When they are, we don't ask "what's the
  // payer's share" at all - that's the exact question that reads to a
  // non-technical user as "who does this money belong to", and gets
  // answered backwards ("Manvi paid, so it's hers, so mine is zero").
  // Instead we only ask what *everyone else* owes back, and fill the
  // payer's own share in automatically as whatever's left - matching how
  // people actually think about a bill ("I owe Manvi ₹60"), not how the
  // ledger stores it (a share of the total cost).
  const payerIsParticipant = participantUids.includes(paidBy);
  const usesOwedToPayerFraming =
    (splitType === 'exact' || splitType === 'percentage') && payerIsParticipant;
  const nonPayerUids = usesOwedToPayerFraming
    ? participantUids.filter(uid => uid !== paidBy)
    : participantUids;
  const splitCap = splitType === 'percentage' ? 100 : amountValue;
  const nonPayerSum = nonPayerUids.reduce(
    (sum, uid) => sum + (parseFloat(perMemberInput[uid]) || 0),
    0,
  );
  // What the payer's own share works out to once everyone else's amount
  // is subtracted from the total - can go negative if the others add up
  // to more than the whole expense, which is exactly the case liveCheck
  // below blocks Save on.
  const derivedPayerValue = round2(splitCap - nonPayerSum);
  const payerName =
    paidBy === currentUid
      ? 'you'
      : members.find(m => m.uid === paidBy)?.displayName || 'the payer';

  const buildSplitParams = () => {
    if (splitType === 'equal') {
      return undefined;
    }
    const values: Record<string, number> = {};
    if (usesOwedToPayerFraming) {
      nonPayerUids.forEach(uid => {
        values[uid] = parseFloat(perMemberInput[uid]) || 0;
      });
      values[paidBy] = derivedPayerValue;
    } else {
      participantUids.forEach(uid => {
        values[uid] = parseFloat(perMemberInput[uid]) || 0;
      });
    }
    if (splitType === 'exact') {
      return {exactAmounts: values};
    }
    if (splitType === 'percentage') {
      return {percentages: values};
    }
    return {shares: values};
  };

  const liveCheck = useMemo(() => {
    if (!amountValue || participantUids.length === 0) {
      return {valid: false};
    }
    if (usesOwedToPayerFraming) {
      const missing = nonPayerUids.some(
        uid => !perMemberInput[uid] && perMemberInput[uid] !== '0',
      );
      if (missing) {
        return {
          valid: false,
          error:
            splitType === 'percentage'
              ? 'Enter a % for everyone except the payer.'
              : 'Enter an amount for everyone except the payer.',
        };
      }
      if (derivedPayerValue < -0.004) {
        const unit = splitType === 'percentage' ? '%' : moneySymbol;
        return {
          valid: false,
          error: `${unit}${Math.abs(
            derivedPayerValue,
          )} more than the ${unit}${round2(
            splitCap,
          )} total — lower someone's amount.`,
        };
      }
      return {valid: true};
    }
    return validateSplitInput(
      amountValue,
      splitType,
      participantUids,
      buildSplitParams(),
      groupCurrency,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountValue, splitType, participantUids, perMemberInput, paidBy]);

  // The actual per-person rupee shares for the current input, reusing the
  // exact function the save path calls - so the "who owes whom" preview
  // and the per-row ₹ conversions below can never show something
  // different from what pressing Save would actually record.
  const splitPreview = useMemo(() => {
    if (!liveCheck.valid || !amountValue || participantUids.length === 0) {
      return null;
    }
    try {
      return computeSplits(
        amountValue,
        splitType,
        participantUids,
        buildSplitParams(),
      );
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    liveCheck.valid,
    amountValue,
    splitType,
    participantUids,
    perMemberInput,
  ]);

  // Turns the computed shares into plain-English "who owes whom" lines -
  // this is the actual outcome of paidBy + the split, made visible before
  // saving instead of something people have to go check the Balances tab
  // to discover (or, worse, get wrong without ever noticing).
  const owesLines = useMemo(() => {
    if (!splitPreview) {
      return [];
    }
    const nameOf = (uid: string) =>
      uid === currentUid
        ? 'You'
        : members.find(m => m.uid === uid)?.displayName || 'Someone';
    const lines: string[] = [];
    participantUids.forEach(uid => {
      if (uid === paidBy) {
        return;
      }
      const share = splitPreview[uid] || 0;
      if (share <= 0.004) {
        return;
      }
      const debtor = nameOf(uid);
      const payerLabel = paidBy === currentUid ? 'you' : nameOf(paidBy);
      const verb = uid === currentUid ? 'owe' : 'owes';
      lines.push(
        `${debtor} ${verb} ${payerLabel} ${formatMoney(share, groupCurrency)}`,
      );
    });
    return lines;
  }, [
    splitPreview,
    participantUids,
    paidBy,
    currentUid,
    members,
    groupCurrency,
  ]);

  const reset = () => {
    setDescription('');
    setAmount('');
    setCategory('other');
    setSplitType('equal');
    setPaidBy(currentUid);
    setParticipantUids(members.map(m => m.uid));
    setPerMemberInput({});
  };

  // Pre-fill the form from the expense being edited whenever the modal
  // opens in edit mode, and fall back to a blank form when it opens to add
  // a new expense. Keyed on `visible` (not just `editingExpense`) so state
  // isn't quietly rewritten while the sheet is closed/animating away.
  useEffect(() => {
    if (!visible) {
      return;
    }
    if (editingExpense) {
      setDescription(editingExpense.description);
      setAmount(String(editingExpense.amount));
      setCategory(editingExpense.category);
      setSplitType(editingExpense.splitType);
      setPaidBy(editingExpense.paidBy);
      setParticipantUids(Object.keys(editingExpense.shares));
      setPerMemberInput(perMemberInputFromExpense(editingExpense));
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editingExpense]);

  const handleSubmit = async () => {
    if (!description.trim()) {
      Toast.show({
        type: 'info',
        text1: 'Add a description',
        text2: 'What was this expense for?',
      });
      throw new Error('missing-description');
    }
    if (!liveCheck.valid) {
      Toast.show({
        type: 'error',
        text1: 'Split doesn’t add up',
        text2: liveCheck.error || 'Check the amounts entered for each person.',
      });
      throw new Error('invalid-split');
    }
    setSubmitting(true);
    try {
      if (isEditMode && editingExpense?.id) {
        const nextValues = {
          description: description.trim(),
          amount: amountValue,
          category,
          paidBy,
          splitType,
          participantUids,
        };
        await editExpense(
          groupId,
          editingExpense.id,
          currentUid,
          {...nextValues, splitParams: buildSplitParams()},
          buildChangeSummary(editingExpense, nextValues),
        );
        Toast.show({type: 'success', text1: 'Expense updated'});
      } else {
        await addExpense({
          groupId,
          description: description.trim(),
          amount: amountValue,
          currency: groupCurrency || 'INR',
          category,
          paidBy,
          createdBy: currentUid,
          splitType,
          participantUids,
          splitParams: buildSplitParams(),
        });
        Toast.show({type: 'success', text1: 'Expense added'});
      }
      reset();
      onClose();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: isEditMode
          ? 'Could not update expense'
          : 'Could not add expense',
        text2: error?.message,
      });
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
            disabled={submitting}
            onPress={() => {
              if (canClose()) {
                onClose();
              }
            }}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <X size={20} color={theme.color.ink} />
          </TouchableOpacity>
          <GlassCard opaque style={styles.sheet}>
            <KeyboardAwareScrollView
              showsVerticalScrollIndicator={false}
              enableOnAndroid
              extraScrollHeight={24}
              keyboardShouldPersistTaps="handled">
              <Text style={styles.title}>
                {isEditMode ? 'Edit expense' : 'New expense'}
              </Text>

              <TextInput
                style={styles.input}
                placeholder="What was it for?"
                placeholderTextColor={theme.color.inkFaint}
                value={description}
                onChangeText={setDescription}
              />
              <TextInput
                style={styles.input}
                placeholder={`Amount (${moneySymbol})`}
                placeholderTextColor={theme.color.inkFaint}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={t => setAmount(t.replace(/[^0-9.]/g, ''))}
              />

              <Text style={styles.sectionLabel}>Category</Text>
              <View style={styles.rowWrap}>
                {EXPENSE_CATEGORIES.map(c => (
                  <Chip
                    key={c.key}
                    label={`${c.icon} ${c.label}`}
                    active={category === c.key}
                    onPress={() => setCategory(c.key)}
                  />
                ))}
              </View>

              {/* With only one member (a personal list, or a real group
              everyone else has left), paidBy/participantUids already
              default to that single uid and every split type produces
              the same result - full amount, one person - so these
              pickers have nothing to actually decide. Hiding them isn't
              just tidiness: showing a "Paid by" chip row with one chip
              you can't meaningfully change reads as broken UI, and users
              specifically asked for personal lists to not look like a
              group-splitting form at all. */}
              {members.length > 1 && (
                <>
                  <Text style={styles.sectionLabel}>Paid by</Text>
                  <View style={styles.rowWrap}>
                    {members.map(m => (
                      <Chip
                        key={m.uid}
                        label={m.uid === currentUid ? 'You' : m.displayName}
                        active={paidBy === m.uid}
                        onPress={() => setPaidBy(m.uid)}
                      />
                    ))}
                  </View>

                  <Text style={styles.sectionLabel}>Split</Text>
                  <View style={styles.rowWrap}>
                    {SPLIT_TYPES.map(s => (
                      <Chip
                        key={s.key}
                        label={s.label}
                        active={splitType === s.key}
                        onPress={() => setSplitType(s.key)}
                      />
                    ))}
                  </View>

                  <Text style={styles.sectionLabel}>Between</Text>

                  <View style={styles.rowWrap}>
                    {members.map(m => (
                      <Chip
                        key={m.uid}
                        label={m.uid === currentUid ? 'You' : m.displayName}
                        active={participantUids.includes(m.uid)}
                        onPress={() => toggleParticipant(m.uid)}
                      />
                    ))}
                  </View>
                </>
              )}

              {splitType !== 'equal' && (
                <View style={styles.perMemberBlock}>
                  <Text style={styles.hintText}>
                    {splitType === 'exact' &&
                      (usesOwedToPayerFraming
                        ? `Enter how much of this expense was for each person. ${
                            paidBy === currentUid ? 'Your' : `${payerName}'s`
                          } own part fills in automatically below.`
                        : 'Enter how much of this expense was for each person.')}
                    {splitType === 'percentage' &&
                      (usesOwedToPayerFraming
                        ? `Enter what % of this expense was for each person. ${
                            paidBy === currentUid ? 'Your' : `${payerName}'s`
                          } own part fills in automatically below.`
                        : 'Enter what % of this expense was for each person.')}
                    {splitType === 'shares' &&
                      `Give each person a weight — bigger number, bigger share of the cost. The ${moneySymbol} amount that comes out of it is shown below.`}
                  </Text>
                  {nonPayerUids.map(uid => {
                    const member = members.find(m => m.uid === uid);
                    const converted =
                      splitType !== 'exact' && splitPreview
                        ? splitPreview[uid]
                        : undefined;
                    return (
                      <View key={uid} style={styles.perMemberRow}>
                        <Text style={styles.perMemberName}>
                          {uid === currentUid ? 'You' : member?.displayName}
                        </Text>
                        <View style={styles.perMemberRight}>
                          <TextInput
                            style={styles.perMemberInput}
                            keyboardType="decimal-pad"
                            placeholder={
                              splitType === 'percentage'
                                ? '%'
                                : splitType === 'shares'
                                ? 'shares'
                                : moneySymbol
                            }
                            placeholderTextColor={theme.color.inkFaint}
                            value={perMemberInput[uid] || ''}
                            onChangeText={t =>
                              setPerMemberInput(prev => ({
                                ...prev,
                                [uid]: clampPerMemberValue(
                                  uid,
                                  t,
                                  splitType,
                                  splitCap,
                                  nonPayerUids,
                                  perMemberInput,
                                ),
                              }))
                            }
                          />
                          {converted != null && (
                            <Text style={styles.convertedText}>
                              = {formatMoney(converted, groupCurrency)}
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                  {usesOwedToPayerFraming && (
                    <View style={styles.perMemberRow}>
                      <Text style={styles.perMemberName}>
                        {paidBy === currentUid ? 'You' : payerName} (paid) — own
                        part
                      </Text>
                      <View style={styles.perMemberRight}>
                        <Text
                          style={[
                            styles.convertedText,
                            derivedPayerValue < -0.004 && {
                              color: theme.color.rose,
                            },
                          ]}>
                          {splitType === 'percentage'
                            ? `${derivedPayerValue}%`
                            : formatMoney(derivedPayerValue, groupCurrency)}
                        </Text>
                      </View>
                    </View>
                  )}
                  {amountValue > 0 && splitType !== 'shares' && (
                    <Text
                      style={[
                        styles.statusText,
                        liveCheck.valid
                          ? styles.statusOk
                          : styles.statusPending,
                      ]}>
                      {liveCheck.valid
                        ? '✓ Fully assigned'
                        : (liveCheck as any).error}
                    </Text>
                  )}
                </View>
              )}

              {owesLines.length > 0 && (
                <View style={styles.owesBlock}>
                  {owesLines.map((line, i) => (
                    <Text key={i} style={styles.owesText}>
                      → {line}
                    </Text>
                  ))}
                </View>
              )}
              {splitPreview && owesLines.length === 0 && (
                <View style={styles.owesBlock}>
                  <Text style={styles.owesTextNeutral}>
                    → No one owes anyone for this — it'll be recorded as{' '}
                    {paidBy === currentUid ? 'your own' : 'their own'} personal
                    spending.
                  </Text>
                </View>
              )}

              <View style={styles.actions}>
                <SwipeToConfirm
                  style={styles.swipeConfirm}
                  label={
                    isEditMode
                      ? 'Slide to save changes'
                      : 'Slide to add expense'
                  }
                  pendingLabel={isEditMode ? 'Saving…' : 'Adding…'}
                  successLabel={isEditMode ? 'Saved!' : 'Added!'}
                  disabled={submitting}
                  onConfirm={handleSubmit}
                />
              </View>
            </KeyboardAwareScrollView>
          </GlassCard>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  gestureRoot: {flex: 1},
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6,5,12,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  title: {
    color: theme.color.ink,
    fontFamily: DisplayFont.bold,
    fontSize: moderateScale(19),
    fontWeight: '700',
    marginBottom: 16,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.color.ink,
    marginBottom: 12,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(15),
  },
  sectionLabel: {
    color: theme.color.inkSoft,
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(12),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 6,
  },
  rowWrap: {flexDirection: 'row', flexWrap: 'wrap'},
  hintText: {
    color: theme.color.inkFaint,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(12),
    lineHeight: moderateScale(16),
    marginBottom: 8,
    marginTop: -2,
  },
  perMemberBlock: {marginTop: 8, marginBottom: 4},
  perMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  perMemberName: {
    color: theme.color.ink,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(14),
  },
  perMemberRight: {alignItems: 'flex-end'},
  perMemberInput: {
    width: 90,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: theme.color.ink,
    textAlign: 'right',
  },
  convertedText: {
    color: theme.color.teal,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(11.5),
    marginTop: 3,
  },
  errorText: {
    color: theme.color.rose,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(12.5),
    marginTop: 6,
  },
  statusText: {
    fontFamily: BodyFont.semibold,
    fontSize: moderateScale(12.5),
    marginTop: 6,
    fontWeight: '600',
  },
  statusOk: {color: theme.color.green},
  statusPending: {color: theme.color.amber},
  owesBlock: {marginTop: 4, marginBottom: 4, gap: 3},
  owesText: {
    color: theme.color.rose,
    fontFamily: BodyFont.semibold,
    fontSize: moderateScale(13),
    fontWeight: '600',
  },
  owesTextNeutral: {
    color: theme.color.green,
    fontFamily: BodyFont.semibold,
    fontSize: moderateScale(13),
    fontWeight: '600',
  },
  actions: {marginTop: 20, marginBottom: 8},
  // Floating above the sheet, outside the card, centered - replaces the
  // old in-row Cancel button now that the slider owns the full width.
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
  swipeConfirm: {
    width: '90%',
    alignSelf: 'center',
  },
  submitBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.blue,
    alignItems: 'center',
  },
  submitText: {
    color: theme.color.onAccent,
    fontFamily: BodyFont.bold,
    fontWeight: '700',
  },
});

export default AddExpenseModal;
