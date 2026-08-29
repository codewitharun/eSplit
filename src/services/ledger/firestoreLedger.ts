// src/services/ledger/firestoreLedger.ts
// Firestore access for the new uid-keyed schema (see types.ts). This
// replaces the direct firestore() calls scattered through GroupCheck.js
// and ExpenseTracker.js against the old Esplitusers/Esplitgroups shape.

import firestore, {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import {computeSplits, validateSplitInput} from './splitEngine';
import {stripUndefined} from './firestoreUtils';
import {
  Expense,
  ExpenseCategory,
  Group,
  GroupMember,
  Settlement,
  SplitParams,
  SplitType,
} from './types';

const db = () => firestore();
const groupsRef = () => db().collection('groups');

function nowIso() {
  return new Date().toISOString();
}

function generateJoinCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

// --- Groups ----------------------------------------------------------------

export async function createGroup(
  user: {uid: string; displayName?: string | null; photoURL?: string | null},
  groupName: string,
  currency = 'INR',
): Promise<Group> {
  const groupRef = groupsRef().doc();
  let joinCode = generateJoinCode();

  // Vanishingly unlikely to collide (33^6 combinations), but check anyway -
  // this is the exact class of bug (weak, uniqueness-unchecked codes) that
  // the old 3-digit group-key suffix had.
  for (let attempt = 0; attempt < 5; attempt++) {
    const clash = await groupsRef()
      .where('joinCode', '==', joinCode)
      .limit(1)
      .get();
    if (clash.empty) {
      break;
    }
    joinCode = generateJoinCode();
  }

  const group: Group = {
    id: groupRef.id,
    name: groupName,
    currency,
    createdBy: user.uid,
    createdAt: nowIso(),
    isLocked: false,
    joinCode,
    memberIds: [user.uid],
  };

  const batch = db().batch();
  batch.set(groupRef, group);
  batch.set(groupRef.collection('members').doc(user.uid), {
    uid: user.uid,
    displayName: user.displayName || 'Member',
    photoUrl: user.photoURL || '',
    joinedAt: nowIso(),
    role: 'admin',
    active: true,
  } as GroupMember);
  await batch.commit();

  await db()
    .collection('users')
    .doc(user.uid)
    .set(
      {groupIds: firestore.FieldValue.arrayUnion(groupRef.id)},
      {merge: true},
    );

  return group;
}

export async function getGroupByJoinCode(
  joinCode: string,
): Promise<Group | null> {
  const snap = await groupsRef()
    .where('joinCode', '==', joinCode.trim().toUpperCase())
    .limit(1)
    .get();
  if (snap.empty) {
    return null;
  }
  return snap.docs[0].data() as Group;
}

export async function joinGroup(
  user: {uid: string; displayName?: string | null; photoURL?: string | null},
  groupId: string,
): Promise<{group: Group; alreadyMember: boolean}> {
  const groupDoc = await groupsRef().doc(groupId).get();
  if (!groupDoc.exists) {
    throw new Error('That group could not be found.');
  }
  const group = groupDoc.data() as Group;
  const alreadyMember = group.memberIds.includes(user.uid);

  if (!alreadyMember) {
    if (group.isLocked) {
      throw new Error(
        'This group is locked by its admin and is not accepting new members right now.',
      );
    }
    const batch = db().batch();
    batch.update(groupDoc.ref, {
      memberIds: firestore.FieldValue.arrayUnion(user.uid),
    });
    batch.set(groupDoc.ref.collection('members').doc(user.uid), {
      uid: user.uid,
      displayName: user.displayName || 'Member',
      photoUrl: user.photoURL || '',
      joinedAt: nowIso(),
      role: 'member',
      active: true,
    } as GroupMember);
    await batch.commit();

    await db()
      .collection('users')
      .doc(user.uid)
      .set({groupIds: firestore.FieldValue.arrayUnion(groupId)}, {merge: true});
  }

  return {
    group: {
      ...group,
      memberIds: alreadyMember
        ? group.memberIds
        : [...group.memberIds, user.uid],
    },
    alreadyMember,
  };
}

export async function getUserGroups(uid: string): Promise<Group[]> {
  const userDoc = await db().collection('users').doc(uid).get();
  const groupIds: string[] = userDoc.exists
    ? userDoc.data()?.groupIds || []
    : [];
  if (groupIds.length === 0) {
    return [];
  }
  const docs = await Promise.all(groupIds.map(id => groupsRef().doc(id).get()));
  return docs.filter(d => d.exists).map(d => d.data() as Group);
}

export interface GroupSnapshot {
  members: GroupMember[];
  expenses: Expense[];
  settlements: Settlement[];
}

// One-time read (not a live listener) of everything needed to compute a
// group's balances - used by the Groups dashboard to show a quick
// owed/owe summary per group without keeping N live subscriptions open
// just for a list screen.
export async function getGroupSnapshot(
  groupId: string,
): Promise<GroupSnapshot> {
  const groupRef = groupsRef().doc(groupId);
  const [membersSnap, expensesSnap, settlementsSnap] = await Promise.all([
    groupRef.collection('members').get(),
    groupRef.collection('expenses').get(),
    groupRef.collection('settlements').get(),
  ]);
  return {
    members: membersSnap.docs.map(d => d.data() as GroupMember),
    expenses: expensesSnap.docs.map(d => ({
      ...(d.data() as Expense),
      id: d.id,
    })),
    settlements: settlementsSnap.docs.map(d => ({
      ...(d.data() as Settlement),
      id: d.id,
    })),
  };
}

export function subscribeGroup(
  groupId: string,
  onChange: (group: Group | null) => void,
): () => void {
  return groupsRef()
    .doc(groupId)
    .onSnapshot(doc => onChange(doc.exists ? (doc.data() as Group) : null));
}

export function subscribeGroupMembers(
  groupId: string,
  onChange: (members: GroupMember[]) => void,
): () => void {
  return groupsRef()
    .doc(groupId)
    .collection('members')
    .onSnapshot(snap => {
      onChange(snap.docs.map(d => d.data() as GroupMember));
    });
}

// --- Expenses ----------------------------------------------------------------

export interface AddExpenseInput {
  groupId: string;
  description: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  paidBy: string;
  createdBy: string;
  splitType: SplitType;
  participantUids: string[];
  splitParams?: SplitParams;
  isRecurring?: boolean;
  recurrenceIntervalDays?: number;
}

export async function addExpense(input: AddExpenseInput): Promise<void> {
  const check = validateSplitInput(
    input.amount,
    input.splitType,
    input.participantUids,
    input.splitParams,
  );
  if (!check.valid) {
    throw new Error(check.error);
  }
  const shares = computeSplits(
    input.amount,
    input.splitType,
    input.participantUids,
    input.splitParams,
  );

  const groupRef = groupsRef().doc(input.groupId);
  const expenseRef = groupRef.collection('expenses').doc();

  const expense: Expense = {
    id: expenseRef.id,
    description: input.description,
    amount: input.amount,
    currency: input.currency,
    category: input.category,
    paidBy: input.paidBy,
    splitType: input.splitType,
    splitParams: input.splitParams,
    shares,
    isRecurring: !!input.isRecurring,
    recurrenceIntervalDays: input.recurrenceIntervalDays,
    createdBy: input.createdBy,
    createdAt: nowIso(),
  };

  // Membership is no longer auto-locked on the first expense - see
  // setGroupLocked() below. An admin locks/unlocks the group explicitly
  // instead, so a group isn't sealed off before everyone's had a chance
  // to join.
  await expenseRef.set(
    stripUndefined(expense as unknown as Record<string, unknown>),
  );
}

// Admin-only: lock or unlock a group against new members. Locking used to
// happen automatically the moment the first expense was added, which was
// too aggressive in practice - trip/roommate groups often log their first
// expense before everyone's even installed the app. It's now a deliberate
// choice the group's admin makes (e.g. once the trip is over and the
// member list is final), enforced both here in the UI (only shown to an
// admin) and in firestore.rules (only an admin member may change
// `isLocked`).
export async function setGroupLocked(
  groupId: string,
  locked: boolean,
): Promise<void> {
  await groupsRef().doc(groupId).update({isLocked: locked});
}

// Full set of user-editable fields for an expense. Unlike the very first
// version of this function (description/amount/category only), editing
// also needs to be able to move the split around - who's paying, how it's
// divided, and who's included - so the edit screen isn't a dead end for
// anything but a typo fix. The caller (AddExpenseModal, in edit mode)
// always supplies the FULL current value of every field below, not a
// partial diff, because re-splitting requires the whole picture (amount +
// splitType + participants + params) to recompute `shares` correctly.
export interface EditExpenseInput {
  description: string;
  amount: number;
  category: ExpenseCategory;
  paidBy: string;
  splitType: SplitType;
  participantUids: string[];
  splitParams?: SplitParams;
}

export async function editExpense(
  groupId: string,
  expenseId: string,
  editedBy: string,
  changes: EditExpenseInput,
  changeSummary: string,
): Promise<void> {
  const check = validateSplitInput(
    changes.amount,
    changes.splitType,
    changes.participantUids,
    changes.splitParams,
  );
  if (!check.valid) {
    throw new Error(check.error);
  }
  const shares = computeSplits(
    changes.amount,
    changes.splitType,
    changes.participantUids,
    changes.splitParams,
  );

  const expenseRef = groupsRef()
    .doc(groupId)
    .collection('expenses')
    .doc(expenseId);
  await expenseRef.update(
    stripUndefined({
      description: changes.description,
      amount: changes.amount,
      category: changes.category,
      paidBy: changes.paidBy,
      splitType: changes.splitType,
      // `splitParams` only applies to non-'equal' splits. A plain omitted
      // key would leave a stale exact/percentage/shares breakdown on the
      // doc when editing back to 'equal' (unlike addExpense's `.set()`,
      // which starts from a blank document) - so delete it explicitly
      // rather than relying on stripUndefined to drop the key.
      splitParams: changes.splitParams ?? firestore.FieldValue.delete(),
      shares,
      editedAt: nowIso(),
      editHistory: firestore.FieldValue.arrayUnion({
        editedAt: nowIso(),
        editedBy,
        change: changeSummary,
      }),
    }),
  );
}

export async function deleteExpense(
  groupId: string,
  expenseId: string,
): Promise<void> {
  await groupsRef().doc(groupId).collection('expenses').doc(expenseId).delete();
}

export function subscribeExpenses(
  groupId: string,
  onChange: (expenses: Expense[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return groupsRef()
    .doc(groupId)
    .collection('expenses')
    .orderBy('createdAt', 'desc')
    .onSnapshot(
      snap =>
        onChange(snap.docs.map(d => ({...(d.data() as Expense), id: d.id}))),
      err => onError?.(err as unknown as Error),
    );
}

// --- Settlements ---------------------------------------------------------

export async function addSettlement(
  groupId: string,
  settlement: Omit<Settlement, 'id' | 'createdAt'>,
): Promise<void> {
  await groupsRef()
    .doc(groupId)
    .collection('settlements')
    .add(stripUndefined({...settlement, createdAt: nowIso()}));
}

export function subscribeSettlements(
  groupId: string,
  onChange: (settlements: Settlement[]) => void,
): () => void {
  return groupsRef()
    .doc(groupId)
    .collection('settlements')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snap =>
      onChange(snap.docs.map(d => ({...(d.data() as Settlement), id: d.id}))),
    );
}

// --- Leave group guard -----------------------------------------------------

export async function leaveGroup(groupId: string, uid: string): Promise<void> {
  await groupsRef()
    .doc(groupId)
    .update({memberIds: firestore.FieldValue.arrayRemove(uid)});
  await db()
    .collection('users')
    .doc(uid)
    .update({groupIds: firestore.FieldValue.arrayRemove(groupId)});
}

export type {FirebaseFirestoreTypes};
