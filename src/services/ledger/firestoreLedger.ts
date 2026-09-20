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
import {formatMoney} from './currency';
import {
  Expense,
  ExpenseCategory,
  Group,
  GroupMember,
  GroupType,
  JoinRequest,
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

// A guest is identified this way everywhere else in the app (types.ts,
// GroupSettings.tsx) purely by checking member.isGuest - this prefix
// exists only so a stray write elsewhere can never be mistaken for a
// real Firebase Auth uid, not as the source of truth for guest-ness.
const GUEST_ID_PREFIX = 'guest_';

function generateGuestId(): string {
  // Firestore's own auto-id (a random 20-char base62 string) is already
  // effectively collision-proof - no separate uniqueness check needed,
  // unlike the join code above which is short enough to plausibly clash.
  return GUEST_ID_PREFIX + groupsRef().doc().id;
}

// --- Groups ----------------------------------------------------------------

export async function createGroup(
  user: {uid: string; displayName?: string | null; photoURL?: string | null},
  groupName: string,
  currency = 'INR',
  groupType: GroupType = 'group',
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
    type: groupType,
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

export interface JoinGroupResult {
  group: Group;
  // True only when this uid was ALREADY in memberIds before this call -
  // i.e. someone re-opening an old invite link, re-scanning a QR they'd
  // already used, or re-entering a code for a group they never left. This
  // path is untouched by the join-approval redesign below: an existing
  // member is never asked to wait on their own group again.
  alreadyMember: boolean;
  // True when a NEW join request was just created (or one was already
  // sitting pending from an earlier attempt) and is now awaiting an
  // admin's decision. The caller should show a "request sent" state
  // instead of navigating into the group - there is nothing to enter yet.
  requestPending: boolean;
}

// Join a group by id - used by both the join-code flow (via
// getGroupByJoinCode) and the deep-link / QR flow (which resolve straight
// to a groupId). Someone who is already a member is let straight back in,
// exactly as before this feature existed. Anyone else no longer becomes a
// member immediately: a join request is created instead, and an admin has
// to approve it before memberIds/the members subcollection/the
// requester's own groupIds are touched at all. This closes the hole where
// finding a join code or a QR image was, by itself, enough to see a
// group's whole expense history.
export async function joinGroup(
  user: {uid: string; displayName?: string | null; photoURL?: string | null},
  groupId: string,
  method: 'code' | 'qr' | 'link' = 'code',
): Promise<JoinGroupResult> {
  const groupDoc = await groupsRef().doc(groupId).get();
  if (!groupDoc.exists) {
    throw new Error('That group could not be found.');
  }
  const group = groupDoc.data() as Group;
  const alreadyMember = group.memberIds.includes(user.uid);

  if (alreadyMember) {
    return {group, alreadyMember: true, requestPending: false};
  }

  if (group.isLocked) {
    throw new Error(
      'This group is locked by its admin and is not accepting new members right now.',
    );
  }

  const requestRef = groupDoc.ref.collection('joinRequests').doc(user.uid);
  const existingRequest = await requestRef.get();
  if (
    existingRequest.exists &&
    (existingRequest.data() as JoinRequest).status === 'pending'
  ) {
    // Already waiting on a decision from an earlier attempt (e.g. they
    // scanned the same QR twice, or backed out and came back in) - don't
    // spam the admins with a second notification for the same request.
    return {group, alreadyMember: false, requestPending: true};
  }

  const joinRequest: JoinRequest = {
    uid: user.uid,
    displayName: user.displayName || 'Member',
    photoUrl: user.photoURL || '',
    status: 'pending',
    requestedAt: nowIso(),
    method,
  };
  // A fresh .set() here deliberately overwrites any earlier
  // approved/declined doc for this uid - someone declined once, or who
  // left and wants back in, gets a clean new pending request rather than
  // being stuck on a stale terminal status forever.
  await requestRef.set(joinRequest);

  // Notify every current admin, not just whoever originally created the
  // group - the creator may have left since, or the group may have more
  // than one admin. A notification hiccup here should never surface as a
  // "could not send request" error - the request itself is already saved
  // and will show up next time an admin opens the group's join-requests
  // panel regardless.
  // Deliberately not awaited - see the same note on addExpense() above.
  // The request is already saved; the requester shouldn't wait on every
  // admin's user doc plus a backend round trip just to see "request sent".
  (async () => {
    try {
      const membersSnap = await groupDoc.ref.collection('members').get();
      const adminUids = membersSnap.docs
        .filter(d => (d.data() as GroupMember).role === 'admin')
        .map(d => d.id);
      if (adminUids.length > 0) {
        const adminDocs = await Promise.all(
          adminUids.map(uid => db().collection('users').doc(uid).get()),
        );
        const tokens = adminDocs.map(d => d.data()?.fcmToken);
        await sendPushNotification(
          tokens,
          group.name || 'EzySplit',
          `${user.displayName || 'Someone'} wants to join "${group.name}"`,
          {type: 'join_request', groupId, requesterUid: user.uid},
        );
      }
    } catch (error) {
      console.log('🚀 ~ joinGroup notify admins ~ error:', error);
    }
  })();

  return {group, alreadyMember: false, requestPending: true};
}

// Admin-only: approve a pending join request, finally granting the
// membership that joinGroup() above deliberately withheld. Follows the
// same write-group-doc-then-member-doc-with-rollback pattern as
// createGroup()/the old instant joinGroup(), for the same reason -
// firestore.rules' isGroupMember() re-reads the group doc, which can't
// see a sibling write earlier in the same batch.
//
// The caller (GroupSettings.tsx's join-requests panel) is responsible for
// only showing this action to an admin - this function itself doesn't
// re-check role, matching the existing convention (setGroupLocked,
// deleteGroup) of enforcing admin-only client-side.
export async function approveJoinRequest(
  groupId: string,
  requesterUid: string,
): Promise<void> {
  const groupRef = groupsRef().doc(groupId);
  const requestRef = groupRef.collection('joinRequests').doc(requesterUid);
  const [groupDoc, requestDoc] = await Promise.all([
    groupRef.get(),
    requestRef.get(),
  ]);
  if (!groupDoc.exists) {
    throw new Error('That group could not be found.');
  }
  if (!requestDoc.exists) {
    throw new Error(
      'That request could not be found - it may have already been withdrawn.',
    );
  }
  const request = requestDoc.data() as JoinRequest;
  if (request.status !== 'pending') {
    throw new Error('This request has already been handled.');
  }
  const group = groupDoc.data() as Group;

  await groupRef.update({
    memberIds: firestore.FieldValue.arrayUnion(requesterUid),
  });
  try {
    await groupRef
      .collection('members')
      .doc(requesterUid)
      .set({
        uid: requesterUid,
        displayName: request.displayName || 'Member',
        photoUrl: request.photoUrl || '',
        joinedAt: nowIso(),
        role: 'member',
        active: true,
      } as GroupMember);
  } catch (error) {
    await groupRef
      .update({memberIds: firestore.FieldValue.arrayRemove(requesterUid)})
      .catch(() => {});
    throw error;
  }

  await db()
    .collection('users')
    .doc(requesterUid)
    .set({groupIds: firestore.FieldValue.arrayUnion(groupId)}, {merge: true});

  await requestRef.update({status: 'approved', respondedAt: nowIso()});

  // Deliberately not awaited - see the same note on addExpense() above.
  (async () => {
    try {
      const requesterDoc = await db()
        .collection('users')
        .doc(requesterUid)
        .get();
      await sendPushNotification(
        [requesterDoc.data()?.fcmToken],
        group.name || 'EzySplit',
        `You're in! Your request to join "${group.name}" was approved.`,
        {type: 'join_approved', groupId},
      );
    } catch (error) {
      console.log('🚀 ~ approveJoinRequest notify ~ error:', error);
    }
  })();
}

// Admin-only: decline a pending join request. Nothing about membership
// changes - the request doc is simply marked 'declined' so it stops
// showing up anywhere pending requests are listed. joinGroup() treats a
// 'declined' doc as stale, so the same person can freely try again later
// without being permanently blocked by one no.
export async function declineJoinRequest(
  groupId: string,
  requesterUid: string,
): Promise<void> {
  const groupRef = groupsRef().doc(groupId);
  const requestRef = groupRef.collection('joinRequests').doc(requesterUid);
  const [groupDoc, requestDoc] = await Promise.all([
    groupRef.get(),
    requestRef.get(),
  ]);
  if (!requestDoc.exists) {
    throw new Error(
      'That request could not be found - it may have already been withdrawn.',
    );
  }
  const request = requestDoc.data() as JoinRequest;
  if (request.status !== 'pending') {
    throw new Error('This request has already been handled.');
  }
  await requestRef.update({status: 'declined', respondedAt: nowIso()});

  const group = groupDoc.data() as Group | undefined;
  // Deliberately not awaited - see the same note on addExpense() above.
  (async () => {
    try {
      const requesterDoc = await db()
        .collection('users')
        .doc(requesterUid)
        .get();
      await sendPushNotification(
        [requesterDoc.data()?.fcmToken],
        group?.name || 'EzySplit',
        `Your request to join "${group?.name || 'the group'}" was declined.`,
        {type: 'join_declined', groupId},
      );
    } catch (error) {
      console.log('🚀 ~ declineJoinRequest notify ~ error:', error);
    }
  })();
}

// Live listener for a group's outstanding join requests, for the admin
// panel in GroupSettings.tsx. Filtered to 'pending' at the query level
// (rather than fetching everything and filtering client-side) so a group
// with a long history of approved/declined requests doesn't pay to
// re-download all of them on every render.
export function subscribeJoinRequests(
  groupId: string,
  onChange: (requests: JoinRequest[]) => void,
): () => void {
  return groupsRef()
    .doc(groupId)
    .collection('joinRequests')
    .where('status', '==', 'pending')
    .onSnapshot(snap => {
      onChange(snap.docs.map(d => d.data() as JoinRequest));
    });
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
//
// `source` defaults to Firestore's own 'default' behavior (try the
// server, fall back to the on-device cache if it can't be reached) -
// exactly what every existing caller got before this parameter existed,
// so passing nothing here changes nothing. Callers that want an
// instant, cache-only read (see useGroupsOverview's stale-while-
// revalidate pass) can opt in with `{source: 'cache'}`; a cache miss on
// a collection query returns an empty QuerySnapshot rather than
// throwing, so this never surfaces an error the caller has to handle.
export async function getGroupSnapshot(
  groupId: string,
  options?: {source?: 'default' | 'server' | 'cache'},
): Promise<GroupSnapshot> {
  const source = options?.source ?? 'default';
  const groupRef = groupsRef().doc(groupId);
  const [membersSnap, expensesSnap, settlementsSnap] = await Promise.all([
    groupRef.collection('members').get({source}),
    groupRef.collection('expenses').get({source}),
    groupRef.collection('settlements').get({source}),
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
    input.currency,
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
  // FCM directly from the client. Deliberately NOT awaited: this used to
  // block addExpense()'s own promise on reading the group doc, the
  // creator's doc, EVERY other member's doc (for their FCM tokens), and
  // then a round trip to the notification backend - all after the
  // expense itself was already durably written. That chain of extra
  // reads was the real reason "adding an expense" felt slow (reported by
  // users), not the write itself, since Firestore's local cache + this
  // app's onSnapshot listeners already show the new expense instantly
  // regardless of network speed. Firing this without awaiting it lets
  // the UI close the modal the moment the expense is actually saved,
  // while the notification still goes out a moment later in the
  // background. Errors here are swallowed inside the helper itself so a
  // notification hiccup can never surface as an "could not add expense"
  // error - the expense is already saved either way.
  notifyGroupOfNewExpense(input, groupRef).catch(error => {
    console.log('🚀 ~ addExpense notify ~ error:', error);
  });
}

async function notifyGroupOfNewExpense(
  input: AddExpenseInput,
  groupRef: FirebaseFirestoreTypes.DocumentReference,
): Promise<void> {
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
      `${creatorName} added ${formatMoney(input.amount, group?.currency)} for ${
        input.description
      }`,
    );
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
  // EditExpenseInput has no currency field (editing never changes which
  // currency an expense is in - that's fixed at creation, tied to the
  // group) - this defensive re-validation just falls back to the default
  // symbol for its (rarely surfaced) error message.
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

// --- Guests (manual members, no account, never joined) ----------------------
//
// For someone who shares real expenses with the group but won't install
// the app or go through the join-code/QR flow. A guest is just another
// doc in this group's members subcollection - the split engine, the
// ledger math (computeNetBalances/computePairwiseLedger) and every
// picker in AddExpenseModal already treat member uids as opaque strings,
// so a guest participates in all of that for free the moment their doc
// exists. What deliberately does NOT happen for a guest, because they
// have no Firebase Auth account behind them:
//   - no users/{uid} doc is ever created, read, or written for them
//   - their id is never added to the parent group's memberIds array
//     (that array is what ties an account to a group via
//     users/{uid}.groupIds - see joinGroup/approveJoinRequest/leaveGroup
//     above and deleteGroup below)
//   - notifyGroupOfNewExpense() (in addExpense() below) reads recipients
//     from memberIds, so a guest is automatically never sent a push
//     notification - there's no fcmToken to send one to anyway
//   - Balances.tsx's UPI lookup already does firestore().collection('users')
//     .doc(m.uid).get() and checks doc.exists before reading upiId, so a
//     guest (no user doc) already resolves to "no UPI on file" and falls
//     back to a manual "mark as settled" prompt with zero extra code
export async function addGuestMember(
  groupId: string,
  displayName: string,
): Promise<GroupMember> {
  const member: GroupMember = {
    uid: generateGuestId(),
    displayName: displayName.trim() || 'Guest',
    joinedAt: nowIso(),
    role: 'member',
    active: true,
    isGuest: true,
  };
  await groupsRef()
    .doc(groupId)
    .collection('members')
    .doc(member.uid)
    .set(member);
  return member;
}

// Mirrors leaveGroup()'s "deactivate, don't delete" approach (so a
// removed guest's past expenses/settlements still resolve a name instead
// of going blank) but skips both of the account-only steps leaveGroup
// does - no memberIds entry to remove, no users/{uid} doc to update -
// since a guest was never added to either. The prefix check is a
// last-resort guard: this function is destructive-ish (removes someone
// from the group's active member list), so it refuses to run against
// anything that isn't unambiguously a guest id rather than trusting
// every caller to only ever pass one.
export async function removeGuestMember(
  groupId: string,
  guestUid: string,
): Promise<void> {
  if (!guestUid.startsWith(GUEST_ID_PREFIX)) {
    throw new Error('removeGuestMember() called with a non-guest id.');
  }
  await groupsRef()
    .doc(groupId)
    .collection('members')
    .doc(guestUid)
    .update({active: false, leftAt: nowIso()});
}

// --- Delete group (admin-only, irreversible) --------------------------------

// Permanently removes a group and everything under it: every expense,
// settlement and member doc in its subcollections, the group doc itself,
// and this group's id out of every (including past/inactive) member's
// users/{uid}.groupIds array. Deliberately scoped to ONLY this one
// group's own subtree - no other group, and no other field on any
// member's user doc, is ever touched, so another group any of these
// members belongs to is completely unaffected.
//
// The caller (GroupSettings.tsx) is responsible for the admin-only gate,
// the "every balance is settled" check, and the type-the-group-name
// confirmation - this function assumes that's already been decided and
// just does the deletion.
//
// Firestore batches cap at 500 writes, and a long-lived group could
// plausibly have more than 500 expenses+settlements+members combined even
// though a single leaveGroup() never approaches that - so deletes are
// collected up front and committed in chunks rather than one batch.
const DELETE_BATCH_CHUNK = 450;

export async function deleteGroup(groupId: string): Promise<void> {
  const groupRef = groupsRef().doc(groupId);

  const [expensesSnap, settlementsSnap, membersSnap] = await Promise.all([
    groupRef.collection('expenses').get(),
    groupRef.collection('settlements').get(),
    groupRef.collection('members').get(),
  ]);

  // Guests (see addGuestMember() above) have no users/{uid} doc at all -
  // .update() on a document that doesn't exist throws, which would fail
  // the WHOLE batch below (Firestore batches are all-or-nothing) and
  // leave this group's own doc undeleted even though its subcollections
  // are already gone. They were never added to any users/{uid}.groupIds
  // in the first place, so there's nothing to clean up for them here -
  // only real members' user docs need this arrayRemove.
  const memberUids = membersSnap.docs
    .filter(d => !(d.data() as GroupMember)?.isGuest)
    .map(d => d.id);

  const docRefsToDelete: FirebaseFirestoreTypes.DocumentReference[] = [
    ...expensesSnap.docs.map(d => d.ref),
    ...settlementsSnap.docs.map(d => d.ref),
    ...membersSnap.docs.map(d => d.ref),
  ];

  for (let i = 0; i < docRefsToDelete.length; i += DELETE_BATCH_CHUNK) {
    const batch = db().batch();
    docRefsToDelete
      .slice(i, i + DELETE_BATCH_CHUNK)
      .forEach(ref => batch.delete(ref));
    await batch.commit();
  }

  // arrayRemove on a value that isn't present is a harmless no-op, so this
  // is safe to run for past/inactive members too (leaveGroup already
  // removed the groupId from anyone who left normally).
  for (let i = 0; i < memberUids.length; i += DELETE_BATCH_CHUNK) {
    const batch = db().batch();
    memberUids.slice(i, i + DELETE_BATCH_CHUNK).forEach(uid => {
      batch.update(db().collection('users').doc(uid), {
        groupIds: firestore.FieldValue.arrayRemove(groupId),
      });
    });
    await batch.commit();
  }

  await groupRef.delete();
}

export type {FirebaseFirestoreTypes};
