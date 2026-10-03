// src/services/ledger/activityFormat.ts
// Small pure helpers for the Activity expense list: what an expense means
// for the signed-in user ("you lent ₹600" / "you borrowed ₹200"), and
// day-section labels ("Today", "Yesterday", "Mon, 28 Sep").

import {round2} from './splitEngine';
import {Expense} from './types';

export type ExpenseImpact =
  | {kind: 'lent'; amount: number} // you paid; others owe you this much of it
  | {kind: 'borrowed'; amount: number} // someone else paid; this is your share
  | {kind: 'self'; amount: number} // you paid, all of it was yours
  | {kind: 'none'; amount: 0}; // you weren't part of it

export function expenseImpact(
  e: Pick<Expense, 'amount' | 'paidBy' | 'shares'>,
  uid: string,
): ExpenseImpact {
  const share = e.shares?.[uid] || 0;
  if (e.paidBy === uid) {
    const lent = round2(e.amount - share);
    return lent > 0.004
      ? {kind: 'lent', amount: lent}
      : {kind: 'self', amount: round2(share)};
  }
  return share > 0.004
    ? {kind: 'borrowed', amount: round2(share)}
    : {kind: 'none', amount: 0};
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// Local calendar-day key, e.g. "2026-9-2" - for grouping rows by day.
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diffDays === 0) {
    return 'Today';
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  const base = `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear()
    ? base
    : `${base} ${d.getFullYear()}`;
}

// "8:42 pm"
export function timeLabel(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}
