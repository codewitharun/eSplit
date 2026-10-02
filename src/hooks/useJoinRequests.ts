// src/hooks/useJoinRequests.ts
// Live view of a group's outstanding (pending) join requests, for the
// admin-only panel in GroupSettings.tsx. Mirrors useGroupLedger.ts's
// shape (loading + a live-subscribed array) rather than reusing that hook
// itself - join requests are a separate subcollection with their own
// approve/decline actions, not part of the balance/ledger computation.

import {useEffect, useState} from 'react';
import {subscribeJoinRequests} from '../data/ledger';
import {JoinRequest} from '../services/ledger/types';

export interface JoinRequestsState {
  loading: boolean;
  requests: JoinRequest[];
}

export function useJoinRequests(groupId: string | null): JoinRequestsState {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeJoinRequests(groupId, next => {
      setRequests(next);
      setLoading(false);
    });
    return unsubscribe;
  }, [groupId]);

  return {loading, requests};
}
