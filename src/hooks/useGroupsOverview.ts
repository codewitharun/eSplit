// src/hooks/useGroupsOverview.ts
// Powers the Groups screen's "quick overview" dashboard: your net balance
// per group, plus the totals across every group. Uses one-time reads
// (getGroupSnapshot) rather than live listeners - this is a summary list,
// not a screen that needs to react instantly to someone else's edit.
//
// Groups can now be in different currencies (see currency.ts), so a
// single summed "total" across all of them would silently add rupees to
// dollars. Totals are kept split by currency instead - `totalsByCurrency`
// - and `totalOwedToYou`/`totalYouOwe` are a convenience view scoped to
// `primaryCurrency` (whichever currency most of the user's groups use) so
// existing single-currency call sites keep working unchanged; a user with
// groups in more than one currency should read totalsByCurrency directly
// instead of assuming the top-level numbers cover everything.

import {useCallback, useEffect, useState} from 'react';
import {computeNetBalances} from '../services/ledger/debtSimplifier';
import {getGroupSnapshot} from '../services/ledger/firestoreLedger';
import {DEFAULT_CURRENCY} from '../services/ledger/currency';
import {Group} from '../services/ledger/types';

export interface CurrencyTotals {
  owedToYou: number;
  youOwe: number;
}

export interface GroupsOverview {
  loading: boolean;
  perGroupBalance: Record<string, number>; // groupId -> your net balance in that group
  totalsByCurrency: Record<string, CurrencyTotals>;
  primaryCurrency: string;
  totalOwedToYou: number; // = totalsByCurrency[primaryCurrency].owedToYou
  totalYouOwe: number; // = totalsByCurrency[primaryCurrency].youOwe
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

  // Whichever currency most of the user's groups use - the one the
  // top-level totalOwedToYou/totalYouOwe reflects. Ties break toward
  // DEFAULT_CURRENCY (INR) since that's overwhelmingly the common case.
  const currencyCounts: Record<string, number> = {};
  groups.forEach(g => {
    const code = g.currency || DEFAULT_CURRENCY;
    currencyCounts[code] = (currencyCounts[code] || 0) + 1;
  });
  let primaryCurrency = DEFAULT_CURRENCY;
  let bestCount = currencyCounts[DEFAULT_CURRENCY] || 0;
  for (const [code, count] of Object.entries(currencyCounts)) {
    if (count > bestCount) {
      bestCount = count;
      primaryCurrency = code;
    }
  }

  const totalsByCurrency: Record<string, CurrencyTotals> = {};
  groups.forEach(g => {
    const code = g.currency || DEFAULT_CURRENCY;
    const balance = perGroupBalance[g.id] || 0;
    if (!totalsByCurrency[code]) {
      totalsByCurrency[code] = {owedToYou: 0, youOwe: 0};
    }
    if (balance > 0) {
      totalsByCurrency[code].owedToYou += balance;
    } else if (balance < 0) {
      totalsByCurrency[code].youOwe += -balance;
    }
  });

  const primaryTotals = totalsByCurrency[primaryCurrency] || {
    owedToYou: 0,
    youOwe: 0,
  };

  return {
    loading,
    perGroupBalance,
    totalsByCurrency,
    primaryCurrency,
    totalOwedToYou: primaryTotals.owedToYou,
    totalYouOwe: primaryTotals.youOwe,
    refresh: () => setTick(t => t + 1),
  };
}
