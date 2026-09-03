// src/services/ledger/firestoreLedger.ts
// Firestore access for the new uid-keyed schema (see types.ts). This
// replaces the direct firestore() calls scattered through GroupCheck.js
// and ExpenseTracker.js against the old Esplitusers/Esplitgroups shape.

import firestore, {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import {computeSplits, validateSplitInput} from './splitEngine';
import {stripUndefined} from './firestoreUtils';
import {sendPushNotification} from '../notifications';
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

  // The members/{uid} security rule gates every write on isGroupMember(),
  // which get()s this group doc to check its memberIds. Firestore's rules
  // engine evaluates get() against the database state *before* the current
  // request - it can't see a sibling write earlier in the same batch - so
  // writing the group doc and its first member doc together in one batch
  // always failed that check (the group doc looks like it doesn't exist
  // yet). Writing the group doc first and awaiting it, then writing the
  // member doc as a separate request, lets the second write's rules see
  // the group as it actually is. If the member write fails, the group doc
  // is rolled back so we don't leave a group with no members at all.
  await groupRef.set(group);
  try {
    await groupRef
      .collection('members')
      .doc(user.uid)
      .set({
        uid: user.uid,
        displayName: user.displayName || 'Member',
        photoUrl: user.photoURL || '',
        joinedAt: nowIso(),
        role: 'admin',
        active: true,
      } as GroupMember);
  } catch (error) {
    await groupRef.delete().catch(() => {});
    throw error;
  }

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
    // Same reasoning as createGroup(): the members/{uid} write's security
    // rule get()s this group doc to check memberIds, and that get() can't
    // see a sibling write earlier in the same batch - so adding the joiner
    // to memberIds and creating their member doc in one batch always
    // failed the member doc's permission check. Awaiting the memberIds
    // update first lets the second write's rules see the joiner as an
    // actual member. If the member doc write fails, the memberIds add is
    // rolled back so no one is left counted as a member with no member
    // doc.
    await groupDoc.ref.update({
      memberIds: firestore.FieldValue.arrayUnion(user.uid),
    });
    try {
      await groupDoc.ref
        .collection('members')
        .doc(user.uid)
        .set({
          uid: user.uid,
          displayName: user.displayName || 'Member',
          photoUrl: user.photoURL || '',
          joinedAt: nowIso(),
          role: 'member',
          active: true,
        } as GroupMember);
    } catch (error) {
      await groupDoc.ref
        .update({memberIds: firestore.FieldValue.arrayRemove(user.uid)})
        .catch(() => {});
      throw error;
    }

    await db()
      .collection('users')
      .doc(user.uid)
      .set({groupIds: firestore.FieldValue.arrayUnion(groupId)}, {merge: true});

    // Let the group's creator know someone joined - only on a genuinely
    // new join (not a re-entry via deep link into a group you're already
    // in), and only the creator, per the feedback that asked for this
    // specifically rather than notifying the whole group.
    if (group.createdBy && group.createdBy !== user.uid) {
      try {
        const creatorDoc = await db()
          .collection('users')
          .doc(group.createdBy)
          .get();
        await sendPushNotification(
          [creatorDoc.data()?.fcmToken],
          group.name || 'EzySplit',
          `${user.displayName || 'Someone'} joined your group "${group.name}"`,
        );
      } catch (error) {
        console.log('🚀 ~ joinGroup notify ~ error:', error);
      }
    }
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

  // Notify every other group member - see src/services/notifications.ts
  // for why this goes through the separate backend rather than sending
  // FCM directly from the client. Never let a notification hiccup surface
  // as an "could not add expense" error - the expense is already saved.
  try {
    const [groupSnap, creatorDoc] = await Promise.all([
      groupRef.get(),
      db().collection('users').doc(input.createdBy).get(),
    ]);
    const group = groupSnap.data() as Group | undefined;
    const creatorName = creatorDoc.data()?.displayName || 'Someone';
    const recipientIds = (group?.memberIds || []).filter(
      id => id !== input.createdBy,
    );
    if (recipientIds.length) {
      const memberDocs = await Promise.all(
        recipientIds.map(id => db().collection('users').doc(id).get()),
      );
      await sendPushNotification(
        memberDocs.map(d => d.data()?.fcmToken),
        group?.name || 'EzySplit',
        `${creatorName} added ₹${input.amount.toFixed(2)} for ${
          input.description
        }`,
      );
    }
  } catch (error) {
    console.log('🚀 ~ addExpense notify ~ error:', error);
  }
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
  // Previously this only removed `uid` from the group's `memberIds` array -
  // the per-member doc at groups/{groupId}/members/{uid} was never touched,
  // so it sat there forever with `active: true`. Every screen that reads
  // "who's in this group" via subscribeGroupMembers() (Activity's member
  // count, per-person totals, etc.) reads that subcollection, not
  // `memberIds` - so a departed member kept showing up everywhere except
  // the Group-Check list, which happens to read `memberIds` directly.
  // Both writes below go in one batch rather than two sequential updates:
  // firestore.rules' isGroupMember() check re-reads the group doc, and a
  // batch is evaluated against the state *before* any write in it lands,
  // so the leaving member still passes that check for their own
  // members/{uid} write. Two separate .update() calls would have the
  // second one evaluated after the first already dropped them from
  // memberIds, failing permission-denied.
  const batch = db().batch();
  batch.update(groupsRef().doc(groupId), {
    memberIds: firestore.FieldValue.arrayRemove(uid),
  });
  batch.update(groupsRef().doc(groupId).collection('members').doc(uid), {
    active: false,
    leftAt: nowIso(),
  });
  await batch.commit();

  await db()
    .collection('users')
    .doc(uid)
    .update({groupIds: firestore.FieldValue.arrayRemove(groupId)});
}

export type {FirebaseFirestoreTypes};
