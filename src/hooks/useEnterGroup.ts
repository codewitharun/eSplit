// src/hooks/useEnterGroup.ts
// The "you're in - go to Home" sequence that runs every time a user ends
// up inside a group, whichever screen got them there: Group-Check's
// deep-link/join-by-id path, or the Create/Join Group screen's own
// create/join actions. Extracted out of GroupCheck.tsx (which used to be
// the only place this could happen) so a second entry point can't drift
// from it - e.g. one path remembering `lastJoinedGroup` in AsyncStorage
// and the other forgetting to, or the "add a UPI ID" nudge firing twice
// (once per screen) instead of once per app session.
//
// The UPI prompt's "have we already shown this" flag is deliberately a
// module-level variable, not component state: it needs to stay true for
// the rest of the app session regardless of which screen's hook instance
// set it, which per-component state/useRef can't do across two different
// mounted screens.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {useCallback, useRef, useState} from 'react';
import {isUpiCurrency} from '../services/ledger/currency';
import {GroupType} from '../services/ledger/types';
import {useExpenseState} from '../store/useExpenseStore';
import {haptics} from '../utils/haptics';
import {currentUser, type AuthUser} from '../data/firebase';
import {getUserUpiId} from '../data/users';

let upiPromptShownThisSession = false;

export function useEnterGroup(navigation: any) {
  const setGroupKey = useExpenseState(state => state.setGroupKey);
  const [upiPromptVisible, setUpiPromptVisible] = useState(false);
  // Guards against this exact hook instance firing the Firestore check
  // twice for the same render burst - the session-wide gate above is what
  // stops it firing again from a *different* screen later.
  const checkInFlightRef = useRef(false);

  const promptForUpiIfMissing = useCallback(
    async (
      user: AuthUser | null,
      groupCurrency?: string,
      groupType?: GroupType,
    ) => {
      // UPI settle-up doesn't apply outside India - nudging someone to add
      // a UPI ID right after they open a EUR/USD/... group would be asking
      // for something that group can never actually use. A Personal list
      // is "just you" everywhere else in the app (no splitting, no one to
      // settle up with), so there's no one to ever pay via UPI there
      // either - asking is never actionable for it.
      if (
        !user ||
        upiPromptShownThisSession ||
        checkInFlightRef.current ||
        !isUpiCurrency(groupCurrency) ||
        groupType === 'personal'
      ) {
        return;
      }
      checkInFlightRef.current = true;
      try {
        const hasUpiId = !!(await getUserUpiId(user.uid));
        if (hasUpiId) {
          return;
        }
        upiPromptShownThisSession = true;
        setUpiPromptVisible(true);
      } catch {
        // Best-effort nudge only - a failed check shouldn't block entry to
        // the group or alarm the user with an error they can't act on.
      } finally {
        checkInFlightRef.current = false;
      }
    },
    [],
  );

  const enterGroup = useCallback(
    async (groupKey: string, groupCurrency?: string, groupType?: GroupType) => {
      setGroupKey(groupKey);
      await AsyncStorage.setItem('groupKey', groupKey);
      await AsyncStorage.setItem('lastJoinedGroup', groupKey);
      haptics.success();
      navigation.navigate('Home');
      promptForUpiIfMissing(currentUser(), groupCurrency, groupType);
    },
    [navigation, setGroupKey, promptForUpiIfMissing],
  );

  return {
    enterGroup,
    upiPromptVisible,
    dismissUpiPrompt: () => setUpiPromptVisible(false),
  };
}
