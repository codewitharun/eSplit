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
}

export interface Group {
  id: string;
  name: string;
  currency: string; // ISO 4217, e.g. "INR"
  createdBy: string;
  createdAt: string;
  isLocked: boolean;
  joinCode: string; // short human code, resolved via a query - not the doc id
  memberIds: string[];
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
  isRecurring?: boolean;
  recurrenceIntervalDays?: number;
  receiptUrl?: string;
  createdBy: string; // uid
  createdAt: string; // ISO timestamp
  editedAt?: string;
  editHistory?: EditHistoryEntry[];
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
