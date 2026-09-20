// src/hooks/useGroupsOverview.ts
// Powers the Groups screen's "quick overview" dashboard: your net balance
// per group, plus the totals across every group. Uses one-time reads
// (getGroupSnapshot) rather than live listeners - this is a summary list,
// not a screen that needs to react instantly to someone else's edit.
//
// Stale-while-revalidate: `load()` below first computes balances from
// whatever's already sitting in Firestore's on-device cache (instant,
// no network wait), paints that immediately, then re-fetches from the
// server in the background and overwrites with the authoritative
// numbers once they land. This is purely a read-path change - it never
// writes anything and the server pass still runs every time - so the
// dashboard just *feels* instant on a warm cache instead of blocking on
// a network round trip per group before showing anything. The very
// first load after installing/logging in has nothing cached yet, so it
// behaves exactly as before (a brief loading state, then the real
// numbers). A stale cached number being replaced a moment later by the
// live one is expected and harmless here, same as it already was for
// the (unrelated) one-time-read design this hook has always used.
//
// Groups can now be in different currencies (see currency.ts), so a
// single summed "total" across all of them would silently add rupees to
// dollars. Totals are kept split by currency instead - `totalsByCurrency`
// - and `totalOwedToYou`/`totalYouOwe` are a convenience view scoped to
// `primaryCurrency` (whichever currency most of the user's groups use) so
// existing single-currency call sites keep working unchanged; a user with
// groups in more than one currency should read totalsByCurrency directly
// instead of assuming the top-level numbers cover everything.
//
// `myGroupSpendByCurrency` (added for the Personal Expense feature, see
// PERSONAL_EXPENSE_PLAN.md section 4) is purely additive: it rides along
// on the exact same getGroupSnapshot() fetch this hook already does for
// net balances, so it costs no extra read. Every field that existed
// before it keeps the same meaning and the same value it always had.

import {useCallback, useEffect, useState} from 'react';
import {computeNetBalances} from '../services/ledger/debtSimplifier';
import {getGroupSnapshot} from '../services/ledger/firestoreLedger';
import {DEFAULT_CURRENCY} from '../services/ledger/currency';
import {
  mergeCurrencyTotals,
  sumSharesByCurrency,
} from '../services/ledger/spendTotals';
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
  // "How much of every group expense was actually my share" - bucketed by
  // currency, summed across every group. Not a debt number (see
  // spendTotals.ts) - a user with no groups, or no expenses yet, gets {}.
  myGroupSpendByCurrency: Record<string, number>;
  // Same idea, but for groups created as "Personal" (group.type ===
  // 'personal') - split out so a screen can show "groups" vs "personal"
  // totals separately without a second fetch; myGroupSpendByCurrency
  // above now means "non-personal groups only" so the two stay additive
  // (sum of both = every group you're in, same as it always summed to
  // before personal-type groups existed).
  myPersonalGroupSpendByCurrency: Record<string, number>;
  // groupId -> ISO timestamp of its most recent expense or settlement,
  // or the group's own `createdAt` if it has neither yet - "how recently
  // was this group actually used", for the dashboard's Activity sort.
  // Purely additive, same as myGroupSpendByCurrency above: it's read off
  // the exact same getGroupSnapshot() fetch this hook already makes, so
  // it costs no extra read.
  lastActivityByGroup: Record<string, string>;
  refresh: () => void;
}

export function useGroupsOverview(
  groups: Group[],
  uid: string | undefined,
): GroupsOverview {
  const [perGroupBalance, setPerGroupBalance] = useState<
    Record<string, number>
  >({});
  const [myGroupSpendByCurrency, setMyGroupSpendByCurrency] = useState<
    Record<string, number>
  >({});
  const [myPersonalGroupSpendByCurrency, setMyPersonalGroupSpendByCurrency] =
    useState<Record<string, number>>({});
  const [lastActivityByGroup, setLastActivityByGroup] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  // Turns one getGroupSnapshot() per group into the three pieces of
  // state this hook exposes. Pulled out of load() so the cache-first
  // pass and the server pass below compute balances/spend the exact
  // same way and can never disagree on the math - only on how fresh
  // the underlying expenses/settlements were when read.
  const applySnapshots = useCallback(
    (
      results: readonly (readonly [
        string,
        number,
        Record<string, number>,
        Group['type'],
        string,
      ])[],
    ) => {
      setPerGroupBalance(
        Object.fromEntries(results.map(([id, balance]) => [id, balance])),
      );
      const groupResults = results.filter(
        ([, , , type]) => type !== 'personal',
      );
      const personalResults = results.filter(
        ([, , , type]) => type === 'personal',
      );
      setMyGroupSpendByCurrency(
        mergeCurrencyTotals(...groupResults.map(([, , spend]) => spend)),
      );
      setMyPersonalGroupSpendByCurrency(
        mergeCurrencyTotals(...personalResults.map(([, , spend]) => spend)),
      );
      setLastActivityByGroup(
        Object.fromEntries(
          results.map(([id, , , , lastActivityAt]) => [id, lastActivityAt]),
        ),
      );
    },
    [],
  );

  const fetchAndCompute = useCallback(
    async (source: 'default' | 'cache') => {
      const snapshots = await Promise.all(
        groups.map(async group => {
          const {members, expenses, settlements} = await getGroupSnapshot(
            group.id,
            {source},
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
          const spend = sumSharesByCurrency(expenses, uid as string);
          // Most recent expense/settlement timestamp in this group, or
          // its own creation date if nothing's been added yet - ISO
          // timestamps sort correctly as plain strings, so a simple max
          // is all this needs.
          const activityTimestamps = [
            ...expenses.map(e => e.createdAt),
            ...settlements.map(s => s.createdAt),
          ].filter(Boolean);
          const lastActivityAt =
            activityTimestamps.length > 0
              ? activityTimestamps.reduce((max, t) => (t > max ? t : max))
              : group.createdAt;
          return [
            group.id,
            net[uid as string] || 0,
            spend,
            group.type,
            lastActivityAt,
          ] as const;
        }),
      );
      return snapshots;
    },
    [groups, uid],
  );

  const load = useCallback(async () => {
    if (!uid || groups.length === 0) {
      setPerGroupBalance({});
      setMyGroupSpendByCurrency({});
      setMyPersonalGroupSpendByCurrency({});
      setLastActivityByGroup({});
      return;
    }
    setLoading(true);
    // Cache-first paint: best-effort, so a cache miss (first-ever load)
    // or any read hiccup here just means the screen keeps showing its
    // existing loading state instead of the earlier numbers - it never
    // blocks or fails the authoritative fetch below.
    try {
      const cached = await fetchAndCompute('cache');
      applySnapshots(cached);
    } catch {
      // No usable cache yet - fine, the server pass below is the real
      // source of truth anyway.
    }
    try {
      const fresh = await fetchAndCompute('default');
      applySnapshots(fresh);
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
    myGroupSpendByCurrency,
    myPersonalGroupSpendByCurrency,
    lastActivityByGroup,
    refresh: () => setTick(t => t + 1),
  };
}
