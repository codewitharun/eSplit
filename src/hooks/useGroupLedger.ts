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
} from '../services/ledger/firestoreLedger';
import {
  computeNetBalances,
  simplifyDebts,
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
  expenses: Expense[];
  settlements: Settlement[];
  totalSpent: number;
  netBalances: Record<string, number>;
  transfers: SimplifiedTransfer[];
  memberName: (uid: string) => string;
}

export function useGroupLedger(groupId: string | null): GroupLedger {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) {
      setGroup(null);
      setMembers([]);
      setExpenses([]);
      setSettlements([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubGroup = subscribeGroup(groupId, setGroup);
    const unsubMembers = subscribeGroupMembers(groupId, setMembers);
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

  const transfers = useMemo(() => simplifyDebts(netBalances), [netBalances]);

  const totalSpent = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses],
  );

  const memberName = (uid: string) =>
    members.find(m => m.uid === uid)?.displayName || 'Someone';

  return {
    loading,
    group,
    members,
    expenses,
    settlements,
    totalSpent,
    netBalances,
    transfers,
    memberName,
  };
}
