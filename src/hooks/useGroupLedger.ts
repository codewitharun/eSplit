// src/hooks/useGroupLedger.ts
// Live view of one group's ledger: members, expenses, settlements, and the
// derived net balances + minimum settle-up transfers. Every screen that
// shows "who owes what" (Activity, Balances, the group card in Groups)
// reads from this single hook instead of recomputing balances inline the
// way the old ExpenseTracker.js did.

import {useEffect, useMemo, useState} from 'react';
import {
  subscribeExpenses,
  subscribeGroup,
  subscribeGroupMembers,
  subscribeSettlements,
} from '../data/ledger';
import {
  computeNetBalances,
  computePairwiseLedger,
} from '../services/ledger/debtSimplifier';
import {
  Expense,
  Group,
  GroupMember,
  Settlement,
  SimplifiedTransfer,
} from '../services/ledger/types';

export interface GroupLedger {
  loading: boolean;
  group: Group | null;
  members: GroupMember[];
  // Members who left (active: false on their groups/{id}/members/{uid}
  // doc) - kept separate from `members` so counts/balances/split pickers
  // only ever see current members, while the UI can still surface who's
  // gone (see Activity's "N people, M left").
  pastMembers: GroupMember[];
  expenses: Expense[];
  settlements: Settlement[];
  totalSpent: number;
  netBalances: Record<string, number>;
  transfers: SimplifiedTransfer[];
  memberName: (uid: string) => string;
}

export function useGroupLedger(groupId: string | null): GroupLedger {
  const [group, setGroup] = useState<Group | null>(null);
  // Raw subcollection contents - both current and departed members, since
  // memberName() needs to resolve names for both (an old expense can still
  // be `paidBy` someone who's since left).
  const [allMembers, setAllMembers] = useState<GroupMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) {
      setGroup(null);
      setAllMembers([]);
      setExpenses([]);
      setSettlements([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubGroup = subscribeGroup(groupId, setGroup);
    const unsubMembers = subscribeGroupMembers(groupId, setAllMembers);
    const unsubExpenses = subscribeExpenses(groupId, list => {
      setExpenses(list);
      setLoading(false);
    });
    const unsubSettlements = subscribeSettlements(groupId, setSettlements);
    return () => {
      unsubGroup();
      unsubMembers();
      unsubExpenses();
      unsubSettlements();
    };
  }, [groupId]);

  const members = useMemo(
    () => allMembers.filter(m => m.active !== false),
    [allMembers],
  );
  const pastMembers = useMemo(
    () => allMembers.filter(m => m.active === false),
    [allMembers],
  );

  const memberIds = useMemo(() => members.map(m => m.uid), [members]);

  const netBalances = useMemo(
    () =>
      computeNetBalances(
        memberIds,
        expenses.map(e => ({
          paidBy: e.paidBy,
          amount: e.amount,
          splits: e.shares,
        })),
        settlements.map(s => ({
          fromUid: s.fromUid,
          toUid: s.toUid,
          amount: s.amount,
        })),
      ),
    [memberIds, expenses, settlements],
  );

  // "Who owes whom" now shows the direct, pair-by-pair ledger rather than
  // the old minimum-transaction simplification - users found the latter
  // confusing (a settle-up payment that didn't trace back to any shared
  // bill between that specific pair). netBalances above is UNCHANGED and
  // still drives every "you owe / you're owed" summary number - only the
  // transfer list shown here changes.
  const transfers = useMemo(
    () => computePairwiseLedger(expenses, settlements),
    [expenses, settlements],
  );

  const totalSpent = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses],
  );

  const memberName = (uid: string) =>
    allMembers.find(m => m.uid === uid)?.displayName || 'Someone';

  return {
    loading,
    group,
    members,
    pastMembers,
    expenses,
    settlements,
    totalSpent,
    netBalances,
    transfers,
    memberName,
  };
}
