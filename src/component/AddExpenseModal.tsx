// src/component/AddExpenseModal.tsx
// Replaces the two plain TextInputs + "Add New" button in the old
// ExpenseTracker.js with the full split engine: pick a category, pick a
// split type, and (for anything other than equal) enter each member's
// exact amount / percentage / share weight, validated live against the
// same rules the Firestore layer enforces.

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
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import Toast from 'react-native-toast-message';
import {addExpense, editExpense} from '../services/ledger/firestoreLedger';
import {validateSplitInput} from '../services/ledger/splitEngine';
import {
  EXPENSE_CATEGORIES,
  Expense,
  ExpenseCategory,
  GroupMember,
  SplitType,
} from '../services/ledger/types';
import Chip from './glass/Chip';
import GlassCard from './glass/GlassCard';
import theme from '../utils/theme';
import {haptics} from '../utils/haptics';

interface Props {
  visible: boolean;
  onClose: () => void;
  groupId: string;
  members: GroupMember[];
  currentUid: string;
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

const AddExpenseModal: React.FC<Props> = ({
  visible,
  onClose,
  groupId,
  members,
  currentUid,
  editingExpense,
}) => {
  const isEditMode = !!editingExpense;
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

  const amountValue = parseFloat(amount) || 0;

  const toggleParticipant = (uid: string) => {
    setParticipantUids(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid],
    );
  };

  const buildSplitParams = () => {
    if (splitType === 'equal') {
      return undefined;
    }
    const values: Record<string, number> = {};
    participantUids.forEach(uid => {
      values[uid] = parseFloat(perMemberInput[uid]) || 0;
    });
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
    return validateSplitInput(
      amountValue,
      splitType,
      participantUids,
      buildSplitParams(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountValue, splitType, participantUids, perMemberInput]);

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
      return;
    }
    if (!liveCheck.valid) {
      Toast.show({
        type: 'error',
        text1: 'Split doesn’t add up',
        text2: liveCheck.error || 'Check the amounts entered for each person.',
      });
      return;
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
        haptics.success();
        Toast.show({type: 'success', text1: 'Expense updated'});
      } else {
        await addExpense({
          groupId,
          description: description.trim(),
          amount: amountValue,
          currency: 'INR',
          category,
          paidBy,
          createdBy: currentUid,
          splitType,
          participantUids,
          splitParams: buildSplitParams(),
        });
        haptics.success();
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
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
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
              placeholder="Amount (₹)"
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

            {splitType !== 'equal' && (
              <View style={styles.perMemberBlock}>
                {participantUids.map(uid => {
                  const member = members.find(m => m.uid === uid);
                  return (
                    <View key={uid} style={styles.perMemberRow}>
                      <Text style={styles.perMemberName}>
                        {uid === currentUid ? 'You' : member?.displayName}
                      </Text>
                      <TextInput
                        style={styles.perMemberInput}
                        keyboardType="decimal-pad"
                        placeholder={
                          splitType === 'percentage'
                            ? '%'
                            : splitType === 'shares'
                            ? 'shares'
                            : '₹'
                        }
                        placeholderTextColor={theme.color.inkFaint}
                        value={perMemberInput[uid] || ''}
                        onChangeText={t =>
                          setPerMemberInput(prev => ({
                            ...prev,
                            [uid]: t.replace(/[^0-9.]/g, ''),
                          }))
                        }
                      />
                    </View>
                  );
                })}
                {!liveCheck.valid && amountValue > 0 && (
                  <Text style={styles.errorText}>
                    {(liveCheck as any).error}
                  </Text>
                )}
              </View>
            )}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, submitting && {opacity: 0.6}]}
                disabled={submitting}
                onPress={handleSubmit}>
                <Text style={styles.submitText}>
                  {submitting
                    ? 'Saving…'
                    : isEditMode
                    ? 'Save changes'
                    : 'Add expense'}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAwareScrollView>
        </GlassCard>
      </KeyboardAvoidingView>
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
    maxHeight: '88%',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  title: {
    color: theme.color.ink,
    fontSize: 19,
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
    fontSize: 15,
  },
  sectionLabel: {
    color: theme.color.inkSoft,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 6,
  },
  rowWrap: {flexDirection: 'row', flexWrap: 'wrap'},
  perMemberBlock: {marginTop: 8, marginBottom: 4},
  perMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  perMemberName: {color: theme.color.ink, fontSize: 14},
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
  errorText: {color: theme.color.rose, fontSize: 12.5, marginTop: 6},
  actions: {flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 8},
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    alignItems: 'center',
  },
  cancelText: {color: theme.color.inkSoft, fontWeight: '600'},
  submitBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.blue,
    alignItems: 'center',
  },
  submitText: {color: theme.color.onAccent, fontWeight: '700'},
});

export default AddExpenseModal;
