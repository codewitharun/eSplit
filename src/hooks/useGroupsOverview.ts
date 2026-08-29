// src/hooks/useGroupsOverview.ts
// Powers the Groups screen's "quick overview" dashboard: your net balance
// per group, plus the totals across every group. Uses one-time reads
// (getGroupSnapshot) rather than live listeners - this is a summary list,
// not a screen that needs to react instantly to someone else's edit.

import {useCallback, useEffect, useState} from 'react';
import {computeNetBalances} from '../services/ledger/debtSimplifier';
import {getGroupSnapshot} from '../services/ledger/firestoreLedger';
import {Group} from '../services/ledger/types';

export interface GroupsOverview {
  loading: boolean;
  perGroupBalance: Record<string, number>; // groupId -> your net balance in that group
  totalOwedToYou: number;
  totalYouOwe: number;
  refresh: () => void;
}

export function useGroupsOverview(
  groups: Group[],
  uid: string | undefined,
): GroupsOverview {
  const [perGroupBalance, setPerGroupBalance] = useState<
    Record<string, number>
  >({});
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!uid || groups.length === 0) {
      setPerGroupBalance({});
      return;
    }
    setLoading(true);
    try {
      const results = await Promise.all(
        groups.map(async group => {
          const {members, expenses, settlements} = await getGroupSnapshot(
            group.id,
          );
          const net = computeNetBalances(
            members.map(m => m.uid),
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
          );
          return [group.id, net[uid] || 0] as const;
        }),
      );
      setPerGroupBalance(Object.fromEntries(results));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, groups.map(g => g.id).join(','), tick]);

  useEffect(() => {
    load();
  }, [load]);

  const totalOwedToYou = Object.values(perGroupBalance)
    .filter(b => b > 0)
    .reduce((s, b) => s + b, 0);
  const totalYouOwe = Object.values(perGroupBalance)
    .filter(b => b < 0)
    .reduce((s, b) => s - b, 0);

  return {
    loading,
    perGroupBalance,
    totalOwedToYou,
    totalYouOwe,
    refresh: () => setTick(t => t + 1),
  };
}
