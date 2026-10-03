// src/services/ledger/monthInsight.ts
// "This month" insight for the dashboard: your top spending category so
// far this month, and how your spend compares with the SAME stretch of
// last month (1st-3rd Oct vs 1st-3rd Sep), so early-month numbers aren't
// unfairly compared with a whole previous month.
//
// Works on YOUR share of each expense (a 3,000 dinner split 3 ways counts
// as 1,000 for you; personal-list expenses count in full) - the same basis
// as the "Total spent" tile. Pure functions, unit-tested.
import {DEFAULT_CURRENCY} from './currency';
import {EXPENSE_CATEGORIES} from './types';

export interface ShareEntry {
  amount: number; // your share
  currency: string;
  category: string;
  createdAt: string; // ISO
  personal: boolean; // from a personal list (vs a shared group)
}

export type InsightScope = 'all' | 'groups' | 'personal';

export interface MonthInsight {
  currency: string;
  top: {key: string; label: string; icon: string; amount: number};
  thisMonthTotal: number;
  /** null when there was no spending at all last month to compare with */
  lastMonthSamePeriod: number | null;
  delta: number | null; // thisMonthTotal - lastMonthSamePeriod
  /** "1–4 Oct" and the matching "1–4 Sep" - spelled out in the UI so the
   * comparison is unambiguous (not "this time last month"). */
  thisPeriodLabel: string;
  lastPeriodLabel: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function rangeLabel(lastDay: number, monthIndex: number) {
  const mon = MONTHS[((monthIndex % 12) + 12) % 12];
  return lastDay <= 1 ? `1 ${mon}` : `1\u2013${lastDay} ${mon}`;
}

/** Labels for this month so far and the same stretch of last month. */
export function periodLabels(now: Date) {
  const m = now.getMonth();
  const daysInLast = new Date(now.getFullYear(), m, 0).getDate();
  return {
    thisPeriodLabel: rangeLabel(now.getDate(), m),
    lastPeriodLabel: rangeLabel(Math.min(now.getDate(), daysInLast), m - 1),
  };
}

interface Options {
  currency?: string;
  scope?: InsightScope;
  now?: Date;
  /** fewer expenses than this this month -> no insight (too early to say) */
  minExpenses?: number;
}

function inScope(e: ShareEntry, scope: InsightScope) {
  return scope === 'all' || (scope === 'personal' ? e.personal : !e.personal);
}

/** [start, end) of this month so far, and the same stretch of last month. */
export function comparisonWindows(now: Date) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const thisStart = new Date(y, m, 1);
  const lastStart = new Date(y, m - 1, 1);
  const lastMonthEnd = new Date(y, m, 1); // exclusive
  // Same day/time last month, clamped to that month's end (31 Mar -> 28 Feb).
  const daysInLast = new Date(y, m, 0).getDate();
  const sameMoment = new Date(
    y,
    m - 1,
    Math.min(now.getDate(), daysInLast),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  );
  const lastEnd =
    now.getDate() > daysInLast ? lastMonthEnd : new Date(sameMoment.getTime() + 1);
  return {thisStart, thisEnd: new Date(now.getTime() + 1), lastStart, lastEnd, lastMonthEnd};
}

/** Your total spend so far this month (for a scope + currency). */
export function monthToDateTotal(
  entries: ShareEntry[],
  {currency = DEFAULT_CURRENCY, scope = 'all', now = new Date()}: Options = {},
): number {
  const {thisStart, thisEnd} = comparisonWindows(now);
  return entries
    .filter(e => (e.currency || DEFAULT_CURRENCY) === currency && inScope(e, scope))
    .filter(e => {
      const t = new Date(e.createdAt);
      return t >= thisStart && t < thisEnd;
    })
    .reduce((sum, e) => sum + e.amount, 0);
}

export function computeMonthInsight(
  entries: ShareEntry[],
  {currency = DEFAULT_CURRENCY, scope = 'all', now = new Date(), minExpenses = 3}: Options = {},
): MonthInsight | null {
  const {thisStart, thisEnd, lastStart, lastEnd, lastMonthEnd} =
    comparisonWindows(now);
  const relevant = entries.filter(
    e =>
      e.amount > 0 &&
      (e.currency || DEFAULT_CURRENCY) === currency &&
      inScope(e, scope),
  );
  const within = (e: ShareEntry, start: Date, end: Date) => {
    const t = new Date(e.createdAt);
    return t >= start && t < end;
  };

  const thisMonth = relevant.filter(e => within(e, thisStart, thisEnd));
  if (thisMonth.length < minExpenses) {
    return null;
  }

  const byCategory: Record<string, number> = {};
  thisMonth.forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  });
  const [topKey, topAmount] = Object.entries(byCategory).sort(
    ([, a], [, b]) => b - a,
  )[0];
  const meta =
    EXPENSE_CATEGORIES.find(c => c.key === topKey) ??
    EXPENSE_CATEGORIES.find(c => c.key === 'other')!;

  const thisMonthTotal = thisMonth.reduce((s, e) => s + e.amount, 0);
  const hadLastMonth = relevant.some(e => within(e, lastStart, lastMonthEnd));
  const lastMonthSamePeriod = hadLastMonth
    ? relevant
        .filter(e => within(e, lastStart, lastEnd))
        .reduce((s, e) => s + e.amount, 0)
    : null;

  return {
    currency,
    top: {key: meta.key, label: meta.label, icon: meta.icon, amount: topAmount},
    thisMonthTotal,
    lastMonthSamePeriod,
    delta: lastMonthSamePeriod == null ? null : thisMonthTotal - lastMonthSamePeriod,
    ...periodLabels(now),
  };
}
