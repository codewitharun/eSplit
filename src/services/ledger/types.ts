// src/services/ledger/types.ts
// Core types for the ledger rebuild - the new Firestore schema (uid-keyed,
// not displayName-keyed) shared by the split engine, the debt simplifier,
// and the Firestore data-access layer.
//
// Schema:
//   users/{uid}
//   groups/{groupId}                          memberIds: [uid,...], joinCode
//   groups/{groupId}/members/{uid}
//   groups/{groupId}/expenses/{expenseId}      shares: { uid: amount }
//   groups/{groupId}/settlements/{settlementId}

export type SplitType = 'equal' | 'exact' | 'percentage' | 'shares';

export type ExpenseCategory =
  | 'food'
  | 'groceries'
  | 'travel'
  | 'rent'
  | 'utilities'
  | 'shopping'
  | 'other';

export interface AppUser {
  uid: string;
  displayName: string;
  email?: string;
  photoUrl?: string;
  defaultCurrency: string;
  upiId?: string;
  groupIds: string[];
  fcmToken?: string | null;
}

export interface GroupMember {
  uid: string;
  displayName: string;
  photoUrl?: string;
  joinedAt: string; // ISO timestamp
  role: 'admin' | 'member';
  active: boolean;
  leftAt?: string; // ISO timestamp, set when active is flipped to false
  // OPTIONAL and only ever set going forward, exactly like Group.type
  // below: every member doc created before this feature existed simply
  // has no `isGuest` at all, and every read site treats a missing value
  // as "not a guest" (a real, joined member) - purely additive, no
  // existing member doc is touched. A guest is added straight to this
  // `members` subcollection (see addGuestMember()) with a synthetic
  // `guest_<id>` uid instead of a Firebase Auth uid - there is no
  // users/{uid} doc for them, and they are deliberately never added to
  // the parent group's `memberIds` array (that array is what ties a
  // REAL account to a group via users/{uid}.groupIds; a guest has no
  // account to tie). They still fully participate in the split/ledger
  // math below, which only ever treats uids as opaque strings.
  isGuest?: boolean;
}

// 'group' (the default) is a normal shared group; 'personal' is a
// single-member list created via the Personal toggle at creation time -
// same schema, same expense/split engine, just always paidBy===the one
// member and shares===the whole amount to them (see AddExpenseModal's
// members.length <= 1 handling), so it never needs its own data model.
// OPTIONAL and only ever set going forward: every group created before
// this field existed simply has no `type` at all, and every read site
// treats a missing/undefined type as 'group' - so this is purely
// additive and doesn't touch, migrate, or require re-reading a single
// existing group document.
export type GroupType = 'group' | 'personal';

export interface Group {
  id: string;
  name: string;
  currency: string; // ISO 4217, e.g. "INR"
  createdBy: string;
  createdAt: string;
  isLocked: boolean;
  joinCode: string; // short human code, resolved via a query - not the doc id
  memberIds: string[];
  type?: GroupType; // undefined on any group created before this field existed - treat as 'group'
}

// A pending/resolved request to join a group, stored at
// groups/{groupId}/joinRequests/{uid} - one doc per requester, keyed by
// their uid so a repeat request (e.g. re-scanning the same QR code) just
// overwrites their own doc rather than piling up duplicates. Introduced
// so that finding a join code or QR image (printed, screenshotted,
// forwarded) is no longer enough to walk straight into a group's expense
// history - every new member now needs an admin to say yes, regardless of
// whether they arrived via a join code, a deep link, or a QR scan.
// Someone who is ALREADY a member (re-opening an old invite link, say)
// never creates one of these - see joinGroup() in firestoreLedger.ts.
export type JoinRequestStatus = 'pending' | 'approved' | 'declined';

export interface JoinRequest {
  uid: string;
  displayName: string;
  photoUrl?: string;
  status: JoinRequestStatus;
  requestedAt: string; // ISO timestamp
  respondedAt?: string; // ISO timestamp, set when approved/declined
  method?: 'code' | 'qr' | 'link'; // how they found the group, for admin context
}

export interface SplitParams {
  // Only the field matching `splitType` needs to be populated.
  exactAmounts?: Record<string, number>; // uid -> amount, must sum to total
  percentages?: Record<string, number>; // uid -> percent, must sum to 100
  shares?: Record<string, number>; // uid -> weight (e.g. 2 for a couple, 1 for a single)
}

export interface EditHistoryEntry {
  editedAt: string;
  editedBy: string;
  change: string;
}

// One line of a multi-item expense (see expenseItems.ts). OPTIONAL on
// Expense and only written when an expense has 2+ items - every existing
// expense has no `items` and is unaffected.
export interface ExpenseItem {
  name: string;
  price: number;
}

export interface Expense {
  id?: string;
  description: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  paidBy: string; // uid
  splitType: SplitType;
  splitParams?: SplitParams;
  shares: Record<string, number>; // uid -> that uid's share of this expense
  items?: ExpenseItem[]; // only on multi-item expenses; `amount` === sum of prices
  isRecurring?: boolean;
  recurrenceIntervalDays?: number;
  receiptUrl?: string;
  createdBy: string; // uid
  createdAt: string; // ISO timestamp
  editedAt?: string;
  editHistory?: EditHistoryEntry[];
}

// A record left behind when an expense is deleted, at
// groups/{groupId}/deletedExpenses/{expenseId} (doc id = the deleted
// expense's id). ADDITIVE: older app versions never read or write it, and
// deletes made by them simply leave no record. Snapshot of what mattered
// for balances, so the group can see what disappeared after a settle-up.
export interface DeletedExpense {
  id?: string;
  description: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  paidBy: string;
  shares: Record<string, number>;
  createdBy: string;
  createdAt: string; // the expense's original createdAt
  deletedBy: string;
  deletedAt: string;
}

export interface Settlement {
  id?: string;
  fromUid: string; // who paid
  toUid: string; // who received
  amount: number;
  currency: string;
  method?: 'upi' | 'cash' | 'bank' | 'other';
  note?: string;
  createdAt: string;
}

export interface SimplifiedTransfer {
  fromUid: string;
  toUid: string;
  amount: number;
}

export const EPSILON = 0.01; // treat amounts within 1 paisa/cent as equal

export const EXPENSE_CATEGORIES: {
  key: ExpenseCategory;
  label: string;
  icon: string;
}[] = [
  {key: 'food', label: 'Food', icon: '🍔'},
  {key: 'groceries', label: 'Groceries', icon: '🛒'},
  {key: 'travel', label: 'Travel', icon: '🚗'},
  {key: 'rent', label: 'Rent', icon: '🏠'},
  {key: 'utilities', label: 'Utilities', icon: '💡'},
  {key: 'shopping', label: 'Shopping', icon: '🛍️'},
  {key: 'other', label: 'Other', icon: '🧾'},
];
