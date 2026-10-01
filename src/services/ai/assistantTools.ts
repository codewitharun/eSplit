// src/services/ai/assistantTools.ts
// The "tools" the AI assistant can call (see esplit-backend/routes/ai.js
// for their definitions). They run HERE, on the phone, against the
// signed-in user's own data, using the same ledger code the rest of the
// app uses - so every number the assistant quotes is computed exactly
// like the app's own screens compute it. Claude only phrases the answer.
//
// Read-only by design: nothing in this file writes anything.
//
// Pure (no Firestore/network) so it's unit-testable - data is loaded by
// assistantClient.ts and passed in.

import {DEFAULT_CURRENCY, formatMoney} from '../ledger/currency';
import {
  computeNetBalances,
  computePairwiseLedger,
} from '../ledger/debtSimplifier';
import {visibleItems} from '../ledger/expenseItems';
import {round2} from '../ledger/splitEngine';
import {
  EXPENSE_CATEGORIES,
  Expense,
  Group,
  GroupMember,
  Settlement,
} from '../ledger/types';

export interface AssistantGroupData {
  group: Group;
  members: GroupMember[];
  expenses: Expense[];
  settlements: Settlement[];
}

export interface AssistantData {
  uid: string;
  groups: AssistantGroupData[];
}

type ToolInput = Record<string, any>;
type ToolResult = Record<string, any>;

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

const money = (n: number, currency: string) => formatMoney(round2(n), currency);

const categoryLabel = (key: string) =>
  EXPENSE_CATEGORIES.find(c => c.key === key)?.label || 'Other';

const expenseCurrency = (e: Expense, g: AssistantGroupData) =>
  e.currency || g.group.currency || DEFAULT_CURRENCY;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')} ${
    MONTHS[d.getMonth()]
  } ${d.getFullYear()}`;
}

// "YYYY-MM-DD" -> local midnight, or undefined if missing/invalid.
function parseDay(value: unknown): Date | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) {
    return undefined;
  }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function memberName(g: AssistantGroupData, uid: string, me: string): string {
  if (uid === me) {
    return 'you';
  }
  return g.members.find(m => m.uid === uid)?.displayName || 'a former member';
}

// Groups matching an optional name/id filter. Exact match first, then
// "contains", so "goa" finds "Goa Trip 2026".
function resolveGroups(
  data: AssistantData,
  name: unknown,
): AssistantGroupData[] | {error: string} {
  if (typeof name !== 'string' || !name.trim()) {
    return data.groups;
  }
  const q = name.trim().toLowerCase();
  const exact = data.groups.filter(
    g => g.group.id === name || g.group.name.toLowerCase() === q,
  );
  if (exact.length) {
    return exact;
  }
  const partial = data.groups.filter(g =>
    g.group.name.toLowerCase().includes(q),
  );
  if (partial.length) {
    return partial;
  }
  return {
    error: `No group matches "${name}". The user's groups are: ${
      data.groups.map(g => g.group.name).join(', ') || 'none'
    }.`,
  };
}

interface Row {
  g: AssistantGroupData;
  e: Expense;
  share: number;
  paid: number;
  currency: string;
}

// Every expense the user is part of (has a share in, or paid), filtered
// by the common group/date/category inputs.
function userExpenseRows(
  data: AssistantData,
  input: ToolInput,
): Row[] | {error: string} {
  const groups = resolveGroups(data, input.group);
  if (!Array.isArray(groups)) {
    return groups;
  }
  const start = parseDay(input.start_date);
  const endDay = parseDay(input.end_date);
  const end = endDay
    ? new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate() + 1)
    : undefined;
  const category = typeof input.category === 'string' ? input.category : '';
  const rows: Row[] = [];
  groups.forEach(g => {
    g.expenses.forEach(e => {
      const share = e.shares?.[data.uid] || 0;
      const paid = e.paidBy === data.uid ? e.amount : 0;
      if (!share && !paid) {
        return;
      }
      const t = new Date(e.createdAt);
      if ((start && t < start) || (end && t >= end)) {
        return;
      }
      if (category && e.category !== category) {
        return;
      }
      rows.push({g, e, share, paid, currency: expenseCurrency(e, g)});
    });
  });
  return rows;
}

function periodLabel(input: ToolInput): string {
  const s = parseDay(input.start_date);
  const e = parseDay(input.end_date);
  if (s && e) {
    return `${fmtDate(s.toISOString())} to ${fmtDate(e.toISOString())}`;
  }
  if (s) {
    return `since ${fmtDate(s.toISOString())}`;
  }
  if (e) {
    return `up to ${fmtDate(e.toISOString())}`;
  }
  return 'all time';
}

// Sum `pick(row)` per currency, formatted.
function totalsByCurrency(
  rows: Row[],
  pick: (r: Row) => number,
): Record<string, string> {
  const sums: Record<string, number> = {};
  rows.forEach(r => {
    sums[r.currency] = (sums[r.currency] || 0) + pick(r);
  });
  const out: Record<string, string> = {};
  Object.keys(sums).forEach(c => {
    out[c] = money(sums[c], c);
  });
  return out;
}

// Group rows by a key (+ currency, never mixing currencies), summing
// the user's share, sorted largest first.
function breakdown(rows: Row[], keyOf: (r: Row) => string) {
  const map: Record<string, {key: string; currency: string; sum: number}> = {};
  rows.forEach(r => {
    const k = `${keyOf(r)}|${r.currency}`;
    if (!map[k]) {
      map[k] = {key: keyOf(r), currency: r.currency, sum: 0};
    }
    map[k].sum += r.share;
  });
  return Object.values(map)
    .filter(x => x.sum > 0.004)
    .sort((a, b) => b.sum - a.sum)
    .map(x => ({name: x.key, your_share: money(x.sum, x.currency)}));
}

// --- Tools -------------------------------------------------------------------

function listGroups(data: AssistantData): ToolResult {
  return {
    groups: data.groups.map(g => {
      const currency = g.group.currency || DEFAULT_CURRENCY;
      const share = g.expenses.reduce(
        (sum, e) => sum + (e.shares?.[data.uid] || 0),
        0,
      );
      return {
        name: g.group.name,
        type: g.group.type === 'personal' ? 'personal list' : 'shared group',
        currency,
        active_members: g.members.filter(m => m.active !== false).length,
        expense_count: g.expenses.length,
        your_total_share: money(share, currency),
      };
    }),
  };
}

function spendingSummary(data: AssistantData, input: ToolInput): ToolResult {
  const rows = userExpenseRows(data, input);
  if (!Array.isArray(rows)) {
    return rows;
  }
  const withShare = rows.filter(r => r.share > 0);
  return {
    period: periodLabel(input),
    filters: {
      group: input.group || 'all groups',
      category: input.category ? categoryLabel(input.category) : 'all',
    },
    your_spending: totalsByCurrency(withShare, r => r.share),
    you_paid_out_of_pocket: totalsByCurrency(
      rows.filter(r => r.paid > 0),
      r => r.paid,
    ),
    expense_count: withShare.length,
    by_category: breakdown(withShare, r => categoryLabel(r.e.category)),
    by_group: breakdown(withShare, r => r.g.group.name),
    note: 'your_spending = the user’s own share of each expense. you_paid_out_of_pocket = full bills the user paid (others may owe them part of it).',
  };
}

function findExpenses(data: AssistantData, input: ToolInput): ToolResult {
  const rows = userExpenseRows(data, input);
  if (!Array.isArray(rows)) {
    return rows;
  }
  const q = typeof input.search === 'string' ? input.search.trim() : '';
  const matched = q
    ? rows.filter(r => {
        const needle = q.toLowerCase();
        return (
          r.e.description.toLowerCase().includes(needle) ||
          (visibleItems(r.e) || []).some(i =>
            i.name.toLowerCase().includes(needle),
          )
        );
      })
    : rows;
  const sorted = [...matched].sort((a, b) =>
    input.sort === 'largest'
      ? b.share - a.share
      : +new Date(b.e.createdAt) - +new Date(a.e.createdAt),
  );
  const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 20);
  return {
    period: periodLabel(input),
    total_matches: matched.length,
    total_your_share_of_matches: totalsByCurrency(matched, r => r.share),
    expenses: sorted.slice(0, limit).map(r => {
      const items = visibleItems(r.e);
      return {
        date: fmtDate(r.e.createdAt),
        description: r.e.description,
        group: r.g.group.name,
        category: categoryLabel(r.e.category),
        your_share: money(r.share, r.currency),
        full_bill: money(r.e.amount, r.currency),
        paid_by: memberName(r.g, r.e.paidBy, data.uid),
        ...(items
          ? {
              items: items
                .map(i => `${i.name} ${money(i.price, r.currency)}`)
                .join(', '),
            }
          : {}),
      };
    }),
  };
}

function monthlySpending(
  data: AssistantData,
  input: ToolInput,
  now: Date,
): ToolResult {
  const months = Math.min(Math.max(Number(input.months) || 6, 1), 12);
  const out: {month: string; your_spending: Record<string, string>}[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate(),
      ).padStart(2, '0')}`;
    const rows = userExpenseRows(data, {
      ...input,
      start_date: iso(start),
      end_date: iso(end),
    });
    if (!Array.isArray(rows)) {
      return rows;
    }
    const spend = totalsByCurrency(
      rows.filter(r => r.share > 0),
      r => r.share,
    );
    out.push({
      month: `${MONTHS[start.getMonth()]} ${start.getFullYear()}${
        i === 0 ? ' (current, in progress)' : ''
      }`,
      your_spending: Object.keys(spend).length ? spend : {none: '0'},
    });
  }
  return {
    filters: {
      group: input.group || 'all groups',
      category: input.category ? categoryLabel(input.category) : 'all',
    },
    months: out,
  };
}

function balances(data: AssistantData, input: ToolInput): ToolResult {
  const groups = resolveGroups(data, input.group);
  if (!Array.isArray(groups)) {
    return groups;
  }
  const result = groups
    .filter(g => g.group.type !== 'personal')
    .map(g => {
      const currency = g.group.currency || DEFAULT_CURRENCY;
      const net = computeNetBalances(
        g.members.map(m => m.uid),
        g.expenses.map(e => ({
          paidBy: e.paidBy,
          amount: e.amount,
          splits: e.shares || {},
        })),
        g.settlements.map(s => ({
          fromUid: s.fromUid,
          toUid: s.toUid,
          amount: s.amount,
        })),
      );
      const mine = net[data.uid] || 0;
      // Same pair-by-pair ledger the Balances screen shows (useGroupLedger).
      const details = computePairwiseLedger(g.expenses, g.settlements)
        .filter(t => t.fromUid === data.uid || t.toUid === data.uid)
        .map(t =>
          t.fromUid === data.uid
            ? `you owe ${memberName(g, t.toUid, data.uid)} ${money(
                t.amount,
                currency,
              )}`
            : `${memberName(g, t.fromUid, data.uid)} owes you ${money(
                t.amount,
                currency,
              )}`,
        );
      return {
        group: g.group.name,
        status:
          Math.abs(mine) < 0.01
            ? 'settled up'
            : mine > 0
            ? `you are owed ${money(mine, currency)} in total`
            : `you owe ${money(-mine, currency)} in total`,
        details,
      };
    });
  return {
    groups: result,
    note: 'Amounts are after recorded settlements, matching the who-owes-whom list on the app’s Balances screen.',
  };
}

export function runAssistantTool(
  name: string,
  input: ToolInput,
  data: AssistantData,
  now: Date = new Date(),
): ToolResult {
  const safeInput = input && typeof input === 'object' ? input : {};
  switch (name) {
    case 'list_groups':
      return listGroups(data);
    case 'get_spending_summary':
      return spendingSummary(data, safeInput);
    case 'find_expenses':
      return findExpenses(data, safeInput);
    case 'get_monthly_spending':
      return monthlySpending(data, safeInput, now);
    case 'get_balances':
      return balances(data, safeInput);
    default:
      // A tool added on the server after this app version shipped.
      return {
        error:
          'This app version can’t answer that yet - ask the user to update EzySplit.',
      };
  }
}
